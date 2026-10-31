<?php
namespace App\Http\Controllers;

use App\Events\MessageSent;
use App\Models\{Message, NoteFile, StudyGroup, User};
use App\Notifications\StudyHubNotice;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\{DB, Storage};
use Illuminate\Support\Str;

/** Edit, forward, share files from Notes & Files, load older messages, search a conversation. */
class MessageActionsController extends Controller
{
    private function canView(Message $m, User $u): bool {
        return $m->study_group_id
            ? ($m->group->hasMember($u) || $u->isAdmin())
            : in_array($u->id, [$m->sender_id, $m->recipient_id], true);
    }

    /** Two students may chat directly when they share at least one circle (same rule as the Messages page). */
    private function shares(int $a, int $b): bool {
        return DB::table('group_members as x')->join('group_members as y', 'x.study_group_id', '=', 'y.study_group_id')
            ->where('x.user_id', $a)->where('y.user_id', $b)->exists();
    }

    private function push(Message $m): void {
        try { broadcast(new MessageSent($m))->toOthers(); } catch (\Throwable $e) { report($e); }   // live push is optional
    }

    private function copyFile(?string $path, ?string $name): ?string {
        if (!$path || !Storage::exists($path)) return null;
        $ext = pathinfo((string) ($name ?: $path), PATHINFO_EXTENSION);
        $new = 'attachments/'.Str::uuid().($ext ? ".$ext" : '');
        Storage::copy($path, $new);
        return $new;
    }

    // ------------------------------------------------------------------ edit
    public function update(Request $request, Message $message) {
        abort_unless($message->sender_id === $request->user()->id, 403, 'You can only edit your own messages.');
        $d = $request->validate(['body' => 'required|string|max:5000']);
        $message->forceFill(['body' => $d['body'], 'edited_at' => now()])->save();
        $this->push($message);
        return back();
    }

    // ------------------------------------------------------------------ forward
    public function targets(Request $request) {
        $u = $request->user();
        $groups = $u->groups()->orderBy('study_groups.title')->get()
            ->map(fn ($g) => ['id' => $g->id, 'title' => $g->title, 'cover_url' => $g->cover_url ?? null])->values();
        $ids = DB::table('group_members')->whereIn('study_group_id', $u->groups()->pluck('study_groups.id'))
            ->pluck('user_id')->unique()->reject(fn ($id) => (int) $id === $u->id);
        $people = User::whereIn('id', $ids)->orderBy('name')->get(['id', 'name', 'avatar'])
            ->map(fn ($p) => ['id' => $p->id, 'name' => $p->name, 'avatar_url' => $p->avatar_url])->values();
        return response()->json(['groups' => $groups, 'people' => $people]);
    }

    private function copyTo(Message $src, User $by, array $dest): Message {
        $m = new Message($dest + [
            'sender_id' => $by->id, 'kind' => 'message', 'body' => $src->body,
            'forwarded_from' => $src->forwarded_from ?: ($src->sender->name ?? null),
        ]);
        if ($new = $this->copyFile($src->attachment_path, $src->attachment_name)) {
            $m->attachment_path = $new; $m->attachment_name = $src->attachment_name;
            $m->attachment_mime = $src->attachment_mime; $m->attachment_size = $src->attachment_size;
        }
        $m->save();
        return $m;
    }

    public function forward(Request $request, Message $message) {
        $u = $request->user();
        abort_unless($this->canView($message, $u), 403);
        $d = $request->validate(['groups' => 'array|max:10', 'groups.*' => 'integer', 'users' => 'array|max:10', 'users.*' => 'integer']);
        $groupIds = collect($d['groups'] ?? [])->unique(); $userIds = collect($d['users'] ?? [])->unique();
        abort_if($groupIds->isEmpty() && $userIds->isEmpty(), 422, 'Choose at least one chat.');

        $message->loadMissing('sender:id,name');
        $count = 0;
        foreach ($groupIds as $gid) {
            $g = StudyGroup::find($gid);
            if (!$g || !$g->hasMember($u)) continue;
            $this->push($this->copyTo($message, $u, ['study_group_id' => $g->id])); $count++;
        }
        foreach ($userIds as $uid) {
            $to = User::find($uid);
            if (!$to || $to->id === $u->id || !$this->shares($u->id, $to->id)) continue;
            $this->push($this->copyTo($message, $u, ['recipient_id' => $to->id]));
            $to->notify(new StudyHubNotice("{$u->name} forwarded you a message", route('messages.index', ['user_id' => $u->id], false)));
            $count++;
        }
        return back()->with('success', $count ? "Forwarded to $count chat".($count > 1 ? 's' : '').'.' : 'Nothing was forwarded.');
    }

