<?php
namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\{Message, NoteFile, Setting, StudyGroup, StudySession, User};
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
            ],
            'chart' => $chart,
            'topGroups' => StudyGroup::withCount(['members', 'messages'])->with('owner:id,name')->orderByDesc('members_count')->orderByDesc('messages_count')->limit(5)->get(),
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
        return back()->with('success', $user->is_suspended ? "{$user->name} was suspended." : "{$user->name} was reinstated.");
    }

    public function setRole(Request $request, User $user) {
        abort_if($user->id === $request->user()->id, 422, 'You cannot change your own role.');
        $data = $request->validate(['role' => 'required|in:student,admin']);
        $user->forceFill($data)->save();
        return back()->with('success', "{$user->name} is now ".($user->role === 'admin' ? 'an admin.' : 'a student.'));
    }

    public function destroyUser(Request $request, User $user) {
        abort_if($user->id === $request->user()->id, 422, 'You cannot delete yourself.');
        abort_if($user->isAdmin(), 422, 'Demote this admin before deleting.');
        $user->delete();
        return back()->with('success', 'User deleted.');
    }

    // ---------- Groups ----------
    public function groups(Request $request) {
        $groups = StudyGroup::withCount(['members', 'messages'])->with('owner:id,name')
            ->when($request->q, fn ($q, $s) => $q->where(fn ($w) => $w->where('title', 'like', "%$s%")->orWhere('topic', 'like', "%$s%")))
            ->latest()->paginate(12)->withQueryString();
        return $this->page('Admin/Groups', ['groups' => $groups, 'filters' => $request->only('q')]);
    }

    public function destroyGroup(StudyGroup $group) {
        $group->delete();
        return back()->with('success', 'Group deleted.');
    }

    // ---------- Reports (flagged messages) ----------
    public function reports() {
        return $this->page('Admin/Reports', [
            'flagged' => Message::where('is_flagged', true)->with(['sender:id,name,email,is_suspended', 'group:id,title', 'recipient:id,name'])->latest('updated_at')->get(),
        ]);
    }
    public function clearFlag(Message $message) { $message->update(['is_flagged' => false]); return back()->with('success', 'Report dismissed.'); }
    public function destroyMessage(Message $message) {
        if ($message->attachment_path) Storage::delete($message->attachment_path);
        $message->delete();
        return back()->with('success', 'Message removed.');
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
    public function destroyFile(NoteFile $file) {
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
