<?php
namespace App\Http\Controllers;

use App\Support\UploadRules;
use App\Events\MessageSent;
use App\Models\{ChatReadState, Message, MessageReaction, NoteFile, StudyGroup, User};
use App\Notifications\StudyHubNotice;
use App\Support\ChatReadReceipts;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\{DB, Storage};
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Inertia\Inertia;

class MessageController extends Controller
{
    /** Voice clips are stored and served only with one of these extensions / audio types. */
    private const VOICE_MIMES = ['webm' => 'audio/webm', 'm4a' => 'audio/mp4', 'ogg' => 'audio/ogg'];

    private static function voiceExt(?string $mime): string {
        $mime = strtolower((string) $mime);
        return str_contains($mime, 'mp4') || str_contains($mime, 'aac') ? 'm4a' : (str_contains($mime, 'ogg') ? 'ogg' : 'webm');
    }

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
            ->visibleTo($u)
            ->latest()->limit(500)->get()
            ->unique(fn ($m) => $m->sender_id === $u->id ? $m->recipient_id : $m->sender_id)
            ->keyBy(fn ($m) => $m->sender_id === $u->id ? $m->recipient_id : $m->sender_id);
        $contacts = $contacts->each(function ($c) use ($last) {
            $m = $last->get($c->id);
            $c->last_message = $m ? ($m->body ? Str::limit($m->body, 40) : ($m->voice_seconds !== null ? '🎤 Voice message' : '📎 '.$m->attachment_name)) : null;
            $c->last_at = $m?->created_at;
        })->sortByDesc(fn ($c) => $c->last_at?->timestamp ?? 0)->values();
        $peer = $request->user_id ? $contacts->firstWhere('id', (int) $request->user_id) : null;
        $messages = $peer ? Message::whereNull('study_group_id')
            ->where(fn ($q) => $q->where(fn ($w) => $w->where('sender_id', $u->id)->where('recipient_id', $peer->id))
                ->orWhere(fn ($w) => $w->where('sender_id', $peer->id)->where('recipient_id', $u->id)))
            ->visibleTo($u)
            ->with(['sender:id,name,avatar', 'reactions:id,name'])->withExists('savedFiles as saved')->latest()->limit(200)->get()->reverse()->values() : [];
        if ($peer) {
            ChatReadReceipts::attach(
                $messages,
                ChatReadReceipts::directKey($u->id, $peer->id),
                $u->id,
                [$peer->id],
            );
            $messages->each(fn ($message) => $message->setAttribute(
                'attachment_preview',
                NoteFileController::previewType($message->attachment_path),
            ));
        }
        return Inertia::render('Messages/Index', ['contacts' => $contacts->each->append('avatar_url'), 'peer' => $peer, 'messages' => $messages]);
    }

    private function build(Request $request, array $extra): Message {
        // recorded voice clips get their own fixed extension below, so the extension check only applies to ordinary files
        $isVoice = $request->filled('voice_seconds');
        $data = $request->validate([
            'body' => 'nullable|string|max:5000', 'parent_id' => 'nullable|exists:messages,id',
            'kind' => 'nullable|in:message,comment,answer,suggestion',
            'attachment' => array_filter(['nullable', 'file', 'max:20480', $isVoice ? null : UploadRules::extensions()]),
            'voice_seconds' => 'nullable|integer|min:0|max:600',
        ], UploadRules::messages('attachment'));
        abort_if(blank($data['body'] ?? null) && !$request->hasFile('attachment'), 422, 'Write something or attach a file.');
        $voice = isset($data['voice_seconds']) && $request->hasFile('attachment');   // a recorded voice clip
        $m = new Message($extra + ['sender_id' => $request->user()->id, 'body' => $data['body'] ?? null,
            'parent_id' => $data['parent_id'] ?? null, 'kind' => $data['kind'] ?? 'message']);
        if ($f = $request->file('attachment')) {
            if ($voice) {
                // Voice clips get a fixed, known extension so they can only ever be served back as audio.
                $ext = self::voiceExt($f->getClientMimeType());
                $m->attachment_path = $f->storeAs('attachments', Str::uuid().'.'.$ext);
                $m->attachment_name = 'Voice message.'.$ext;
                $m->attachment_mime = self::VOICE_MIMES[$ext];
                $m->voice_seconds = (int) $data['voice_seconds'];
            } else {
                $m->attachment_path = $f->store('attachments');        // private (local) disk
                $m->attachment_name = $f->getClientOriginalName();
                $m->attachment_mime = $f->getClientMimeType();
            }
            $m->attachment_size = $f->getSize();
        }
        $m->save();
        if ($m->attachment_path && !$voice) $this->autoSave($m);   // Phase 2: files land in Notes & Files (voice clips don't)
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

    /** A call finished (or was missed): leave a one-line note in the chat it was started from. Sent by the person who made the call. */
    public function callLog(Request $request) {
        $u = $request->user();
        $d = $request->validate([
            'user_id' => 'nullable|exists:users,id', 'group_id' => 'nullable|exists:study_groups,id',
            'outcome' => 'required|in:ended,missed,cancelled', 'seconds' => 'nullable|integer|min:0|max:86400', 'video' => 'nullable|boolean',
        ]);
        abort_if(empty($d['user_id']) === empty($d['group_id']), 422, 'A call note belongs to exactly one chat.');
        if (!empty($d['group_id'])) {
            abort_unless(StudyGroup::findOrFail($d['group_id'])->hasMember($u), 403);
            $where = ['study_group_id' => (int) $d['group_id']];
        } else {
            abort_unless($this->contacts($u)->contains('id', (int) $d['user_id']), 403);
            $where = ['recipient_id' => (int) $d['user_id']];
        }
        $label = !empty($d['video']) ? 'video call' : 'voice call';
        $secs = (int) ($d['seconds'] ?? 0);
        $body = match ($d['outcome']) {
            'ended' => sprintf('📞 %s ended · %d:%02d', ucfirst($label), intdiv($secs, 60), $secs % 60),
            'missed' => "📞 Missed $label",
            default => "📞 Cancelled $label",
        };
        $m = Message::create($where + ['sender_id' => $u->id, 'kind' => 'call', 'body' => $body]);
        broadcast(new MessageSent($m))->toOthers();
        if ($d['outcome'] === 'missed' && isset($where['recipient_id'])) {
            User::find($where['recipient_id'])?->notify(new StudyHubNotice("Missed $label from {$u->name}", route('messages.index', ['user_id' => $u->id], false)));
        }
        return back();
    }

    private function authorizeView(Request $request, Message $m): void {
        $u = $request->user();
        $ok = $m->study_group_id ? ($m->group->hasMember($u) || $u->isAdmin()) : in_array($u->id, [$m->sender_id, $m->recipient_id]);
        abort_unless($ok, 403);
    }

    public function receipt(Request $request) {
        $data = $request->validate([
            'message_id' => 'required|integer|exists:messages,id',
            'status' => 'required|in:delivered,read',
        ]);
        $message = Message::findOrFail($data['message_id']);
        $this->authorizeView($request, $message);

        $user = $request->user();
        if ($message->study_group_id) {
            $group = $message->group;
            abort_unless($group->hasMember($user) || $user->isAdmin(), 403);
            $conversationKey = ChatReadReceipts::groupKey($group->id);
        } else {
            $peerId = $message->sender_id === $user->id ? $message->recipient_id : $message->sender_id;
            $conversationKey = ChatReadReceipts::directKey($user->id, $peerId);
        }

        DB::transaction(function () use ($user, $conversationKey, $message, $data) {
            $state = ChatReadState::firstOrCreate(
                ['user_id' => $user->id, 'conversation_key' => $conversationKey],
                ['delivered_through_id' => $message->id],
            );
            $state = ChatReadState::whereKey($state->id)->lockForUpdate()->firstOrFail();
            $state->delivered_through_id = max($state->delivered_through_id ?? 0, $message->id);
            if ($data['status'] === 'read') {
                $state->read_through_id = max($state->read_through_id ?? 0, $message->id);
            }
            $state->save();
        });

        broadcast(new MessageSent($message))->toOthers();

        return response()->json(['ok' => true]);
    }

    public function attachment(Request $request, Message $message) {
        $this->authorizeView($request, $message);
        abort_unless($message->attachment_path, 404);
        if ($request->boolean('inline') && $message->voice_seconds !== null) {
            $mime = self::VOICE_MIMES[strtolower(pathinfo($message->attachment_path, PATHINFO_EXTENSION))] ?? null;
            abort_unless($mime && Storage::exists($message->attachment_path), 404);
            // response()->file() supports Range requests, which Safari needs to play audio.
            return response()->file(Storage::path($message->attachment_path), [
                'Content-Type' => $mime, 'X-Content-Type-Options' => 'nosniff', 'Cache-Control' => 'private, max-age=3600',
            ]);
        }
        return Storage::download($message->attachment_path, $message->attachment_name);
    }


    /** Chats the current user can forward / share into: students in their circles + their study groups. */
    public function forwardTargets(Request $request) {
        $u = $request->user();
        return response()->json([
            'users' => $this->contacts($u)->map(fn ($c) => ['id' => $c->id, 'name' => $c->name, 'avatar_url' => $c->avatar_url])->values(),
            'groups' => $u->groups()->orderBy('study_groups.title')->get(['study_groups.id', 'study_groups.title'])
                ->map(fn ($g) => ['id' => $g->id, 'title' => $g->title])->values(),
        ]);
    }

    /** Validates the chosen destinations and makes sure the sender is really allowed to message each one. */
    private function resolveTargets(Request $request): array {
        $u = $request->user();
        $d = $request->validate([
            'user_ids' => 'nullable|array|max:10', 'user_ids.*' => 'integer|exists:users,id',
            'group_ids' => 'nullable|array|max:10', 'group_ids.*' => 'integer|exists:study_groups,id',
        ]);
        $userIds = collect($d['user_ids'] ?? [])->map(fn ($id) => (int) $id)->unique()->values();
        $groups = StudyGroup::whereIn('id', collect($d['group_ids'] ?? [])->unique())->get();
        abort_if($userIds->isEmpty() && $groups->isEmpty(), 422, 'Pick at least one chat.');
        $contactIds = $this->contacts($u)->pluck('id');
        abort_unless($userIds->every(fn ($id) => $contactIds->contains($id)), 403, 'You can only message students in your circles.');
        abort_unless($groups->every(fn ($g) => $g->hasMember($u)), 403, 'You can only send to groups you belong to.');
        return [$userIds, $groups];
    }

    /** Creates one new message per destination. Every attachment gets its own physical copy. */
    private function deliver(User $u, ?string $body, ?array $att, $userIds, $groups, bool $forwarded, bool $autoSave, ?int $voice = null): int {
        if ($att) abort_unless(Storage::exists($att['path']), 404, 'That file is no longer available.');
        $wheres = $userIds->map(fn ($id) => ['recipient_id' => $id])->concat($groups->map(fn ($g) => ['study_group_id' => $g->id]));
        foreach ($wheres as $where) {
            $m = new Message($where + ['sender_id' => $u->id, 'kind' => 'message', 'body' => $body, 'is_forwarded' => $forwarded, 'voice_seconds' => $voice]);
            if ($att) {
                $copy = 'attachments/'.Str::uuid().'_'.basename($att['path']);
                Storage::copy($att['path'], $copy);
                $m->attachment_path = $copy; $m->attachment_name = $att['name'];
                $m->attachment_mime = $att['mime']; $m->attachment_size = $att['size'];
            }
            $m->save();
            if ($att && $autoSave) $this->autoSave($m);
            broadcast(new MessageSent($m))->toOthers();
            if (isset($where['recipient_id'])) {
                User::find($where['recipient_id'])?->notify(new StudyHubNotice("New message from {$u->name}", route('messages.index', ['user_id' => $u->id], false)));
            }
        }
        return $wheres->count();
    }

    /** Forward a message (text, file or voice clip) to other chats. */
    public function forward(Request $request, Message $message) {
        $this->authorizeView($request, $message);
        abort_if($message->kind === 'call', 422, 'Call notes can’t be forwarded.');
        [$userIds, $groups] = $this->resolveTargets($request);
        $att = $message->attachment_path ? ['path' => $message->attachment_path, 'name' => $message->attachment_name,
            'mime' => $message->attachment_mime, 'size' => $message->attachment_size] : null;
        $count = $this->deliver($request->user(), $message->body, $att, $userIds, $groups, true, true, $message->voice_seconds);
        return response()->json(['ok' => true, 'count' => $count]);
    }

    /** Share a file or note from Notes & Files into chats. */
    public function shareFile(Request $request, NoteFile $file) {
        $u = $request->user();
        abort_unless(NoteFile::visibleTo($u)->whereKey($file->id)->exists(), 403);
        [$userIds, $groups] = $this->resolveTargets($request);
        $att = null; $body = null;
        if ($file->path) {
            $ext = strtolower(pathinfo($file->path, PATHINFO_EXTENSION));
            $name = ($ext && !Str::endsWith(strtolower($file->title), '.'.$ext)) ? $file->title.'.'.$ext : $file->title;
            $att = ['path' => $file->path, 'name' => $name, 'mime' => $file->mime, 'size' => $file->size];
        } else {
            $body = Str::limit(trim($file->title."\n\n".$file->body), 4900);
        }
        $count = $this->deliver($u, $body, $att, $userIds, $groups, false, false);
        return response()->json(['ok' => true, 'count' => $count]);
    }

    public function react(Request $request, Message $message) {
        $this->authorizeView($request, $message);
        $data = $request->validate([
            'emoji' => ['required', 'string', Rule::in(['👍', '❤️', '😂', '🎉', '🙏'])],
        ]);

        DB::transaction(function () use ($request, $message, $data) {
            $reaction = MessageReaction::where('message_id', $message->id)
                ->where('user_id', $request->user()->id)
                ->lockForUpdate()
                ->first();

            if ($reaction?->emoji === $data['emoji']) {
                $reaction->delete();
                return;
            }

            if ($reaction) {
                $reaction->update(['emoji' => $data['emoji']]);
            } else {
                MessageReaction::create([
                    'message_id' => $message->id,
                    'user_id' => $request->user()->id,
                    'emoji' => $data['emoji'],
                ]);
            }
        });

        broadcast(new MessageSent($message))->toOthers();
        return back();
    }

    public function unsend(Request $request, Message $message) {
        abort_unless($message->sender_id === $request->user()->id, 403, 'You can only unsend your own messages.');
        $this->authorizeView($request, $message);

        $messageIds = collect([$message->id]);
        $frontier = $messageIds;
        while ($frontier->isNotEmpty()) {
            $frontier = Message::whereIn('parent_id', $frontier)->pluck('id');
            $messageIds = $messageIds->merge($frontier);
        }
        $paths = Message::whereIn('id', $messageIds)->whereNotNull('attachment_path')->pluck('attachment_path');

        $existingPaths = $paths->filter(fn ($path) => Storage::exists($path));
        if ($existingPaths->isNotEmpty() && !Storage::delete($existingPaths->all())) {
            throw new \RuntimeException('Unable to remove the message attachment.');
        }
        $message->delete();
        broadcast(new MessageSent($message))->toOthers();

        return back()->with('success', 'Message unsent.');
    }

    public function update(Request $request, Message $message) {
        $this->authorizeView($request, $message);
        abort_unless($message->sender_id === $request->user()->id && $message->kind !== 'call', 403, 'You can only edit your own messages.');

        $data = $request->validate(['body' => 'nullable|string|max:5000']);
        abort_if(blank($data['body'] ?? null) && !$message->attachment_path, 422, 'Write something or attach a file.');

        $message->forceFill(['body' => $data['body'] ?? null, 'edited_at' => now()])->save();
        broadcast(new MessageSent($message))->toOthers();

        return back()->with('success', 'Message updated.');
    }

    public function hideForMe(Request $request, Message $message) {
        $this->authorizeView($request, $message);

        DB::table('message_user_hides')->insertOrIgnore([
            'message_id' => $message->id,
            'user_id' => $request->user()->id,
            'created_at' => now(),
        ]);

        return back()->with('success', 'Message removed from your chat.');
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
           $message->update(['is_flagged' => true, 'flagged_by' => $request->user()->id, 'flagged_at' => now()]);
        return back()->with('success', 'Reported to the admins.');
    }
}
