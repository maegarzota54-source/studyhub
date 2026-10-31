<?php
namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\{RedirectResponse, Request};
use Illuminate\Support\Facades\{Auth, Storage};
use Illuminate\Validation\Rule;
use Inertia\{Inertia, Response};

class ProfileController extends Controller
{
    public function edit(Request $request): Response {
        return Inertia::render('Profile/Edit', ['mustVerifyEmail' => false, 'status' => session('status')]);
    }

    /** Streams a member's profile photo from the public disk. Needs a login, so only StudyHub members can load it. */
    public function avatar(User $user) {
        abort_unless($user->avatar && Storage::disk('public')->exists($user->avatar), 404);
        return Storage::disk('public')->response($user->avatar, null, ['Cache-Control' => 'private, max-age=86400']);
    }

    public function update(Request $request): RedirectResponse {
        $u = $request->user();
        $d = $request->validate([
            'name' => 'required|string|max:255',
            'email' => ['required', 'email', 'max:255', Rule::unique('users')->ignore($u->id)],
            'bio' => 'nullable|string|max:500',
            'avatar' => 'nullable|image|mimes:jpg,jpeg,png,webp|max:5120',
            'study_preferences.skill_level' => 'nullable|in:beginner,intermediate,advanced',
            'study_preferences.goal' => 'nullable|string|max:80',
            'study_preferences.mode' => 'nullable|in:online,in-person',
            'subjects' => 'nullable|array|max:10', 'subjects.*' => 'string|max:40',
            'availability.days' => 'nullable|array', 'availability.days.*' => 'in:Mon,Tue,Wed,Thu,Fri,Sat,Sun',
            'availability.time' => 'nullable|in:morning,afternoon,evening',
        ]);
        if ($request->hasFile('avatar')) {
            if ($u->avatar) Storage::disk('public')->delete($u->avatar);
            $d['avatar'] = $request->file('avatar')->store('avatars', 'public');
        } else unset($d['avatar']);
        $u->fill($d);
        if ($u->isDirty('email')) $u->email_verified_at = null;
        $u->save();
        return back()->with('status', 'profile-updated');
    }

    /** RA 10173 (right to data portability / access): the student downloads everything the system holds about them. */
    public function export(Request $request) {
        $u = $request->user();
        $data = [
            'exported_at' => now()->toIso8601String(),
            'profile' => $u->only(['name', 'email', 'bio', 'study_preferences', 'subjects', 'availability', 'privacy_consent_at', 'created_at']),
            'groups' => $u->groups()->get(['study_groups.id', 'title', 'topic'])->map(fn ($g) => ['title' => $g->title, 'topic' => $g->topic, 'role' => $g->pivot->role]),
            'messages_sent' => \App\Models\Message::where('sender_id', $u->id)->get(['body', 'kind', 'created_at']),
            'study_sessions' => $u->studySessions()->get(['topic', 'minutes', 'studied_on']),
            'ratings_given' => \App\Models\GroupRating::where('user_id', $u->id)->get(['study_group_id', 'stars', 'comment']),
        ];
        return response()->streamDownload(fn () => print(json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)), 'my-studyhub-data.json', ['Content-Type' => 'application/json']);
    }

    public function destroy(Request $request): RedirectResponse {
        $request->validate(['password' => ['required', 'current_password']]);
        $u = $request->user();
        Auth::logout();
        $u->delete();
        $request->session()->invalidate();
        $request->session()->regenerateToken();
        return redirect('/');
    }
}
