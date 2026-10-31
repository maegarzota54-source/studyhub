<?php
namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\{Message, ModerationLog, NoteFile, Setting, StudyGroup, StudySession, User};
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;

class AdminController extends Controller
{
    /** Every admin page also gets the open-report count for the sidebar badge. */
    private function page(string $component, array $props = []) {
        return Inertia::render($component, $props + ['openReports' => Message::where('is_flagged', true)->count()]);
    }

    // ---------- Dashboard ----------
    public function index() {
        $days = collect(range(13, 0))->map(fn ($i) => now()->subDays($i)->startOfDay());
        $from = $days->first();
        $signups = User::where('created_at', '>=', $from)->selectRaw('date(created_at) as d, count(*) as c')->groupBy('d')->pluck('c', 'd');
        $msgs = Message::where('created_at', '>=', $from)->selectRaw('date(created_at) as d, count(*) as c')->groupBy('d')->pluck('c', 'd');
        $mins = StudySession::where('studied_on', '>=', $from->toDateString())->selectRaw('studied_on as d, sum(minutes) as m')->groupBy('studied_on')->pluck('m', 'd');

        $chart = $days->map(fn ($d) => [
            'day' => $d->format('M j'),
            'signups' => (int) ($signups[$d->toDateString()] ?? 0),
            'messages' => (int) ($msgs[$d->toDateString()] ?? 0),
            'hours' => round(($mins[$d->toDateString()] ?? 0) / 60, 1),
        ])->values();

        $week = now()->subDays(7);
        $feed = collect()
            ->merge(User::latest()->limit(6)->get(['id', 'name', 'created_at'])->map(fn ($u) => ['type' => 'user', 'text' => "{$u->name} joined StudyHub", 'at' => $u->created_at]))
            ->merge(StudyGroup::with('owner:id,name')->latest()->limit(6)->get()->map(fn ($g) => ['type' => 'group', 'text' => ($g->owner->name ?? 'Someone')." created “{$g->title}”", 'at' => $g->created_at]))
            ->merge(Message::where('is_flagged', true)->with('sender:id,name')->latest('updated_at')->limit(6)->get()->map(fn ($m) => ['type' => 'report', 'text' => "A message from {$m->sender->name} was reported", 'at' => $m->updated_at]))
            ->sortByDesc('at')->take(10)->values()
            ->map(fn ($e) => ['type' => $e['type'], 'text' => $e['text'], 'ago' => $e['at']->diffForHumans()]);

        return $this->page('Admin/Dashboard', [
            'kpis' => [
                'users' => User::count(), 'users_week' => User::where('created_at', '>=', $week)->count(),
                'active_today' => User::where('last_seen_at', '>=', now()->startOfDay())->count(),
                'groups' => StudyGroup::count(), 'groups_week' => StudyGroup::where('created_at', '>=', $week)->count(),
                'hours' => round(StudySession::sum('minutes') / 60), 'hours_week' => round(StudySession::where('studied_on', '>=', $week->toDateString())->sum('minutes') / 60),
                'messages' => Message::count(), 'messages_week' => Message::where('created_at', '>=', $week)->count(),
                'suspended' => User::where('is_suspended', true)->count(),
                'ratings_avg' => round((float) \App\Models\GroupRating::avg('stars'), 1), 'ratings_count' => \App\Models\GroupRating::count(),
            ],
            'chart' => $chart,
            'topGroups' => StudyGroup::withCount(['members', 'messages', 'ratings'])->withAvg('ratings', 'stars')->with('owner:id,name')->orderByDesc('members_count')->orderByDesc('messages_count')->limit(5)->get(),
            'recentUsers' => User::latest()->limit(6)->get(['id', 'name', 'email', 'avatar', 'role', 'created_at']),
            'feed' => $feed,
        ]);
    }

    /** Topbar live search (JSON). */
    public function search(Request $request) {
        $s = trim((string) $request->q);
        if (mb_strlen($s) < 2) return response()->json(['users' => [], 'groups' => []]);
        return response()->json([
            'users' => User::where('name', 'like', "%$s%")->orWhere('email', 'like', "%$s%")->limit(5)->get(['id', 'name', 'email']),
            'groups' => StudyGroup::where('title', 'like', "%$s%")->orWhere('topic', 'like', "%$s%")->limit(5)->get(['id', 'title', 'topic']),
        ]);
    }

    // ---------- Users ----------
    public function users(Request $request) {
        $users = User::withCount('groups')
            ->when($request->q, fn ($q, $s) => $q->where(fn ($w) => $w->where('name', 'like', "%$s%")->orWhere('email', 'like', "%$s%")))
            ->when($request->role, fn ($q, $r) => $q->where('role', $r))
            ->when($request->status === 'suspended', fn ($q) => $q->where('is_suspended', true))
            ->when($request->status === 'active', fn ($q) => $q->where('is_suspended', false))
            ->latest()->paginate(12)->withQueryString();
        return $this->page('Admin/Users', [
            'users' => $users, 'filters' => $request->only('q', 'role', 'status'),
            'totals' => ['all' => User::count(), 'admins' => User::where('role', 'admin')->count(), 'suspended' => User::where('is_suspended', true)->count()],
        ]);
    }

