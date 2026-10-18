<?php
namespace App\Http\Controllers;

use App\Models\{GroupReading, Message, Setting, StudyGroup};
use App\Notifications\StudyHubNotice;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\{DB, Storage};
use Inertia\Inertia;

/**
 * Find Groups (join / members / teacher badge), group pictures, live activity,
 * and the shared "reading together" document viewer.
 */
class GroupExtrasController extends Controller
{
    private const ACTIVE_SECONDS = 45;   // heartbeat is every 20 s on the client
    private const READING_SECONDS = 90;  // presenter pings every 20 s

    // ------------------------------------------------------------------ Find / create / join
    public function find(Request $request) {
        $u = $request->user();
        $groups = StudyGroup::query()->withCount('members')
            ->withExists(['members as is_member' => fn ($q) => $q->whereKey($u->id)])
            ->with('members:users.id,users.name,users.avatar')
            ->whereDoesntHave('members', fn ($q) => $q->whereKey($u->id))   // circles you already joined live in My Groups
            ->when($request->q, fn ($q, $s) => $q->where(fn ($w) => $w->where('title', 'like', "%$s%")->orWhere('topic', 'like', "%$s%")))
            ->when($request->skill_level, fn ($q, $v) => $q->where('skill_level', $v))
            ->when($request->mode, fn ($q, $v) => $q->where('mode', $v))
            ->when($request->recommended, fn ($q) => $q->whereNotNull('recommended_by'))
            ->orderByRaw('recommended_by is null')      // teacher-recommended circles first
            ->latest()->paginate(12)->withQueryString();

        return Inertia::render('Groups/Index', [
            'mode' => 'find', 'groups' => $groups,
            'filters' => $request->only('q', 'skill_level', 'mode', 'recommended'),
        ]);
    }

    public function store(Request $request) {
        $max = (int) Setting::get('max_group_size', 50);
        $data = $request->validate([
            'title' => 'required|string|max:120', 'topic' => 'required|string|max:120',
            'description' => 'nullable|string|max:2000', 'target_date' => 'nullable|date|after_or_equal:today',
            'skill_level' => 'required|in:beginner,intermediate,advanced', 'mode' => 'required|in:online,in-person',
            'max_members' => "required|integer|min:2|max:$max",
            'cover' => 'nullable|image|max:3072',
        ]);
        $cover = $request->file('cover')?->store('group-covers', 'public');
        $group = StudyGroup::create(Arr::except($data, ['cover']) + ['owner_id' => $request->user()->id, 'cover' => $cover]);
        $group->members()->attach($request->user()->id, ['role' => 'admin']);
        return to_route('groups.show', $group)->with('success', 'Study circle created.');
    }

    /** Stays on the Find Groups page so the button can flip to "Joined". */
    public function join(Request $request, StudyGroup $group) {
        $u = $request->user();
        if (!$group->hasMember($u)) {
            if ($group->members()->count() >= $group->max_members) {
                return back()->withErrors(['join' => 'This circle is full.']);
            }
            $group->members()->attach($u->id, ['role' => 'member']);
            $group->owner->notify(new StudyHubNotice("{$u->name} joined {$group->title}", route('groups.show', $group, false)));
        }
        return back();
    }

    public function cover(Request $request, StudyGroup $group) {
        abort_unless($group->isGroupAdmin($request->user()), 403);
        $request->validate(['cover' => 'required|image|max:3072']);
        if ($group->cover) Storage::disk('public')->delete($group->cover);
        $group->update(['cover' => $request->file('cover')->store('group-covers', 'public')]);
        return back()->with('success', 'Group picture updated.');
    }

    /** Admin acts as the teacher: mark / unmark a circle as recommended. */
    public function recommend(Request $request, StudyGroup $group) {
        $d = $request->validate(['teacher' => 'nullable|string|max:80']);
        $group->update(['recommended_by' => $d['teacher'] ?: null]);
        return back()->with('success', $group->recommended_by ? "Marked as recommended by {$group->recommended_by}." : 'Recommendation removed.');
    }

    // ------------------------------------------------------------------ Live activity (green / gray)
    private function member(Request $request, StudyGroup $group): void {
        abort_unless($group->hasMember($request->user()) || $request->user()->isAdmin(), 403);
    }

    public function activity(Request $request) {
        $ids = $request->user()->groups()->pluck('study_groups.id');
        $rows = DB::table('group_members')->join('users', 'users.id', '=', 'group_members.user_id')
            ->whereIn('group_members.study_group_id', $ids)
            ->where('group_members.last_active_at', '>=', now()->subSeconds(self::ACTIVE_SECONDS))
            ->get(['group_members.study_group_id as gid', 'users.name']);
        $out = [];
        foreach ($ids as $id) {
            $r = $rows->where('gid', $id);
            $out[$id] = ['active' => $r->isNotEmpty(), 'count' => $r->count(), 'names' => $r->pluck('name')->take(3)->values()];
        }
        return response()->json($out);
    }

