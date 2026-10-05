<?php
namespace App\Http\Controllers;

use App\Models\{StudyGroup, Task};
use App\Notifications\StudyHubNotice;
use Illuminate\Http\Request;
use Inertia\Inertia;

class TaskController extends Controller
{
    public function index(Request $request) {
        $u = $request->user();
        return Inertia::render('Tasks/Index', [
            'tasks' => Task::visibleTo($u)->with(['assignee:id,name', 'group:id,title', 'comments'])
                ->orderByRaw("status = 'completed'")->orderBy('due_date')->get(),
            'groups' => $u->groups()->with('members:id,name')->get(['study_groups.id', 'title']),
        ]);
    }

    public function store(Request $request) {
        $u = $request->user();
        $d = $request->validate([
            'title' => 'required|string|max:150', 'description' => 'nullable|string|max:2000',
            'due_date' => 'nullable|date', 'study_group_id' => 'nullable|exists:study_groups,id',
            'assignee_id' => 'nullable|exists:users,id',
        ]);
        if (!empty($d['study_group_id'])) {
            $g = StudyGroup::find($d['study_group_id']);
            abort_unless($g->hasMember($u), 403);
            if (!empty($d['assignee_id'])) abort_unless($g->hasMember(\App\Models\User::find($d['assignee_id'])), 422, 'Assignee must be in the circle.');
        } else {
            $d['assignee_id'] = $u->id; // personal task
        }
        $task = Task::create($d + ['created_by' => $u->id]);
        if ($task->assignee_id && $task->assignee_id !== $u->id)
            $task->assignee->notify(new StudyHubNotice("{$u->name} assigned you: {$task->title}", '/tasks'));
        return back()->with('success', 'Task added.');
    }

    private function canEdit(Request $request, Task $task): bool {
        $u = $request->user();
        return in_array($u->id, [$task->created_by, $task->assignee_id]) || ($task->group && $task->group->isGroupAdmin($u));
    }

    public function update(Request $request, Task $task) {
        abort_unless($this->canEdit($request, $task), 403);
        $task->update($request->validate(['status' => 'sometimes|in:pending,completed', 'title' => 'sometimes|string|max:150',
            'due_date' => 'sometimes|nullable|date', 'description' => 'sometimes|nullable|string|max:2000']));
        return back();
    }

    public function destroy(Request $request, Task $task) {
        abort_unless($task->created_by === $request->user()->id || ($task->group && $task->group->isGroupAdmin($request->user())), 403);
        $task->delete();
        return back();
    }

    public function comment(Request $request, Task $task) {
        abort_unless(Task::visibleTo($request->user())->whereKey($task->id)->exists(), 403);
        $task->comments()->create(['user_id' => $request->user()->id] + $request->validate(['body' => 'required|string|max:1000']));
        return back();
    }
}
