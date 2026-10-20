<?php
namespace App\Http\Controllers;

use App\Models\{StudyGroup, StudySession};
use Illuminate\Http\Request;
use Inertia\Inertia;

class ProgressController extends Controller
{
    public function index(Request $request) {
        $u = $request->user();
        $days = collect(range(6, 0))->map(fn ($i) => now()->subDays($i)->toDateString());
        $perDay = StudySession::where('user_id', $u->id)->where('studied_on', '>=', $days->first())
            ->selectRaw('studied_on, SUM(minutes) as m')->groupBy('studied_on')->pluck('m', 'studied_on');
        $weekStart = now()->startOfWeek()->toDateString();

        return Inertia::render('Progress/Index', [
            'daily' => $days->map(fn ($d) => ['day' => \Carbon\Carbon::parse($d)->format('D'), 'hours' => round(($perDay[$d] ?? 0) / 60, 2)])->values(),
            'weekHours' => round(StudySession::where('user_id', $u->id)->where('studied_on', '>=', $weekStart)->sum('minutes') / 60, 1),
            'totalHours' => round(StudySession::where('user_id', $u->id)->sum('minutes') / 60, 1),
            'groupBoards' => $u->groups()->get(['study_groups.id', 'title'])->map(fn (StudyGroup $g) => [
                'id' => $g->id, 'title' => $g->title,
                'members' => $g->members()->get(['users.id', 'users.name'])->map(fn ($m) => [
                    'name' => $m->name,
                    'hours' => round(StudySession::where('user_id', $m->id)->where('study_group_id', $g->id)->where('studied_on', '>=', $weekStart)->sum('minutes') / 60, 1),
                ])->sortByDesc('hours')->values()]),
            'recent' => StudySession::where('user_id', $u->id)->with('group:id,title')->latest('studied_on')->latest('id')->limit(8)->get(),
            'groups' => $u->groups()->get(['study_groups.id', 'title']),
        ]);
    }

    /** Used by both manual logging and the auto-timer (which posts elapsed minutes on stop). */
    public function store(Request $request) {
        $d = $request->validate(['minutes' => 'required|integer|min:1|max:1440', 'topic' => 'nullable|string|max:120',
            'study_group_id' => 'nullable|exists:study_groups,id', 'studied_on' => 'nullable|date|before_or_equal:today']);
        if (!empty($d['study_group_id'])) abort_unless(StudyGroup::find($d['study_group_id'])->hasMember($request->user()), 403);
        StudySession::create($d + ['user_id' => $request->user()->id, 'studied_on' => $d['studied_on'] ?? today()]);
        return back()->with('success', 'Study time logged.');
    }
}