    // ------------------------------------------------------------------ share a file from Notes & Files
    public function files(Request $request) {
        return response()->json(NoteFile::visibleTo($request->user())->whereNotNull('path')->with('group:id,title')
            ->latest()->limit(100)->get(['id', 'title', 'kind', 'size', 'study_group_id'])
            ->map(fn ($f) => ['id' => $f->id, 'title' => $f->title, 'kind' => $f->kind, 'size' => $f->size, 'group' => $f->group->title ?? 'Personal'])->values());
    }

    public function shareFile(Request $request) {
        $u = $request->user();
        $d = $request->validate(['note_file_id' => 'required|integer', 'group_id' => 'nullable|integer', 'user_id' => 'nullable|integer']);
        abort_if(empty($d['group_id']) === empty($d['user_id']), 422, 'Choose exactly one chat.');

        $file = NoteFile::visibleTo($u)->whereNotNull('path')->findOrFail($d['note_file_id']);
        if (!empty($d['group_id'])) {
            $g = StudyGroup::findOrFail($d['group_id']);
            abort_unless($g->hasMember($u), 403);
            $dest = ['study_group_id' => $g->id];
        } else {
            $to = User::findOrFail($d['user_id']);
            abort_unless($this->shares($u->id, $to->id), 403);
            $dest = ['recipient_id' => $to->id];
        }
        $ext = pathinfo($file->path, PATHINFO_EXTENSION);
        $name = pathinfo($file->title, PATHINFO_EXTENSION) ? $file->title : $file->title.($ext ? ".$ext" : '');
        $new = $this->copyFile($file->path, $name);
        abort_unless($new, 404, 'That file is missing from storage.');

        $m = Message::create($dest + ['sender_id' => $u->id, 'kind' => 'message', 'attachment_path' => $new,
            'attachment_name' => $name, 'attachment_mime' => $file->mime, 'attachment_size' => $file->size]);
        $this->push($m);
        return back()->with('success', 'File shared.');
    }

    // ------------------------------------------------------------------ older messages + search
    /** The messages of ONE conversation, after checking the person is allowed in it. */
    private function scope(Request $request, User $u, bool $topLevel) {
        if ($request->filled('group_id')) {
            $g = StudyGroup::findOrFail($request->input('group_id'));
            abort_unless($g->hasMember($u) || $u->isAdmin(), 403);
            $q = Message::where('study_group_id', $g->id);
            return $topLevel ? $q->whereNull('parent_id') : $q;
        }
        if ($request->filled('user_id')) {
            $peer = (int) $request->input('user_id');
            abort_unless($this->shares($u->id, $peer), 403);
            return Message::whereNull('study_group_id')->where(fn ($q) => $q
                ->where(fn ($w) => $w->where('sender_id', $u->id)->where('recipient_id', $peer))
                ->orWhere(fn ($w) => $w->where('sender_id', $peer)->where('recipient_id', $u->id)));
        }
        abort(422, 'Choose a conversation.');
    }

    public function history(Request $request) {
        $u = $request->user();
        $request->validate(['before' => 'required|integer', 'until' => 'nullable|integer']);
        $q = $this->scope($request, $u, true)->where('id', '<', (int) $request->before)
            ->with('sender:id,name,avatar')->with(['replies' => fn ($r) => $r->with('sender:id,name,avatar')]);

        $rows = $request->filled('until')
            ? $q->where('id', '>=', (int) $request->until)->orderBy('id')->limit(500)->get()          // jump to a search result
            : $q->orderByDesc('id')->limit(30)->get()->reverse()->values();                           // infinite scroll page
        $oldest = $rows->min('id');
        $more = $oldest ? $this->scope($request, $u, true)->where('id', '<', $oldest)->exists() : false;
        return response()->json(['messages' => $rows->values(), 'more' => $more]);
    }

    public function search(Request $request) {
        $u = $request->user();
        $s = trim((string) $request->input('q'));
        if (mb_strlen($s) < 2) return response()->json(['results' => []]);
        $rows = $this->scope($request, $u, false)
            ->where(fn ($w) => $w->where('body', 'like', "%$s%")->orWhere('attachment_name', 'like', "%$s%"))
            ->with('sender:id,name')->orderByDesc('id')->limit(30)->get();
        return response()->json(['results' => $rows->map(fn ($m) => [
            'id' => $m->id, 'thread_id' => $m->parent_id ?? $m->id, 'sender' => $m->sender->name ?? '',
            'body' => Str::limit((string) $m->body, 120), 'attachment_name' => $m->attachment_name,
            'at' => $m->created_at->toIso8601String(),
        ])->values()]);
    }
}
