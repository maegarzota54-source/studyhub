<?php
namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

/** Blocks suspended accounts and records "last seen" (throttled to once a minute). */
class EnsureActive
{
    public function handle(Request $request, Closure $next) {
        $u = $request->user();
        if ($u?->is_suspended) {
            Auth::logout();
            $request->session()->invalidate();
            return redirect()->route('login')->withErrors(['email' => 'Your account has been suspended.']);
        }
        if ($u && (!$u->last_seen_at || $u->last_seen_at->diffInSeconds(now()) > 60)) {
            $u->forceFill(['last_seen_at' => now()])->saveQuietly();
        }
        return $next($request);
    }
}
