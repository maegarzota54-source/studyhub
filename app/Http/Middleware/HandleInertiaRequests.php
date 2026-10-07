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
        return [
            ...parent::share($request),
            'auth' => ['user' => $request->user()],
            'unread' => fn () => $request->user()?->unreadNotifications()->count() ?? 0,
            // Phase 1: the latest few notifications, shown in the bell dropdown in the header.
            'recent_notifications' => fn () => $request->user()?->notifications()->limit(6)->get()->map(fn ($n) => [
                'id' => $n->id, 'message' => $n->data['message'] ?? '', 'url' => $n->data['url'] ?? null,
                'read' => (bool) $n->read_at, 'ago' => $n->created_at->diffForHumans(),
            ])->values() ?? [],
            'flash' => ['success' => fn () => $request->session()->get('success')],
        ];
    }

}

