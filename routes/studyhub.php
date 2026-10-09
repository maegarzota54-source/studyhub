<?php
// Add to the bottom of routes/web.php:  require __DIR__.'/studyhub.php';
// (and remove Breeze's default '/dashboard' route to avoid a duplicate name)
use App\Http\Controllers\{DashboardController, GroupController, MemberController, MessageController, NoteFileController,
    ScheduleController, TaskController, ProgressController, NotificationController};
use App\Http\Controllers\Admin\AdminController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth', 'verified', 'active'])->group(function () {
    Route::get('/dashboard', [DashboardController::class, 'index'])->name('dashboard');

    Route::get('/groups/find', [GroupController::class, 'find'])->name('groups.find');
    Route::get('/groups', [GroupController::class, 'index'])->name('groups.index');
    Route::post('/groups', [GroupController::class, 'store'])->name('groups.store');
    Route::get('/groups/{group}', [GroupController::class, 'show'])->name('groups.show');
    Route::patch('/groups/{group}', [GroupController::class, 'update'])->name('groups.update');
    Route::delete('/groups/{group}', [GroupController::class, 'destroy'])->name('groups.destroy');
    Route::post('/groups/{group}/join', [GroupController::class, 'join'])->name('groups.join');
    Route::delete('/groups/{group}/leave', [GroupController::class, 'leave'])->name('groups.leave');

    Route::get('/members', [MemberController::class, 'index'])->name('members.index');
    Route::post('/presence', [MemberController::class, 'ping'])->name('presence.ping');

    Route::get('/messages', [MessageController::class, 'index'])->name('messages.index');
    Route::post('/messages/direct/{user}', [MessageController::class, 'storeDirect'])->name('messages.direct');
    Route::post('/groups/{group}/messages', [MessageController::class, 'storeGroup'])->name('messages.group');
    Route::post('/messages/{message}/save', [MessageController::class, 'saveToFiles'])->name('messages.save');
    Route::post('/messages/{message}/flag', [MessageController::class, 'flag'])->name('messages.flag');
    Route::get('/messages/{message}/attachment', [MessageController::class, 'attachment'])->name('messages.attachment');

    Route::get('/files', [NoteFileController::class, 'index'])->name('files.index');
    Route::post('/files', [NoteFileController::class, 'store'])->name('files.store');
    Route::get('/files/{file}/download', [NoteFileController::class, 'download'])->name('files.download');
    Route::delete('/files/{file}', [NoteFileController::class, 'destroy'])->name('files.destroy');

    Route::get('/schedule', [ScheduleController::class, 'index'])->name('schedule.index');
    Route::post('/schedule', [ScheduleController::class, 'store'])->name('schedule.store');
    Route::delete('/schedule/{schedule}', [ScheduleController::class, 'destroy'])->name('schedule.destroy');

    Route::get('/tasks', [TaskController::class, 'index'])->name('tasks.index');
    Route::post('/tasks', [TaskController::class, 'store'])->name('tasks.store');
    Route::get('/tasks/{task}', [TaskController::class, 'show'])->name('tasks.show');
    Route::post('/tasks/{task}/share', [TaskController::class, 'share'])->name('tasks.share');
    Route::delete('/tasks/{task}/comments/{comment}', [TaskController::class, 'destroyComment'])->name('tasks.comment.destroy');
    Route::patch('/tasks/{task}', [TaskController::class, 'update'])->name('tasks.update');
    Route::delete('/tasks/{task}', [TaskController::class, 'destroy'])->name('tasks.destroy');
    Route::post('/tasks/{task}/comments', [TaskController::class, 'comment'])->name('tasks.comment');

    Route::get('/progress', [ProgressController::class, 'index'])->name('progress.index');
    Route::post('/progress/sessions', [ProgressController::class, 'store'])->name('progress.store');

    Route::get('/notifications', [NotificationController::class, 'index'])->name('notifications.index');
    Route::post('/notifications/read', [NotificationController::class, 'readAll'])->name('notifications.read');

    Route::middleware('admin')->prefix('admin')->name('admin.')->group(function () {
    Route::get('/', [AdminController::class, 'index'])->name('index');
    Route::get('/search', [AdminController::class, 'search'])->name('search');

    Route::get('/users', [AdminController::class, 'users'])->name('users');
    Route::patch('/users/{user}/suspend', [AdminController::class, 'toggleSuspend'])->name('users.suspend');
    Route::patch('/users/{user}/role', [AdminController::class, 'setRole'])->name('users.role');
    Route::delete('/users/{user}', [AdminController::class, 'destroyUser'])->name('users.destroy');

    Route::get('/groups', [AdminController::class, 'groups'])->name('groups');
    Route::delete('/groups/{group}', [AdminController::class, 'destroyGroup'])->name('groups.destroy');

    Route::get('/reports', [AdminController::class, 'reports'])->name('reports');
    Route::post('/messages/{message}/clear', [AdminController::class, 'clearFlag'])->name('messages.clear');
    Route::delete('/messages/{message}', [AdminController::class, 'destroyMessage'])->name('messages.destroy');

    Route::get('/content', [AdminController::class, 'content'])->name('content');
    Route::get('/content/{file}/download', [AdminController::class, 'downloadFile'])->name('content.download');
    Route::delete('/content/{file}', [AdminController::class, 'destroyFile'])->name('content.destroy');

    Route::get('/settings', [AdminController::class, 'settings'])->name('settings');
    Route::post('/settings', [AdminController::class, 'saveSettings'])->name('settings.save');
});
});
