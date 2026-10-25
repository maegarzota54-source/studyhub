<?php
namespace App\Http\Controllers;

use App\Models\{Message, NoteFile, Schedule, StudyGroup, Task};
use App\Notifications\StudyHubNotice;
use App\Support\ChatReadReceipts;
use Illuminate\Http\Request;
use Inertia\Inertia;

class GroupController extends Controller
{
    public function index(Request $request) {
        return Inertia::render('Groups/Index', [
            'mode' => 'mine',
            'groups' => $request->user()->groups()->withCount('members')->latest('group_members.created_at')->get(),
        ]);
    }

    /** Discovery: shows only title/topic/summary — never group content. */
    public function find(Request $request) {
        $u = $request->user();
        $groups = StudyGroup::query()->withCount('members')
            ->withExists(['members as is_member' => fn ($q) => $q->whereKey($u->id)])
            ->whereDoesntHave('members', fn ($q) => $q->whereKey($u->id))
            ->when($request->q, fn ($q, $s) => $q->where(fn ($w) => $w->where('title', 'like', "%$s%")->orWhere('topic', 'like', "%$s%")))
            ->when($request->skill_level, fn ($q, $v) => $q->where('skill_level', $v))
            ->when($request->mode, fn ($q, $v) => $q->where('mode', $v))
            ->latest()->paginate(12)->withQueryString();
        return Inertia::render('Groups/Index', ['mode' => 'find', 'groups' => $groups, 'filters' => $request->only('q', 'skill_level', 'mode')]);
    }

    public function store(Request $request) {
        $mode = strtolower(str_replace([' ', '_'], '-', trim((string) $request->mode)));
        $level = strtolower(trim((string) $request->skill_level));
        $request->merge([
        'skill_level' => in_array($level, ['beginner', 'intermediate', 'advanced']) ? $level : 'beginner',
        'mode' => in_array($mode, ['online', 'in-person']) ? $mode : 'online',
        ]);
        $data = $request->validate([
            'title' => 'required|string|max:120', 'topic' => 'required|string|max:120',
            'description' => 'nullable|string|max:2000', 'target_date' => 'nullable|date|after_or_equal:today',
            'skill_level' => 'required|in:beginner,intermediate,advanced', 'mode' => 'required|in:online,in-person',
            'max_members' => 'required|integer|min:2|max:'.\App\Models\Setting::get('max_group_size', 50),
        ]);
        $group = StudyGroup::create($data + ['owner_id' => $request->user()->id]);
        $group->members()->attach($request->user()->id, ['role' => 'admin']);
        return to_route('groups.show', $group)->with('success', 'Study circle created.');
    }

    public function show(Request $request, StudyGroup $group) {
        $u = $request->user();
        abort_unless($group->hasMember($u) || $u->isAdmin(), 403, 'Join this circle to see its workspace.');

        $messages = $group->messages()->whereNull('parent_id')->visibleTo($u)->with(['sender:id,name,avatar', 'task', 'reactions:id,name'])
            ->with(['replies' => fn ($q) => $q->visibleTo($u)->with(['sender:id,name,avatar', 'reactions:id,name'])->withExists('savedFiles as saved')])->withExists('savedFiles as saved') // see Message::replies below
            ->latest()->limit(100)->get()->reverse()->values();
        ChatReadReceipts::attach(
            $messages,
            ChatReadReceipts::groupKey($group->id),
            $u->id,
            $group->members()->pluck('users.id')->all(),
        );
        $messages->each(function ($message) {
            $message->setAttribute('attachment_preview', NoteFileController::previewType($message->attachment_path));
            $message->replies->each(fn ($reply) => $reply->setAttribute(
                'attachment_preview',
                NoteFileController::previewType($reply->attachment_path),
            ));
        });

        return Inertia::render('Groups/Show', [
            'group' => $group->load('owner:id,name'),
            'isGroupAdmin' => $group->isGroupAdmin($u),
            'rating' => [
                'avg' => round((float) $group->ratings()->avg('stars'), 1),
                'count' => $group->ratings()->count(),
                'mine' => $group->ratings()->where('user_id', $u->id)->first(['stars', 'comment']),
                'recent' => $group->ratings()->with('user:id,name')->latest()->limit(5)->get(['id', 'user_id', 'stars', 'comment', 'created_at']),
            ],
            'members' => $group->members()->select('users.id', 'users.name', 'users.avatar', 'users.bio')->get()
                ->each(fn ($m) => $m->setAttribute('circle_role', $m->pivot->role))
                ->each->append('avatar_url'),
            'messages' => $messages,
            'modules' => $group->files()->where('kind', 'module')->with('user:id,name')->latest()->get()
                ->each(fn ($file) => $file->setAttribute('preview', NoteFileController::previewType($file->path))),
            'tasks' => Task::where('study_group_id', $group->id)->with('assignees')->withCount('comments')->latest()->get(),
            'events' => Schedule::visibleTo($u)->where('study_group_id', $group->id)->with(['user:id,name,avatar', 'attendees:id,name,avatar'])->orderBy('starts_at')->get(),
        ]);
    }

    public function update(Request $request, StudyGroup $group) {
        abort_unless($group->isGroupAdmin($request->user()), 403);
        $group->update($request->validate([
            'title' => 'required|string|max:120', 'topic' => 'required|string|max:120',
            'description' => 'nullable|string|max:2000', 'target_date' => 'nullable|date',
        ]));
        return back()->with('success', 'Circle updated.');
    }

    public function destroy(Request $request, StudyGroup $group) {
        abort_unless($group->owner_id === $request->user()->id, 403);
        $group->delete();
        return to_route('groups.index')->with('success', 'Circle deleted.');
    }

    public function join(Request $request, StudyGroup $group) {
        $u = $request->user();
        if ($group->hasMember($u)) return to_route('groups.show', $group);
        abort_if($group->members()->count() >= $group->max_members, 422, 'This circle is full.');
        $group->members()->attach($u->id, ['role' => 'member']);
        $group->owner->notify(new StudyHubNotice("{$u->name} joined {$group->title}", route('groups.show', $group, false)));
        return to_route('groups.show', $group)->with('success', 'Welcome to the circle!');
    }

    public function leave(Request $request, StudyGroup $group) {
        abort_if($group->owner_id === $request->user()->id, 422, 'Owners must delete the circle or transfer it first.');
        $group->members()->detach($request->user()->id);
        return to_route('groups.index')->with('success', 'You left the circle.');
    }
}