    public function heartbeat(Request $request, StudyGroup $group) {
        $this->member($request, $group);
        if ($group->hasMember($request->user())) {
            $group->members()->updateExistingPivot($request->user()->id, ['last_active_at' => $request->boolean('active', true) ? now() : null]);
        }
        return response()->json(['ok' => true]);
    }

    // ------------------------------------------------------------------ Reading together
    private function kind(?string $name): string {
        $ext = strtolower(pathinfo((string) $name, PATHINFO_EXTENSION));
        if ($ext === 'pdf') return 'pdf';
        if (in_array($ext, ['jpg', 'jpeg', 'png', 'gif', 'webp'], true)) return 'image';
        if (in_array($ext, ['txt', 'md', 'csv', 'json', 'log', 'js', 'jsx', 'php', 'py', 'java', 'c', 'cpp', 'html', 'css', 'sql', 'xml'], true)) return 'text';
        return 'none';
    }

    private function fileRow(Message $m): array {
        return [
            'id' => $m->id, 'name' => $m->attachment_name, 'size' => $m->attachment_size,
            'by' => $m->sender->name ?? '', 'kind' => $this->kind($m->attachment_name),
            'url' => route('messages.preview', $m->id, false), 'download' => route('messages.attachment', $m->id, false),
        ];
    }

    public function reader(Request $request, StudyGroup $group) {
        $this->member($request, $group);
        $files = Message::where('study_group_id', $group->id)->whereNotNull('attachment_path')
            ->with('sender:id,name')->latest()->limit(30)->get()->map(fn ($m) => $this->fileRow($m))->values();

        $r = GroupReading::where('study_group_id', $group->id)
            ->where('updated_at', '>=', now()->subSeconds(self::READING_SECONDS))->with('user:id,name')->first();
        $reading = null;
        if ($r && ($m = Message::with('sender:id,name')->find($r->message_id))) {
            $reading = ['message_id' => $r->message_id, 'by_id' => $r->user_id, 'by' => $r->user->name ?? '',
                'page' => $r->page, 'scroll' => $r->scroll, 'file' => $this->fileRow($m)];
        }
        return response()->json(['files' => $files, 'reading' => $reading]);
    }

    public function openReading(Request $request, StudyGroup $group) {
        $this->member($request, $group);
        $d = $request->validate(['message_id' => 'required|integer']);
        $m = Message::where('study_group_id', $group->id)->whereNotNull('attachment_path')->findOrFail($d['message_id']);
        GroupReading::updateOrCreate(['study_group_id' => $group->id],
            ['message_id' => $m->id, 'user_id' => $request->user()->id, 'page' => 1, 'scroll' => 0, 'started_at' => now()]);
        return response()->json(['ok' => true]);
    }

    /** Only the person presenting can move the page / scroll for everyone. Also acts as the keep-alive. */
    public function syncReading(Request $request, StudyGroup $group) {
        $this->member($request, $group);
        $r = GroupReading::where('study_group_id', $group->id)->first();
        if (!$r || $r->user_id !== $request->user()->id) return response()->json(['ok' => false], 409);
        $d = $request->validate(['page' => 'sometimes|integer|min:1|max:5000', 'scroll' => 'sometimes|integer|min:0|max:100']);
        $r->fill($d)->save();
        $r->touch();
        return response()->json(['ok' => true]);
    }

    public function stopReading(Request $request, StudyGroup $group) {
        $this->member($request, $group);
        GroupReading::where('study_group_id', $group->id)->where('user_id', $request->user()->id)->delete();
        return response()->json(['ok' => true]);
    }

    /** Inline preview for chat attachments. Content-Type comes from the extension, never from the upload. */
    public function preview(Request $request, Message $message) {
        $u = $request->user();
        $ok = $message->study_group_id
            ? ($message->group->hasMember($u) || $u->isAdmin())
            : in_array($u->id, [$message->sender_id, $message->recipient_id], true);
        abort_unless($ok && $message->attachment_path, 403);

        $kind = $this->kind($message->attachment_name);
        abort_if($kind === 'none', 415, 'No preview for this file type.');
        $ext = strtolower(pathinfo($message->attachment_name, PATHINFO_EXTENSION));
        $type = match (true) {
            $kind === 'pdf' => 'application/pdf',
            $kind === 'text' => 'text/plain; charset=UTF-8',
            default => ['jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg', 'png' => 'image/png', 'gif' => 'image/gif', 'webp' => 'image/webp'][$ext],
        };
        return Storage::response($message->attachment_path, $message->attachment_name, [
            'Content-Type' => $type, 'X-Content-Type-Options' => 'nosniff',
        ]);
    }
}
