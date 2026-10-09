<?php
namespace App\Http\Controllers;

use App\Models\{Message, NoteFile, Schedule, StudyGroup, Task};
use App\Notifications\StudyHubNotice;
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
            ->when($request->q, fn ($q, $s) => $q->where(fn ($w) => $w->where('title', 'like', "%$s%")->orWhere('topic', 'like', "%$s%")))
            ->when($request->skill_level, fn ($q, $v) => $q->where('skill_level', $v))
            ->when($request->mode, fn ($q, $v) => $q->where('mode', $v))
            ->latest()->paginate(12)->withQueryString();
        return Inertia::render('Groups/Index', ['mode' => 'find', 'groups' => $groups, 'filters' => $request->only('q', 'skill_level', 'mode')]);
    }

    public function store(Request $request) {
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

        $messages = $group->messages()->whereNull('parent_id')->with(['sender:id,name,avatar', 'task'])
            ->with(['replies' => fn ($q) => $q->with('sender:id,name,avatar')->withExists('savedFiles as saved')])->withExists('savedFiles as saved') // see Message::replies below
            ->latest()->limit(100)->get()->reverse()->values();

        return Inertia::render('Groups/Show', [
            'group' => $group->load('owner:id,name'),
            'isGroupAdmin' => $group->isGroupAdmin($u),
            'members' => $group->members()->select('users.id', 'users.name', 'users.avatar', 'users.bio')->get()
                ->each->append('avatar_url'),
            'messages' => $messages,
            'modules' => $group->files()->where('kind', 'module')->with('user:id,name')->latest()->get(),
            'tasks' => Task::where('study_group_id', $group->id)->with('assignees')->withCount('comments')->latest()->get(),
            'events' => Schedule::visibleTo($u)->where('study_group_id', $group->id)->orderBy('starts_at')->get(),
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
