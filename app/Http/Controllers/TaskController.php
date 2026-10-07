<?php
namespace App\Http\Controllers;

use App\Events\MessageSent;
use App\Models\{Message, StudyGroup, Task, TaskComment, User};
use App\Notifications\StudyHubNotice;
use Illuminate\Http\Request;
use Inertia\Inertia;

class TaskController extends Controller
{
    private function url(Task $t): string { return route('tasks.show', $t->id, false); }

    /** Keep only ids that are really in the circle (or just the user, for a personal task). */
    private function cleanAssignees(?StudyGroup $g, User $me, array $ids): array {
        if (!$g) return [$me->id];
        $ok = $g->members()->whereIn('users.id', $ids)->pluck('users.id')->all();
        return $ok;
    }

    private function notifyAssigned(Task $task, User $by, array $userIds): void {
        User::whereIn('id', $userIds)->where('id', '!=', $by->id)->get()
            ->each->notify(new StudyHubNotice("{$by->name} assigned you: {$task->title}", $this->url($task)));
    }

    /** Post the task into the circle's chat as a clickable card. */
    private function postToChat(Task $task, User $by): void {
        if (!$task->study_group_id) return;
        $m = Message::create(['sender_id' => $by->id, 'study_group_id' => $task->study_group_id, 'task_id' => $task->id,
            'kind' => 'message', 'body' => "📌 Shared a task: {$task->title}"]);
        broadcast(new MessageSent($m))->toOthers();
    }

    public function index(Request $request) {
        $u = $request->user();
        return Inertia::render('Tasks/Index', [
            'tasks' => Task::visibleTo($u)->with(['assignees', 'group:id,title'])->withCount('comments')
                ->orderByRaw("status = 'completed'")->orderBy('due_date')->get()
                ->each(fn ($t) => $t->assignees->each->append('avatar_url')),
            'groups' => $u->groups()->with('members:users.id,users.name')->get(['study_groups.id', 'title']),
        ]);
    }

    public function show(Request $request, Task $task) {
        $u = $request->user();
        abort_unless(Task::visibleTo($u)->whereKey($task->id)->exists() || $u->isAdmin(), 403);
        $task->load(['creator:id,name,avatar', 'assignees', 'group:id,title', 'comments']);
        $task->assignees->each->append('avatar_url');
        $task->creator->append('avatar_url');
        $task->comments->each(fn ($c) => $c->user->append('avatar_url'));
        return Inertia::render('Tasks/Show', [
            'task' => $task,
            'canManage' => $task->canManage($u),
            'canEdit' => $task->canEdit($u),
            'members' => $task->group ? $task->group->members()->select('users.id', 'users.name')->get() : [],
            'groups' => $u->groups()->get(['study_groups.id', 'title']),
        ]);
    }

    public function store(Request $request) {
        $u = $request->user();
        $d = $request->validate([
            'title' => 'required|string|max:150', 'description' => 'nullable|string|max:2000',
            'due_date' => 'nullable|date', 'study_group_id' => 'nullable|exists:study_groups,id',
            'assignee_ids' => 'nullable|array', 'assignee_ids.*' => 'integer|exists:users,id',
            'post_to_chat' => 'nullable|boolean',
        ]);
        $g = !empty($d['study_group_id']) ? StudyGroup::find($d['study_group_id']) : null;
        if ($g) abort_unless($g->hasMember($u), 403);
        $ids = $this->cleanAssignees($g, $u, $d['assignee_ids'] ?? []);
        $task = Task::create([
            'title' => $d['title'], 'description' => $d['description'] ?? null, 'due_date' => $d['due_date'] ?? null,
            'study_group_id' => $g?->id, 'created_by' => $u->id,
        ]);
        $task->assignees()->sync($ids);
        $this->notifyAssigned($task, $u, $ids);
        if ($g && ($d['post_to_chat'] ?? false)) $this->postToChat($task, $u);
        return back()->with('success', 'Task added.');
    }

    public function update(Request $request, Task $task) {
        $u = $request->user();
        abort_unless($task->canEdit($u), 403);
        $d = $request->validate([
            'status' => 'sometimes|in:pending,completed',
            'title' => 'sometimes|string|max:150', 'due_date' => 'sometimes|nullable|date',
            'description' => 'sometimes|nullable|string|max:2000',
            'assignee_ids' => 'sometimes|array', 'assignee_ids.*' => 'integer|exists:users,id',
        ]);
        // assignees ticking a task off is fine; changing details or people is for the creator / circle admins
        abort_if(array_diff_key($d, ['status' => 1]) && !$task->canManage($u), 403);
        if (array_key_exists('assignee_ids', $d)) {
            $ids = $this->cleanAssignees($task->group, $task->creator, $d['assignee_ids']);
            $new = array_diff($ids, $task->assignees()->pluck('users.id')->all());
            $task->assignees()->sync($ids);
            $this->notifyAssigned($task, $u, $new);
            unset($d['assignee_ids']);
        }
        if (($d['status'] ?? null) === 'completed' && $task->status !== 'completed' && $task->created_by !== $u->id)
            $task->creator->notify(new StudyHubNotice("{$u->name} completed: {$task->title}", $this->url($task)));
        $task->update($d);
        return back();
    }

    /** Post / share a task into one of your circles (a personal task becomes that circle's task). */
    public function share(Request $request, Task $task) {
        $u = $request->user();
        abort_unless($task->canManage($u), 403);
        $d = $request->validate(['study_group_id' => 'required|exists:study_groups,id']);
        $g = StudyGroup::find($d['study_group_id']);
        abort_unless($g->hasMember($u), 403);
        abort_if($task->study_group_id && $task->study_group_id !== $g->id, 422, 'This task already belongs to another circle.');
        $task->update(['study_group_id' => $g->id]);
        $this->postToChat($task, $u);
        return back()->with('success', "Shared to {$g->title}.");
    }

    public function destroy(Request $request, Task $task) {
        abort_unless($task->canManage($request->user()), 403);
        $task->delete();
        return to_route('tasks.index')->with('success', 'Task deleted.');
    }

    public function comment(Request $request, Task $task) {
        $u = $request->user();
        abort_unless(Task::visibleTo($u)->whereKey($task->id)->exists(), 403);
        $task->comments()->create(['user_id' => $u->id] + $request->validate(['body' => 'required|string|max:1000']));
        // tell the creator, assigned members, and earlier commenters
        $ids = $task->assignees()->pluck('users.id')->push($task->created_by)->merge($task->comments()->pluck('user_id'))
            ->unique()->reject(fn ($id) => $id === $u->id);
        User::whereIn('id', $ids)->get()->each->notify(new StudyHubNotice("{$u->name} commented on: {$task->title}", $this->url($task)));
        return back();
    }

    public function destroyComment(Request $request, Task $task, TaskComment $comment) {
        abort_unless($comment->task_id === $task->id, 404);
        abort_unless($comment->user_id === $request->user()->id || $task->canManage($request->user()), 403);
        $comment->delete();
        return back();
    }
}
