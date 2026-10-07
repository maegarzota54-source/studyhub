<?php
namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

/**
 * Phase 3: member directory (who is active / offline) and the presence heartbeat behind it.
 * A person is "active" if their browser pinged us in the last ~90 seconds. This works without Reverb/websockets.
 */
class MemberController extends Controller
{
    private const ACTIVE_SECONDS = 90;

    /** Ids of everyone this user may see: students who share a circle with them (admins see everyone). */
    private function visibleIds(User $u) {
        if ($u->isAdmin()) return User::where('id', '!=', $u->id)->pluck('id');
        $groupIds = $u->groups()->pluck('study_groups.id');
        return DB::table('group_members')->whereIn('study_group_id', $groupIds)
            ->where('user_id', '!=', $u->id)->distinct()->pluck('user_id');
    }

    private function onlineIds(User $u) {
        return User::whereIn('id', $this->visibleIds($u))
            ->where('last_seen_at', '>=', now()->subSeconds(self::ACTIVE_SECONDS))->pluck('id')->push($u->id)->values();
    }

    public function index(Request $request) {
        $u = $request->user();
        $myGroupIds = $u->groups()->pluck('study_groups.id');
        $members = User::whereIn('id', $this->visibleIds($u))->where('is_suspended', false)
            ->orderBy('name')->get(['id', 'name', 'avatar', 'bio', 'last_seen_at']);

        // Circles each member shares with me, for the little chips on each card.
        $shared = DB::table('group_members')
            ->join('study_groups', 'study_groups.id', '=', 'group_members.study_group_id')
            ->whereIn('group_members.user_id', $members->pluck('id'))
            ->whereIn('group_members.study_group_id', $myGroupIds)
            ->get(['group_members.user_id', 'study_groups.id as gid', 'study_groups.title'])
            ->groupBy('user_id');

        return Inertia::render('Members/Index', [
            'members' => $members->map(fn (User $m) => [
                'id' => $m->id, 'name' => $m->name, 'bio' => $m->bio, 'avatar_url' => $m->avatar_url,
                'online' => (bool) $m->last_seen_at?->gt(now()->subSeconds(self::ACTIVE_SECONDS)),
                'last_seen' => $m->last_seen_at?->diffForHumans(),
                'circles' => ($shared[$m->id] ?? collect())->map(fn ($g) => ['id' => $g->gid, 'title' => $g->title])->values(),
            ])->values(),
            'groups' => $u->groups()->get(['study_groups.id', 'title']),
        ]);
    }

    /** Called by every open page every ~30s: records "I'm here" and returns who else is here. */
    public function ping(Request $request) {
        $u = $request->user();
        $u->forceFill(['last_seen_at' => now()])->saveQuietly();
        return response()->json(['online' => $this->onlineIds($u)]);
    }
}
