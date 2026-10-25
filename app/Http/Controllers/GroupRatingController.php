<?php
namespace App\Http\Controllers;

use App\Models\{GroupRating, StudyGroup};
use App\Notifications\StudyHubNotice;
use Illuminate\Http\Request;

/** Group ratings: only circle members can rate, once each (re-rating updates the old score). */
class GroupRatingController extends Controller
{
    public function store(Request $request, StudyGroup $group) {
        $u = $request->user();
        abort_unless($group->hasMember($u), 403, 'Only members can rate this circle.');
        $d = $request->validate(['stars' => 'required|integer|min:1|max:5', 'comment' => 'nullable|string|max:500']);
        $rating = GroupRating::updateOrCreate(['study_group_id' => $group->id, 'user_id' => $u->id], $d);
        if ($rating->wasRecentlyCreated && $group->owner_id !== $u->id) {
            $group->owner->notify(new StudyHubNotice("{$u->name} rated {$group->title} {$d['stars']}/5", route('groups.show', $group, false)));
        }
        return back()->with('success', 'Thanks for rating this circle.');
    }
}
