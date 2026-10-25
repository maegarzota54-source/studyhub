<?php
namespace App\Http\Controllers;

use App\Models\{StudyGroup, User};
use App\Notifications\StudyHubNotice;
use Illuminate\Http\Request;

/** Managing members: invite, promote/demote, remove. Only circle admins (or site admins) may do this. */
class GroupMemberController extends Controller
{
    private function authorizeManage(Request $request, StudyGroup $group): void {
        abort_unless($group->isGroupAdmin($request->user()), 403, 'Only circle admins can manage members.');
    }

    public function invite(Request $request, StudyGroup $group) {
        $this->authorizeManage($request, $group);
        $d = $request->validate(['email' => 'required|email']);
        $target = User::where('email', $d['email'])->where('is_suspended', false)->first();
        if (!$target) return back()->withErrors(['email' => 'No active StudyHub account uses that email.']);
        if ($group->hasMember($target)) return back()->withErrors(['email' => "{$target->name} is already a member."]);
        abort_if($group->members()->count() >= $group->max_members, 422, 'This circle is full.');
        $target->notify(new StudyHubNotice("{$request->user()->name} invited you to join {$group->title}", route('groups.find', [], false).'?q='.urlencode($group->title)));
        return back()->with('success', "Invitation sent to {$target->name}.");
    }

    public function setRole(Request $request, StudyGroup $group, User $user) {
        $this->authorizeManage($request, $group);
        $d = $request->validate(['role' => 'required|in:admin,member']);
        abort_unless($group->hasMember($user), 404);
        abort_if($user->id === $group->owner_id, 422, 'The owner is always an admin.');
        $group->members()->updateExistingPivot($user->id, ['role' => $d['role']]);
        return back()->with('success', "{$user->name} is now a circle ".($d['role'] === 'admin' ? 'admin.' : 'member.'));
    }

    public function remove(Request $request, StudyGroup $group, User $user) {
        $this->authorizeManage($request, $group);
        abort_unless($group->hasMember($user), 404);
        abort_if($user->id === $group->owner_id, 422, 'The owner cannot be removed.');
        $group->members()->detach($user->id);
        $user->notify(new StudyHubNotice("You were removed from {$group->title}", '/groups'));
        return back()->with('success', "{$user->name} was removed from the circle.");
    }
}
