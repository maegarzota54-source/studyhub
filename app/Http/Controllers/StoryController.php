<?php
namespace App\Http\Controllers;

use App\Models\{Story, User};
use App\Notifications\StudyHubNotice;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\{DB, Storage};
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;

/**
 * Stories: a photo that lasts 24 hours.
 * Audience: public (every student), specific (people you pick from your circles) or private (only you).
 */
class StoryController extends Controller
{
    private const MIMES = ['jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg', 'png' => 'image/png', 'webp' => 'image/webp', 'gif' => 'image/gif'];

    public function index(Request $request) {
        $u = $request->user();
        $this->purgeOld();

        $stories = Story::visibleTo($u)->active()->with('user:id,name,avatar')->oldest()->get();
        $seen = DB::table('story_views')->where('user_id', $u->id)->whereIn('story_id', $stories->pluck('id'))->pluck('story_id')->all();
        $stories->where('user_id', $u->id)->each(fn ($s) => $s->load('views:id,name,avatar'));

        $groups = $stories->groupBy('user_id')->map(function ($items) use ($u, $seen) {
            $owner = $items->first()->user;
            $mine = $owner->id === $u->id;
            return [
                'user' => ['id' => $owner->id, 'name' => $owner->name, 'avatar_url' => $owner->avatar_url],
                'mine' => $mine,
                'unseen' => !$mine && $items->contains(fn ($s) => !in_array($s->id, $seen)),
                'latest' => $items->max('created_at')?->timestamp ?? 0,
                'stories' => $items->map(fn ($s) => [
                    'id' => $s->id, 'caption' => $s->caption, 'audience' => $s->audience,
                    'url' => route('stories.image', $s->id, false),
                    'created_at' => $s->created_at->toIso8601String(), 'ago' => $s->created_at->diffForHumans(),
                    'expires_in' => $s->expires_at->diffForHumans(null, true),
                    'seen' => $mine || in_array($s->id, $seen),
                    'viewers' => $mine ? $s->views->map(fn ($v) => [
                        'id' => $v->id, 'name' => $v->name, 'avatar_url' => $v->avatar_url,
                        'viewed_at' => \Illuminate\Support\Carbon::parse($v->pivot->viewed_at)->diffForHumans(),
                    ])->values() : [],
                ])->values(),
            ];
        })->sortBy([['mine', 'desc'], ['unseen', 'desc'], ['latest', 'desc']])->values();

        return Inertia::render('Stories/Index', [
            'groups' => $groups,
            'contacts' => $u->circleMates()->map(fn ($c) => ['id' => $c->id, 'name' => $c->name, 'avatar_url' => $c->avatar_url])->values(),
        ]);
    }

    public function store(Request $request) {
        $u = $request->user();
        $d = $request->validate([
            'image' => 'required|image|mimes:jpg,jpeg,png,webp,gif|max:8192',
            'caption' => 'nullable|string|max:200',
            'audience' => 'required|in:public,specific,private',
            'viewer_ids' => ['exclude_unless:audience,specific', 'required', 'array', 'min:1', 'max:100'],
            'viewer_ids.*' => 'integer',
        ]);

        $allowed = collect();
        if ($d['audience'] === 'specific') {
            // Only people you share a circle with can be picked.
            $allowed = $u->circleMates()->pluck('id')->intersect($d['viewer_ids'])->values();
            if ($allowed->isEmpty()) throw ValidationException::withMessages(['viewer_ids' => 'Pick at least one student from your circles.']);
        }

        $story = Story::create([
            'user_id' => $u->id, 'image_path' => $request->file('image')->store('stories'),
            'caption' => $d['caption'] ?? null, 'audience' => $d['audience'], 'expires_at' => now()->addHours(24),
        ]);

        if ($allowed->isNotEmpty()) {
            $story->allowed()->attach($allowed->all());
            User::whereIn('id', $allowed)->get()->each->notify(
                new StudyHubNotice("{$u->name} shared a story with you", route('stories.index', [], false)));
        }
        return back()->with('success', 'Story posted. It disappears in 24 hours.');
    }

    /** Streams the photo, but only to people the audience setting allows. */
    public function image(Request $request, Story $story) {
        abort_unless(Story::visibleTo($request->user())->whereKey($story->id)->exists(), 403);
        $mime = self::MIMES[strtolower(pathinfo($story->image_path, PATHINFO_EXTENSION))] ?? null;
        abort_unless($mime && Storage::exists($story->image_path), 404);
        return response()->file(Storage::path($story->image_path), [
            'Content-Type' => $mime, 'X-Content-Type-Options' => 'nosniff', 'Cache-Control' => 'private, max-age=3600',
        ]);
    }

    public function markViewed(Request $request, Story $story) {
        $u = $request->user();
        abort_unless(Story::visibleTo($u)->active()->whereKey($story->id)->exists(), 403);
        if ($story->user_id !== $u->id) {
            DB::table('story_views')->insertOrIgnore(['story_id' => $story->id, 'user_id' => $u->id, 'viewed_at' => now()]);
        }
        return response()->json(['ok' => true]);
    }

    public function destroy(Request $request, Story $story) {
        abort_unless($story->user_id === $request->user()->id, 403, 'You can only delete your own stories.');
        $this->remove($story);
        return back()->with('success', 'Story deleted.');
    }

    private function remove(Story $story): void {
        if ($story->image_path && Storage::exists($story->image_path)) Storage::delete($story->image_path);
        $story->delete();
    }

    /** Housekeeping: stories expired for more than a day are removed together with their photo. */
    private function purgeOld(): void {
        Story::where('expires_at', '<', now()->subDay())->limit(50)->get()->each(fn ($s) => $this->remove($s));
    }
}
