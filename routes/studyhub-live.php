<?php
// Required from routes/web.php BEFORE studyhub.php (so /groups/activity is matched before /groups/{group}).
use App\Http\Controllers\{GroupExtrasController, MessageHubController};
use Illuminate\Support\Facades\Route;

Route::middleware(['auth', 'verified', 'active'])->group(function () {
    // Find Groups: joining a circle removes it from discovery; members and teacher badges shown
    Route::get('/groups/find', [GroupExtrasController::class, 'find'])->name('groups.find');
    Route::post('/groups', [GroupExtrasController::class, 'store'])->name('groups.store');
    Route::post('/groups/{group}/join', [GroupExtrasController::class, 'join'])->name('groups.join');
    Route::post('/groups/{group}/cover', [GroupExtrasController::class, 'cover'])->name('groups.cover');

    // Live activity (green / gray indicator)
    Route::get('/groups/activity', [GroupExtrasController::class, 'activity'])->name('groups.activity');
    Route::post('/groups/{group}/heartbeat', [GroupExtrasController::class, 'heartbeat'])->name('groups.heartbeat');

    // Reading together
    Route::get('/groups/{group}/reader', [GroupExtrasController::class, 'reader'])->name('groups.reader');
    Route::post('/groups/{group}/reader/open', [GroupExtrasController::class, 'openReading'])->name('groups.reader.open');
    Route::post('/groups/{group}/reader/sync', [GroupExtrasController::class, 'syncReading'])->name('groups.reader.sync');
    Route::delete('/groups/{group}/reader', [GroupExtrasController::class, 'stopReading'])->name('groups.reader.stop');
    Route::get('/messages/{message}/preview', [GroupExtrasController::class, 'preview'])->name('messages.preview');

    // Messages page now lists study groups too
    Route::get('/messages', [MessageHubController::class, 'index'])->name('messages.index');

    // Admin acts as the teacher
    Route::middleware('admin')->patch('/admin/groups/{group}/recommend', [GroupExtrasController::class, 'recommend'])->name('admin.groups.recommend');
});
