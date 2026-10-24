<?php
namespace App\Http\Controllers;

use App\Models\{GroupReading, Message, NoteFile, Setting, StudyGroup};
use App\Notifications\StudyHubNotice;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\{DB, Storage};
use Inertia\Inertia;

/**
 * Find Groups (join / members / teacher badge), group pictures, live activity,
 * and the shared "reading together" viewer for chat files and study modules.
 */
class GroupExtrasController extends Controller
{
    private const ACTIVE_SECONDS = 45;   // heartbeat is every 20 s on the client
    private const READING_SECONDS = 90;  // presenter pings every 20 s

    // ------------------------------------------------------------------ Find / create / join
    public function find(Request $request) {
        $u = $request->user();
        $groups = StudyGroup::query()->withCount('members')
            ->withExists(['members as is_member' => fn ($q) => $q->whereKey($u->id)])
            ->with('members:users.id,users.name,users.avatar')
            ->when($request->q, fn ($q, $s) => $q->where(fn ($w) => $w->where('title', 'like', "%$s%")->orWhere('topic', 'like', "%$s%")))
            ->when($request->skill_level, fn ($q, $v) => $q->where('skill_level', $v))
            ->when($request->mode, fn ($q, $v) => $q->where('mode', $v))
            ->when($request->recommended, fn ($q) => $q->whereNotNull('recommended_by'))
            ->when($request->topic, fn ($q, $v) => $q->where('topic', $v))
            ->when($request->schedule === 'week', fn ($q) => $q->whereExists(fn ($x) => $x->select(DB::raw(1))->from('schedules')
                ->whereColumn('schedules.study_group_id', 'study_groups.id')->where('schedules.visibility', 'public')
                ->whereBetween('schedules.starts_at', [now(), now()->addDays(7)])))
            ->orderByRaw('recommended_by is null')      // teacher-recommended circles first
            ->latest()->paginate(12)->withQueryString();

        return Inertia::render('Groups/Index', [
            'mode' => 'find', 'groups' => $groups,
            'filters' => $request->only('q', 'skill_level', 'mode', 'recommended', 'topic', 'schedule'),
            'topics' => StudyGroup::select('topic')->groupBy('topic')->orderByRaw('count(*) desc')->limit(12)->pluck('topic'),
            'suggested' => $request->hasAny(['q', 'skill_level', 'mode', 'recommended', 'topic', 'schedule', 'page']) ? [] : $this->suggested($u),
        ]);
    }

    /**
     * "Suggested for you": circles the student has not joined, scored on level, study mode, goal words,
     * topics of circles they already joined, teacher recommendation and a session this week.
     */
    private function suggested($u): array {
        $prefs = $u->study_preferences ?? [];
        $goalWords = collect(preg_split('/\W+/u', mb_strtolower((string) ($prefs['goal'] ?? ''))))->filter(fn ($w) => mb_strlen($w) >= 4)->values();
        $myTopics = $u->groups()->pluck('topic')->map(fn ($t) => mb_strtolower($t))->all();
        $soon = DB::table('schedules')->where('visibility', 'public')->whereBetween('starts_at', [now(), now()->addDays(7)])
            ->pluck('study_group_id')->unique()->flip();

        return StudyGroup::withCount('members')->with('members:users.id,users.name,users.avatar')
            ->whereDoesntHave('members', fn ($q) => $q->whereKey($u->id))->latest()->limit(100)->get()
            ->filter(fn ($g) => $g->members_count < $g->max_members)
            ->map(function ($g) use ($prefs, $goalWords, $myTopics, $soon) {
                $score = 0; $why = [];
                if (!empty($prefs['skill_level']) && $prefs['skill_level'] === $g->skill_level) { $score += 3; $why[] = 'Matches your level'; }
                if (!empty($prefs['mode']) && $prefs['mode'] === $g->mode) { $score += 2; $why[] = 'Your study mode'; }
                $hay = mb_strtolower("{$g->title} {$g->topic} {$g->description}");
                if ($goalWords->contains(fn ($w) => str_contains($hay, $w))) { $score += 4; $why[] = 'Fits your goal'; }
                if (in_array(mb_strtolower($g->topic), $myTopics, true)) { $score += 2; $why[] = 'Same topic as your circles'; }
                if ($g->recommended_by) { $score += 2; $why[] = "Recommended by {$g->recommended_by}"; }
                if (isset($soon[$g->id])) { $score += 1; $why[] = 'Session this week'; }
                $g->setAttribute('score', $score); $g->setAttribute('why', $why); $g->setAttribute('is_member', false);
                return $g;
            })->filter(fn ($g) => $g->score > 0)->sortByDesc('score')->take(3)->values()->all();
    }