    public function toggleSuspend(Request $request, User $user) {
        abort_if($user->id === $request->user()->id, 422, 'You cannot suspend yourself.');
        abort_if($user->isAdmin(), 422, 'Demote this admin before suspending.');
        $user->forceFill(['is_suspended' => !$user->is_suspended])->save();
        ModerationLog::record($request->user(), $user->is_suspended ? 'suspended' : 'reinstated', 'user', $user->id, ($user->is_suspended ? 'Suspended ' : 'Reinstated ')."{$user->name} ({$user->email})");
        return back()->with('success', $user->is_suspended ? "{$user->name} was suspended." : "{$user->name} was reinstated.");
    }

    public function setRole(Request $request, User $user) {
        abort_if($user->id === $request->user()->id, 422, 'You cannot change your own role.');
        $data = $request->validate(['role' => 'required|in:student,admin']);
        $user->forceFill($data)->save();
        ModerationLog::record($request->user(), 'role_changed', 'user', $user->id, "Made {$user->name} a {$data['role']}");
        return back()->with('success', "{$user->name} is now ".($user->role === 'admin' ? 'an admin.' : 'a student.'));
    }

    public function destroyUser(Request $request, User $user) {
        abort_if($user->id === $request->user()->id, 422, 'You cannot delete yourself.');
        abort_if($user->isAdmin(), 422, 'Demote this admin before deleting.');
        ModerationLog::record($request->user(), 'deleted', 'user', $user->id, "Deleted account {$user->name} ({$user->email})", [
            'name' => $user->name, 'email' => $user->email, 'circles_joined' => $user->groups()->count(), 'messages_sent' => Message::where('sender_id', $user->id)->count(),
        ]);
        $user->delete();
        return back()->with('success', 'User deleted.');
    }

    // ---------- Groups ----------
    // ---------- CSV reports (use the same search and filters as the pages) ----------
    /** Cells that start with = + - @ would run as formulas in Excel, so they are prefixed with an apostrophe. */
    private function csvCell($v): string {
        $v = (string) ($v ?? '');
        return $v !== '' && str_contains('=+-@', $v[0]) ? "'".$v : $v;
    }
    private function csv(string $name, array $header, iterable $rows) {
        return response()->streamDownload(function () use ($header, $rows) {
            $out = fopen('php://output', 'w');
            fwrite($out, "\xEF\xBB\xBF");   // lets Excel read accents and Filipino characters correctly
            fputcsv($out, $header);
            foreach ($rows as $r) fputcsv($out, array_map(fn ($c) => $this->csvCell($c), $r));
            fclose($out);
        }, $name.'-'.now()->format('Y-m-d').'.csv', ['Content-Type' => 'text/csv; charset=UTF-8']);
    }
    public function exportUsers(Request $request) {
        $users = User::withCount('groups')
            ->when($request->q, fn ($q, $s) => $q->where(fn ($w) => $w->where('name', 'like', "%$s%")->orWhere('email', 'like', "%$s%")))
            ->when($request->role, fn ($q, $r) => $q->where('role', $r))
            ->when($request->status === 'suspended', fn ($q) => $q->where('is_suspended', true))
            ->when($request->status === 'active', fn ($q) => $q->where('is_suspended', false))
            ->orderBy('id')->get();
        ModerationLog::record($request->user(), 'exported', 'user', null, "Exported {$users->count()} users to CSV");
        return $this->csv('studyhub-users', ['ID', 'Name', 'Email', 'Role', 'Status', 'Circles joined', 'Joined on', 'Last seen'],
            $users->map(fn ($u) => [$u->id, $u->name, $u->email, $u->role, $u->is_suspended ? 'suspended' : 'active', $u->groups_count,
                $u->created_at?->toDateString(), $u->last_seen_at?->toDateTimeString()]));
    }
    public function exportGroups(Request $request) {
        $groups = StudyGroup::withCount(['members', 'messages', 'ratings'])->withAvg('ratings', 'stars')->with('owner:id,name')
            ->when($request->q, fn ($q, $s) => $q->where(fn ($w) => $w->where('title', 'like', "%$s%")->orWhere('topic', 'like', "%$s%")))
            ->orderBy('id')->get();
        ModerationLog::record($request->user(), 'exported', 'group', null, "Exported {$groups->count()} study groups to CSV");
        return $this->csv('studyhub-groups', ['ID', 'Title', 'Topic', 'Owner', 'Members', 'Messages', 'Ratings', 'Average rating', 'Created on'],
            $groups->map(fn ($g) => [$g->id, $g->title, $g->topic, $g->owner?->name, $g->members_count, $g->messages_count, $g->ratings_count,
                $g->ratings_count ? round((float) $g->ratings_avg_stars, 2) : '', $g->created_at?->toDateString()]));
    }

