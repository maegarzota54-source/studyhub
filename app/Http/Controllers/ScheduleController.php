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
        return Inertia::render('Schedule/Index', [
            'month' => $month->format('Y-m'),
            'events' => Schedule::visibleTo($u)->with(['group:id,title', 'attendees:id,name'])
                ->whereBetween('starts_at', [$month->copy()->startOfWeek(), $month->copy()->endOfMonth()->endOfWeek()])
                ->orderBy('starts_at')->get(),
            'groups' => $u->groups()->with('members:id,name')->get(['study_groups.id', 'title']),
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

    public function destroy(Request $request, Schedule $schedule) {
        abort_unless($schedule->user_id === $request->user()->id || $request->user()->isAdmin(), 403);
        $schedule->delete();
        return back();
    }
}
