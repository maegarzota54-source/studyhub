<?php
namespace App\Http\Controllers;

use App\Support\ChatReadReceipts;
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
            $extra['messages'] = $g->messages()->whereNull('parent_id')->visibleTo($u)
                ->with(['sender:id,name,avatar', 'reactions:id,name'])
                ->with(['replies' => fn ($q) => $q->visibleTo($u)->with(['sender:id,name,avatar', 'reactions:id,name'])])
                ->latest()->limit(100)->get()->reverse()->values();
            ChatReadReceipts::attach(
                $extra['messages'],
                ChatReadReceipts::groupKey($g->id),
                $u->id,
                $extra['groupMembers']->pluck('id')->all(),
            );
            $extra['messages']->each(function ($message) {
                $message->setAttribute('attachment_preview', NoteFileController::previewType($message->attachment_path));
                $message->replies->each(fn ($reply) => $reply->setAttribute(
                    'attachment_preview',
                    NoteFileController::previewType($reply->attachment_path),
                ));
            });
        }
        return $response instanceof Response ? $response->with($extra) : $response;
    }
}
