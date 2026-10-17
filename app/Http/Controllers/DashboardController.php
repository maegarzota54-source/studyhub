<?php
namespace App\Http\Controllers;

use App\Models\{Schedule, StudySession, Task};
use Illuminate\Http\Request;
use Inertia\Inertia;

class DashboardController extends Controller
{
    /** Hours of study the weekly goal ring aims for. Change it here. */
    public const WEEKLY_GOAL_HOURS = 10;

    public function index(Request $request)
    {
        $u = $request->user();

        // ---- study minutes per day (last 7 days) ----
        $perDay = StudySession::where('user_id', $u->id)
            ->where('studied_on', '>=', now()->subDays(6)->toDateString())
            ->get(['studied_on', 'minutes'])
            ->groupBy(fn ($s) => $s->studied_on->toDateString())
            ->map(fn ($g) => $g->sum('minutes'));

        $chart = collect(range(6, 0))->map(function ($i) use ($perDay) {
            $d = now()->subDays($i);
            return [
                'day' => $d->format('D'),
                'date' => $d->format('M j'),
                'hours' => round(($perDay[$d->toDateString()] ?? 0) / 60, 2),
                'today' => $i === 0,
            ];
        })->values();

        // ---- streak: consecutive days with at least one logged session ----
        $dates = StudySession::where('user_id', $u->id)
            ->where('studied_on', '>=', now()->subDays(90)->toDateString())
            ->pluck('studied_on')->map(fn ($d) => $d->toDateString())->unique()->flip();
        $cursor = now();
        if (!isset($dates[$cursor->toDateString()])) $cursor = $cursor->subDay();
        $streak = 0;
        while (isset($dates[$cursor->toDateString()])) { $streak++; $cursor = $cursor->subDay(); }

        $weekStart = now()->startOfWeek();
        $weekMinutes = StudySession::where('user_id', $u->id)->where('studied_on', '>=', $weekStart->toDateString())->sum('minutes');

        return Inertia::render('Dashboard', [
            'stats' => [
                'groups' => $u->groups()->count(),
                'upcoming' => Schedule::visibleTo($u)->where('starts_at', '>=', now())->count(),
                'tasks_due' => Task::where('assignee_id', $u->id)->where('status', 'pending')->count(),
                'hours_week' => round($weekMinutes / 60, 1),
                'tasks_done_week' => Task::where('assignee_id', $u->id)->where('status', 'completed')->where('updated_at', '>=', $weekStart)->count(),
            ],
            'weeklyGoal' => self::WEEKLY_GOAL_HOURS,
            'streak' => $streak,
            'chart' => $chart,
            'groups' => $u->groups()->withCount('members')->limit(6)->get(),
            'sessions' => Schedule::visibleTo($u)->with('group:id,title')->where('starts_at', '>=', now())->orderBy('starts_at')->limit(5)->get(),
            'tasks' => Task::where('assignee_id', $u->id)->where('status', 'pending')->with('group:id,title')
                ->orderByRaw('due_date is null')->orderBy('due_date')->limit(6)->get(['id', 'title', 'due_date', 'study_group_id']),
            'notifications' => $u->notifications()->limit(5)->get()->map(fn ($n) => [
                'id' => $n->id, 'message' => $n->data['message'] ?? '', 'url' => $n->data['url'] ?? null,
                'read' => (bool) $n->read_at, 'ago' => $n->created_at->diffForHumans()]),
        ]);
    }
}