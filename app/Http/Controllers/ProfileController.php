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