    public function store(Request $request) {
        $max = (int) Setting::get('max_group_size', 50);
        $data = $request->validate([
            'title' => 'required|string|max:120', 'topic' => 'required|string|max:120',
            'description' => 'nullable|string|max:2000', 'target_date' => 'nullable|date|after_or_equal:today',
            'skill_level' => 'required|in:beginner,intermediate,advanced', 'mode' => 'required|in:online,in-person',
            'max_members' => "required|integer|min:2|max:$max",
            'cover' => 'nullable|image|max:3072',
        ]);
        $cover = $request->file('cover')?->store('group-covers', 'public');
        $group = StudyGroup::create(Arr::except($data, ['cover']) + ['owner_id' => $request->user()->id, 'cover' => $cover]);
        $group->members()->attach($request->user()->id, ['role' => 'admin']);
        return to_route('groups.show', $group)->with('success', 'Study circle created.');
    }

    /** Stays on the Find Groups page so the button can flip to "Joined". */
    public function join(Request $request, StudyGroup $group) {
        $u = $request->user();
        if (!$group->hasMember($u)) {
            if ($group->members()->count() >= $group->max_members) {
                return back()->withErrors(['join' => 'This circle is full.']);
            }
            $group->members()->attach($u->id, ['role' => 'member']);
            $group->owner->notify(new StudyHubNotice("{$u->name} joined {$group->title}", route('groups.show', $group, false)));
        }
        return back();
    }

    public function cover(Request $request, StudyGroup $group) {
        abort_unless($group->isGroupAdmin($request->user()), 403);
        $request->validate(['cover' => 'required|image|max:3072']);
        if ($group->cover) Storage::disk('public')->delete($group->cover);
        $group->update(['cover' => $request->file('cover')->store('group-covers', 'public')]);
        return back()->with('success', 'Group picture updated.');
    }

    /** Admin acts as the teacher: mark / unmark a circle as recommended. */
    public function recommend(Request $request, StudyGroup $group) {
        $d = $request->validate(['teacher' => 'nullable|string|max:80']);
        $group->update(['recommended_by' => $d['teacher'] ?: null]);
        return back()->with('success', $group->recommended_by ? "Marked as recommended by {$group->recommended_by}." : 'Recommendation removed.');
    }

    // ------------------------------------------------------------------ Live activity (green / gray + who)
    private function member(Request $request, StudyGroup $group): void {
        abort_unless($group->hasMember($request->user()) || $request->user()->isAdmin(), 403);
    }

    public function activity(Request $request) {
        $ids = $request->user()->groups()->pluck('study_groups.id');
        $rows = DB::table('group_members')->join('users', 'users.id', '=', 'group_members.user_id')
            ->whereIn('group_members.study_group_id', $ids)
            ->where('group_members.last_active_at', '>=', now()->subSeconds(self::ACTIVE_SECONDS))
            ->get(['group_members.study_group_id as gid', 'users.id as uid', 'users.name', 'users.avatar']);

        $out = [];
        foreach ($ids as $id) {
            $r = $rows->where('gid', $id)->values();
            $out[$id] = [
                'active' => $r->isNotEmpty(), 'count' => $r->count(),
                'names' => $r->pluck('name')->take(3)->values(),
                'people' => $r->take(5)->map(fn ($x) => [
                    'id' => $x->uid, 'name' => $x->name,
                    'avatar_url' => $x->avatar ? '/storage/'.$x->avatar : 'https://ui-avatars.com/api/?background=1B4322&color=fff&name='.urlencode($x->name),
                ])->values(),
            ];
        }
        return response()->json($out);
    }

