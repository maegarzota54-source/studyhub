<?php
namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\{Message, StudyGroup, StudySession, Task, User};
use Illuminate\Http\Request;
use Inertia\Inertia;

class AdminController extends Controller
{
    public function index(Request $request) {
        return Inertia::render('Admin/Index', [
            'metrics' => [
                'users' => User::count(), 'groups' => StudyGroup::count(), 'messages' => Message::count(),
                'tasks_done' => Task::where('status', 'completed')->count(),
                'hours' => round(StudySession::sum('minutes') / 60),
                'active_today' => User::where('last_seen_at', '>=', now()->startOfDay())->count(),
            ],
            'users' => User::when($request->q, fn ($q, $s) => $q->where('name', 'like', "%$s%")->orWhere('email', 'like', "%$s%"))
                ->latest()->limit(50)->get(['id', 'name', 'email', 'role', 'is_suspended', 'last_seen_at']),
            'groups' => StudyGroup::withCount('members')->with('owner:id,name')->latest()->limit(50)->get(),
            'flagged' => Message::where('is_flagged', true)->with(['sender:id,name', 'group:id,title'])->latest()->get(),
        ]);
    }
    public function toggleSuspend(User $user) {
        abort_if($user->isAdmin(), 422, 'Admins cannot be suspended.');
        $user->forceFill(['is_suspended' => !$user->is_suspended])->save(); // guarded attribute, so forceFill
        return back();
    }
    public function destroyGroup(StudyGroup $group) { $group->delete(); return back(); }
    public function clearFlag(Message $message) { $message->update(['is_flagged' => false]); return back(); }
    public function destroyMessage(Message $message) { $message->delete(); return back(); }
}
