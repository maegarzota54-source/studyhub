<?php
namespace App\Http\Controllers;

use App\Models\Schedule;
use App\Support\IcsBuilder;
use Illuminate\Http\Request;

class ScheduleExportController extends Controller
{
    /** Every session this student can see (public circle sessions, their own, ones shared with them). */
    public function ics(Request $request) {
        $events = Schedule::visibleTo($request->user())->with('group:id,title')
            ->where('starts_at', '>=', now()->subDays(30))->orderBy('starts_at')->limit(500)->get()
            ->map(fn ($e) => [
                'uid' => "schedule-{$e->id}@studyhub",
                'title' => $e->title,
                'description' => trim(($e->group ? "Circle: {$e->group->title}\n" : '').($e->description ?? '')),
                'start' => $e->starts_at, 'end' => $e->ends_at,
            ])->all();
        return response(IcsBuilder::build($events), 200, [
            'Content-Type' => 'text/calendar; charset=utf-8',
            'Content-Disposition' => 'attachment; filename="studyhub-schedule.ics"',
        ]);
    }
}