    public function groups(Request $request) {
        $groups = StudyGroup::withCount(['members', 'messages', 'ratings'])->withAvg('ratings', 'stars')->with('owner:id,name')
            ->when($request->q, fn ($q, $s) => $q->where(fn ($w) => $w->where('title', 'like', "%$s%")->orWhere('topic', 'like', "%$s%")))
            ->latest()->paginate(12)->withQueryString();
        return $this->page('Admin/Groups', ['groups' => $groups, 'filters' => $request->only('q')]);
    }

    public function destroyGroup(Request $request, StudyGroup $group) {
        ModerationLog::record($request->user(), 'deleted', 'group', $group->id, "Deleted circle “{$group->title}”", [
            'title' => $group->title, 'topic' => $group->topic, 'members' => $group->members()->count(), 'messages' => $group->messages()->count(),
        ]);
        $group->delete();
        return back()->with('success', 'Group deleted.');
    }

    // ---------- Reports (flagged messages) ----------
    public function reports() {
        return $this->page('Admin/Reports', [
            'flagged' => Message::where('is_flagged', true)->with(['sender:id,name,email,is_suspended', 'group:id,title', 'recipient:id,name', 'reporter:id,name'])->latest('updated_at')->get(),
            // permanent trail of what admins did, newest first
            'history' => ModerationLog::with('admin:id,name')->latest()->limit(30)->get(),
        ]);
    }
    /** Snapshot of a message, kept in the moderation history even after the message itself is gone. */
    private function snapshot(Message $m): array {
        $m->loadMissing(['sender:id,name,email', 'group:id,title', 'reporter:id,name']);
        return [
            'body' => $m->body, 'attachment_name' => $m->attachment_name, 'sender' => $m->sender?->name, 'sender_email' => $m->sender?->email,
            'circle' => $m->group?->title, 'sent_at' => $m->created_at?->toDateTimeString(), 'reported_by' => $m->reporter?->name, 'reported_at' => $m->flagged_at?->toDateTimeString(),
        ];
    }
    public function clearFlag(Request $request, Message $message) {
        ModerationLog::record($request->user(), 'dismissed', 'message', $message->id, 'Dismissed a report on a message from '.($message->sender?->name ?? 'a student'), $this->snapshot($message));
        $message->update(['is_flagged' => false, 'flagged_by' => null, 'flagged_at' => null]);
        return back()->with('success', 'Report dismissed.');
    }
    public function destroyMessage(Request $request, Message $message) {
        // the record is saved first, so removing the message never erases the history
        ModerationLog::record($request->user(), 'removed', 'message', $message->id, 'Removed a message from '.($message->sender?->name ?? 'a student'), $this->snapshot($message));
        if ($message->attachment_path) Storage::delete($message->attachment_path);
        $message->delete();
        return back()->with('success', 'Message removed. A copy is kept in the moderation history.');
    }

    // ---------- Content (notes, files, modules) ----------
    public function content(Request $request) {
        $items = NoteFile::with(['user:id,name', 'group:id,title'])
            ->when($request->q, fn ($q, $s) => $q->where('title', 'like', "%$s%"))
            ->when($request->kind, fn ($q, $k) => $q->where('kind', $k))
            ->latest()->paginate(12)->withQueryString();
        return $this->page('Admin/Content', ['items' => $items, 'filters' => $request->only('q', 'kind')]);
    }
    public function downloadFile(NoteFile $file) {
        abort_unless($file->path, 404);
        return Storage::download($file->path, $file->title);
    }
    public function destroyFile(Request $request, NoteFile $file) {
        ModerationLog::record($request->user(), 'deleted', 'file', $file->id, "Deleted content “{$file->title}”", ['title' => $file->title, 'kind' => $file->kind, 'owner_id' => $file->user_id]);
        if ($file->path) Storage::delete($file->path);
        $file->delete();
        return back()->with('success', 'Content deleted.');
    }

    // ---------- Settings ----------
    public function settings() {
        return $this->page('Admin/Settings', ['settings' => [
            'announcement' => Setting::get('announcement', ''),
            'announcement_enabled' => Setting::get('announcement_enabled', '0') === '1',
            'max_group_size' => (int) Setting::get('max_group_size', 50),
        ]]);
    }
    public function saveSettings(Request $request) {
        $d = $request->validate(['announcement' => 'nullable|string|max:300', 'announcement_enabled' => 'boolean', 'max_group_size' => 'required|integer|min:2|max:200']);
        Setting::put('announcement', $d['announcement'] ?? '');
        Setting::put('announcement_enabled', $d['announcement_enabled'] ? '1' : '0');
        Setting::put('max_group_size', $d['max_group_size']);
        return back()->with('success', 'Settings saved.');
    }
}
