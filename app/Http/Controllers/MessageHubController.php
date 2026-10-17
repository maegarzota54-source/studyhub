<?php
namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Inertia\Response;

/**
 * Wraps your existing MessageController@index (direct messages) and adds the study groups,
 * so the Messages page can list every circle with its picture and open a group chat.
 */
class MessageHubController extends Controller
{
    public function index(Request $request) {
        $u = $request->user();
        $response = app(MessageController::class)->index($request);   // your existing DM data stays as it is

        $groups = $u->groups()->withCount('members')->orderBy('study_groups.title')->get();
        $extra = ['groups' => $groups, 'group' => null, 'groupMembers' => []];

        if ($request->filled('group') && ($g = $groups->firstWhere('id', (int) $request->group))) {
            $extra['group'] = $g;
            $extra['groupMembers'] = $g->members()->get(['users.id', 'users.name', 'users.avatar'])->values();
            $extra['peer'] = null;
            $extra['messages'] = $g->messages()->whereNull('parent_id')
                ->with('sender:id,name,avatar')
                ->with(['replies' => fn ($q) => $q->with('sender:id,name,avatar')])
                ->latest()->limit(100)->get()->reverse()->values();
        }
        return $response instanceof Response ? $response->with($extra) : $response;
    }
}
