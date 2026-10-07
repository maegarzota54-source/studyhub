<?php
namespace App\Http\Controllers;

use App\Events\MessageSent;
use App\Models\{Message, NoteFile, StudyGroup, User};
use App\Notifications\StudyHubNotice;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\{DB, Storage};
use Illuminate\Support\Str;
use Inertia\Inertia;

class MessageController extends Controller
{
    /** Students you share at least one circle with. */
    private function contacts(User $u) {
        $groupIds = $u->groups()->pluck('study_groups.id');
        return User::whereIn('id', DB::table('group_members')->whereIn('study_group_id', $groupIds)->pluck('user_id'))
            ->where('id', '!=', $u->id)->orderBy('name')->get(['id', 'name', 'avatar', 'last_seen_at']);
    }

    public function index(Request $request) {
        $u = $request->user();
        $contacts = $this->contacts($u);
        // Most recent direct message per contact, so the list can show a preview and sort by activity.
        $last = Message::whereNull('study_group_id')->whereNotNull('recipient_id')
            ->where(fn ($q) => $q->where('sender_id', $u->id)->orWhere('recipient_id', $u->id))
            ->latest()->limit(500)->get()
            ->unique(fn ($m) => $m->sender_id === $u->id ? $m->recipient_id : $m->sender_id)
            ->keyBy(fn ($m) => $m->sender_id === $u->id ? $m->recipient_id : $m->sender_id);
        $contacts = $contacts->each(function ($c) use ($last) {
            $m = $last->get($c->id);
            $c->last_message = $m ? ($m->body ? Str::limit($m->body, 40) : '📎 '.$m->attachment_name) : null;
            $c->last_at = $m?->created_at;
        })->sortByDesc(fn ($c) => $c->last_at?->timestamp ?? 0)->values();
        $peer = $request->user_id ? $contacts->firstWhere('id', (int) $request->user_id) : null;
        $messages = $peer ? Message::whereNull('study_group_id')
            ->where(fn ($q) => $q->where(fn ($w) => $w->where('sender_id', $u->id)->where('recipient_id', $peer->id))
                ->orWhere(fn ($w) => $w->where('sender_id', $peer->id)->where('recipient_id', $u->id)))
            ->with('sender:id,name,avatar')->withExists('savedFiles as saved')->oldest()->limit(200)->get() : [];
        return Inertia::render('Messages/Index', ['contacts' => $contacts->each->append('avatar_url'), 'peer' => $peer, 'messages' => $messages]);
    }

    private function build(Request $request, array $extra): Message {
        $data = $request->validate([
            'body' => 'nullable|string|max:5000', 'parent_id' => 'nullable|exists:messages,id',
            'kind' => 'nullable|in:message,comment,answer,suggestion',
            'attachment' => 'nullable|file|max:20480',
        ]);
        abort_if(blank($data['body'] ?? null) && !$request->hasFile('attachment'), 422, 'Write something or attach a file.');
        $m = new Message($extra + ['sender_id' => $request->user()->id, 'body' => $data['body'] ?? null,
            'parent_id' => $data['parent_id'] ?? null, 'kind' => $data['kind'] ?? 'message']);
        if ($f = $request->file('attachment')) {
            $m->attachment_path = $f->store('attachments');            // private (local) disk
            $m->attachment_name = $f->getClientOriginalName();
            $m->attachment_mime = $f->getClientMimeType();
            $m->attachment_size = $f->getSize();
        }
        $m->save();
        if ($m->attachment_path) $this->autoSave($m);   // Phase 2: attachments land in Notes & Files automatically
        broadcast(new MessageSent($m))->toOthers();
        return $m;
    }

    public function storeGroup(Request $request, StudyGroup $group) {
        abort_unless($group->hasMember($request->user()), 403);
        $this->build($request, ['study_group_id' => $group->id]);
        return back();
    }

    public function storeDirect(Request $request, User $user) {
        abort_unless($this->contacts($request->user())->contains('id', $user->id), 403, 'You can only message students in your circles.');
        $m = $this->build($request, ['recipient_id' => $user->id]);
        $user->notify(new StudyHubNotice("New message from {$request->user()->name}", route('messages.index', ['user_id' => $request->user()->id], false)));
        return back();
    }

    private function authorizeView(Request $request, Message $m): void {
        $u = $request->user();
        $ok = $m->study_group_id ? ($m->group->hasMember($u) || $u->isAdmin()) : in_array($u->id, [$m->sender_id, $m->recipient_id]);
        abort_unless($ok, 403);
    }

    public function attachment(Request $request, Message $message) {
        $this->authorizeView($request, $message);
        abort_unless($message->attachment_path, 404);
        return Storage::download($message->attachment_path, $message->attachment_name);
    }

    /**
     * Phase 2: every file sent in chat is copied into Notes & Files automatically.
     * Group chat -> one copy in that circle's repository. Direct chat -> a personal copy for each person.
     * A failed copy must never stop the message from being sent, so errors are reported, not thrown.
     */
    private function autoSave(Message $m): void {
        $targets = $m->study_group_id
            ? [[$m->sender_id, $m->study_group_id]]
            : [[$m->sender_id, null], [$m->recipient_id, null]];
        foreach ($targets as [$userId, $groupId]) {
            try { $this->copyToFiles($m, $userId, $groupId); } catch (\Throwable $e) { report($e); }
        }
    }

    /** Each NoteFile gets its own physical copy, so deleting one person's item never breaks another's. */
    private function copyToFiles(Message $m, int $userId, ?int $groupId): NoteFile {
        $copy = 'files/'.Str::uuid().'_'.basename($m->attachment_path);
        Storage::copy($m->attachment_path, $copy);
        return NoteFile::create(['user_id' => $userId, 'study_group_id' => $groupId, 'message_id' => $m->id,
            'kind' => 'file', 'title' => $m->attachment_name, 'path' => $copy,
            'mime' => $m->attachment_mime, 'size' => $m->attachment_size]);
    }

    /** Fallback for files sent before auto-save existed. Safe to press twice: it won't duplicate. */
    public function saveToFiles(Request $request, Message $message) {
        $this->authorizeView($request, $message);
        abort_unless($message->attachment_path, 422, 'This message has no attachment.');
        $u = $request->user();
        $exists = NoteFile::where('message_id', $message->id)
            ->when($message->study_group_id, fn ($q) => $q->where('study_group_id', $message->study_group_id),
                fn ($q) => $q->where('user_id', $u->id))->exists();
        if ($exists) return back()->with('success', 'Already in Notes & Files.');
        $this->copyToFiles($message, $u->id, $message->study_group_id);
        return back()->with('success', 'Saved to Notes & Files.');
    }
    public function flag(Request $request, Message $message) {
        $this->authorizeView($request, $message);
        $message->update(['is_flagged' => true]);
        return back()->with('success', 'Reported to the admins.');
    }
}
