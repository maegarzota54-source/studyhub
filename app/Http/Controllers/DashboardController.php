<?php
namespace App\Http\Controllers;

use App\Models\{Schedule, StudySession, Task};
use Illuminate\Http\Request;
use Inertia\Inertia;

class DashboardController extends Controller
{
    public function index(Request $request) {
        $u = $request->user();
        return Inertia::render('Dashboard', [
            'stats' => [
                'groups' => $u->groups()->count(),
                'upcoming' => Schedule::visibleTo($u)->where('starts_at', '>=', now())->count(),
                'tasks_due' => Task::visibleTo($u)->where('status', 'pending')->where('assignee_id', $u->id)->count(),
                'hours_week' => round(StudySession::where('user_id', $u->id)->where('studied_on', '>=', now()->startOfWeek())->sum('minutes') / 60, 1),
            ],
            'sessions' => Schedule::visibleTo($u)->with('group:id,title')->where('starts_at', '>=', now())->orderBy('starts_at')->limit(5)->get(),
            'notifications' => $u->notifications()->limit(5)->get()->map(fn ($n) => [
                'id' => $n->id, 'message' => $n->data['message'] ?? '', 'url' => $n->data['url'] ?? null,
                'read' => (bool) $n->read_at, 'ago' => $n->created_at->diffForHumans()]),
        ]);
    }
}
