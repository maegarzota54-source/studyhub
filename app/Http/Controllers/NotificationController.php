<?php
namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Inertia\Inertia;

class NotificationController extends Controller
{
    public function index(Request $request) {
        return Inertia::render('Notifications', ['items' => $request->user()->notifications()->limit(50)->get()->map(fn ($n) => [
            'id' => $n->id, 'message' => $n->data['message'] ?? '', 'url' => $n->data['url'] ?? null,
            'read' => (bool) $n->read_at, 'ago' => $n->created_at->diffForHumans()])]);
    }
    public function readAll(Request $request) { $request->user()->unreadNotifications->markAsRead(); return back(); }
}
