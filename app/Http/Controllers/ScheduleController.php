<?php
namespace App\Http\Controllers;

use App\Models\{Schedule, StudyGroup};
use App\Notifications\StudyHubNotice;
use Illuminate\Http\Request;
use Inertia\Inertia;

class ScheduleController extends Controller
{
    public function index(Request $request) {
        $u = $request->user();
        $month = \Carbon\Carbon::parse($request->month ?? now())->startOfMonth();
        $events = Schedule::visibleTo($u)->with(['group:id,title', 'attendees:id,name,avatar', 'user:id,name,avatar'])
            ->whereBetween('starts_at', [$month->copy()->startOfWeek(), $month->copy()->endOfMonth()->endOfWeek()])
            ->orderBy('starts_at')->get();
        Schedule::flagCompletable($events, $u);
        return Inertia::render('Schedule/Index', [
            'month' => $month->format('Y-m'),
            'events' => $events,
            'groups' => $u->groups()->with('members:id,name,avatar')->get(['study_groups.id', 'title']),
        ]);
    }

    public function store(Request $request) {
        $u = $request->user();
        $d = $request->validate([
            'title' => 'required|string|max:150', 'description' => 'nullable|string|max:1000',
            'starts_at' => 'required|date', 'ends_at' => 'nullable|date|after:starts_at',
            'study_group_id' => 'nullable|exists:study_groups,id',
            'visibility' => 'required|in:public,private,specific',
            'attendees' => 'array', 'attendees.*' => 'exists:users,id',
        ]);
        $group = !empty($d['study_group_id']) ? StudyGroup::find($d['study_group_id']) : null;
        abort_if($group && !$group->hasMember($u), 403);
        abort_if($d['visibility'] === 'public' && !$group, 422, 'Public events need a study circle.');

        $event = Schedule::create(collect($d)->except('attendees')->all() + ['user_id' => $u->id]);
        if ($d['visibility'] === 'specific' && $group) {
            $ids = $group->members()->whereIn('users.id', $d['attendees'] ?? [])->pluck('users.id'); // only circle members
            $event->attendees()->sync($ids);
        }
        $recipients = match ($d['visibility']) {
            'public' => $group->members()->where('users.id', '!=', $u->id)->get(),
            'specific' => $event->attendees()->where('users.id', '!=', $u->id)->get(),
            default => collect(),
        };
        foreach ($recipients as $r) $r->notify(new StudyHubNotice("New session: {$event->title}", '/schedule'));
        return back()->with('success', 'Added to the schedule.');
    }

    /** Mark a study session as completed (or reopen it). Only the host, a circle admin or a site admin. */
    public function complete(Request $request, Schedule $schedule) {
        $u = $request->user();
        abort_unless(Schedule::visibleTo($u)->whereKey($schedule->id)->exists() && $schedule->canComplete($u), 403);
        $done = $schedule->completed_at === null;
        $schedule->forceFill(['completed_at' => $done ? now() : null, 'completed_by' => $done ? $u->id : null])->save();
        return back()->with('success', $done ? 'Session marked as completed.' : 'Session reopened.');
    }

    public function destroy(Request $request, Schedule $schedule) {
        abort_unless($schedule->user_id === $request->user()->id || $request->user()->isAdmin(), 403);
        $schedule->delete();
        return back();
    }
}
