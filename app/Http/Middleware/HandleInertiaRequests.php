<?php

namespace App\Http\Middleware;

use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that is loaded on the first page visit.
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determine the current asset version.
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        $recentNotifications = $request->user()?->notifications()->latest()->limit(6)->get()->map(fn ($notification) => [
            'id' => $notification->id,
            'message' => $notification->data['message'] ?? '',
            'url' => $notification->data['url'] ?? null,
            'read' => (bool) $notification->read_at,
            'ago' => $notification->created_at->diffForHumans(),
        ])->values() ?? collect();

        return [
            ...parent::share($request),
            'auth' => ['user' => $request->user()],
            'peerNamespace' => substr(hash('sha256', (string) config('app.key')), 0, 12),
            'unread' => fn () => $request->user()?->unreadNotifications()->count() ?? 0,
            'recent_notifications' => $recentNotifications,
            'recent' => $recentNotifications,
            'flash' => ['success' => fn () => $request->session()->get('success')],

        ];
    }
}