    public function heartbeat(Request $request, StudyGroup $group) {
        $this->member($request, $group);
        if ($group->hasMember($request->user())) {
            $group->members()->updateExistingPivot($request->user()->id, ['last_active_at' => $request->boolean('active', true) ? now() : null]);
        }
        return response()->json(['ok' => true]);
    }

    // ------------------------------------------------------------------ Reading together
    private function kind(?string $name): string {
        $ext = strtolower(pathinfo((string) $name, PATHINFO_EXTENSION));
        if ($ext === 'pdf') return 'pdf';
        if (in_array($ext, ['jpg', 'jpeg', 'png', 'gif', 'webp'], true)) return 'image';
        if (in_array($ext, ['txt', 'md', 'csv', 'json', 'log', 'js', 'jsx', 'php', 'py', 'java', 'c', 'cpp', 'html', 'css', 'sql', 'xml'], true)) return 'text';
        if (in_array($ext, ['mp3', 'wav', 'ogg', 'oga', 'm4a', 'webm'], true)) return 'audio';
        return 'none';
    }

    /** Content-Type comes from the extension, never from what the uploader claimed. */
    private function contentType(string $kind, string $name): string {
        $ext = strtolower(pathinfo($name, PATHINFO_EXTENSION));
        return match (true) {
            $kind === 'pdf' => 'application/pdf',
            $kind === 'text' => 'text/plain; charset=UTF-8',
            $kind === 'audio' => ['mp3' => 'audio/mpeg', 'wav' => 'audio/wav', 'ogg' => 'audio/ogg', 'oga' => 'audio/ogg', 'm4a' => 'audio/mp4', 'webm' => 'audio/webm'][$ext] ?? 'application/octet-stream',
            default => ['jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg', 'png' => 'image/png', 'gif' => 'image/gif', 'webp' => 'image/webp'][$ext] ?? 'application/octet-stream',
        };
    }

    private function fileRow(Message $m): array {
        return [
            'source' => 'message', 'id' => $m->id, 'name' => $m->attachment_name, 'size' => $m->attachment_size,
            'by' => $m->sender->name ?? '', 'kind' => $this->kind($m->attachment_name),
            'url' => route('messages.preview', $m->id, false), 'download' => route('messages.attachment', $m->id, false),
        ];
    }

    private function moduleSource(NoteFile $f): string {
        return $this->kind($f->path) !== 'none' ? $f->path : (string) $f->title;
    }

    private function moduleRow(NoteFile $f, StudyGroup $group): array {
        return [
            'source' => 'module', 'id' => $f->id, 'name' => $f->title, 'size' => $f->size,
            'by' => $f->user->name ?? '', 'kind' => $this->kind($this->moduleSource($f)),
            'url' => route('groups.modules.preview', [$group->id, $f->id], false), 'download' => route('files.download', $f->id, false),
        ];
    }

    public function reader(Request $request, StudyGroup $group) {
        $this->member($request, $group);

        $files = Message::where('study_group_id', $group->id)->whereNotNull('attachment_path')
            ->with('sender:id,name')->latest()->limit(30)->get()
            ->reject(fn ($m) => str_starts_with((string) $m->attachment_name, 'voice-'))
            ->map(fn ($m) => $this->fileRow($m))->values();
        $modules = NoteFile::where('study_group_id', $group->id)->where('kind', 'module')->whereNotNull('path')
            ->with('user:id,name')->latest()->limit(30)->get()->map(fn ($f) => $this->moduleRow($f, $group))->values();

        $r = GroupReading::where('study_group_id', $group->id)
            ->where('updated_at', '>=', now()->subSeconds(self::READING_SECONDS))->with('user:id,name')->first();
        $reading = null;
        if ($r) {
            $file = null;
            if ($r->message_id && ($m = Message::with('sender:id,name')->find($r->message_id))) $file = $this->fileRow($m);
            if ($r->note_file_id && ($f = NoteFile::with('user:id,name')->find($r->note_file_id))) $file = $this->moduleRow($f, $group);
            if ($file) {
                $reading = ['by_id' => $r->user_id, 'by' => $r->user->name ?? '', 'page' => $r->page, 'scroll' => $r->scroll, 'file' => $file];
            }
        }
        return response()->json(['files' => $files, 'modules' => $modules, 'reading' => $reading]);
    }

    public function openReading(Request $request, StudyGroup $group) {
        $this->member($request, $group);
        $d = $request->validate(['source' => 'required|in:message,module', 'id' => 'required|integer']);

        if ($d['source'] === 'message') {
            $m = Message::where('study_group_id', $group->id)->whereNotNull('attachment_path')->findOrFail($d['id']);
            $ref = ['message_id' => $m->id, 'note_file_id' => null];
        } else {
            $f = NoteFile::where('study_group_id', $group->id)->where('kind', 'module')->whereNotNull('path')->findOrFail($d['id']);
            $ref = ['message_id' => null, 'note_file_id' => $f->id];
        }
        GroupReading::updateOrCreate(['study_group_id' => $group->id],
            $ref + ['user_id' => $request->user()->id, 'page' => 1, 'scroll' => 0, 'started_at' => now()]);
        return response()->json(['ok' => true]);
    }

    /** Only the person presenting can move the page / scroll for everyone. Also acts as the keep-alive. */
    public function syncReading(Request $request, StudyGroup $group) {
        $this->member($request, $group);
        $r = GroupReading::where('study_group_id', $group->id)->first();
        if (!$r || $r->user_id !== $request->user()->id) return response()->json(['ok' => false], 409);
        $d = $request->validate(['page' => 'sometimes|integer|min:1|max:5000', 'scroll' => 'sometimes|integer|min:0|max:100']);
        $r->fill($d)->save();
        $r->touch();
        return response()->json(['ok' => true]);
    }

    public function stopReading(Request $request, StudyGroup $group) {
        $this->member($request, $group);
        GroupReading::where('study_group_id', $group->id)->where('user_id', $request->user()->id)->delete();
        return response()->json(['ok' => true]);
    }

    /** Inline preview for chat attachments (group or direct). */
    public function preview(Request $request, Message $message) {
        $u = $request->user();
        $ok = $message->study_group_id
            ? ($message->group->hasMember($u) || $u->isAdmin())
            : in_array($u->id, [$message->sender_id, $message->recipient_id], true);
        abort_unless($ok && $message->attachment_path, 403);

        $kind = $this->kind($message->attachment_name);
        abort_if($kind === 'none', 415, 'No preview for this file type.');
        return Storage::response($message->attachment_path, $message->attachment_name, [
            'Content-Type' => $this->contentType($kind, $message->attachment_name), 'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    /** Inline preview for a study module (file) that belongs to this group. */
    public function previewModule(Request $request, StudyGroup $group, NoteFile $file) {
        $this->member($request, $group);
        abort_unless($file->study_group_id === $group->id && $file->path, 404);

        $src = $this->moduleSource($file);
        $kind = $this->kind($src);
        abort_if($kind === 'none', 415, 'No preview for this file type.');
        return Storage::response($file->path, $file->title, [
            'Content-Type' => $this->contentType($kind, $src), 'X-Content-Type-Options' => 'nosniff',
        ]);
    }
}
