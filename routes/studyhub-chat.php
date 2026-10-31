<?php
// Required from routes/web.php after studyhub-live.php
use App\Http\Controllers\{MessageActionsController, ScheduleExportController};
use Illuminate\Support\Facades\Route;

Route::middleware(['auth', 'verified', 'active'])->group(function () {
    Route::get('/messages/forward-targets', [MessageActionsController::class, 'targets'])->name('messages.targets');
    Route::get('/messages/shareable-files', [MessageActionsController::class, 'files'])->name('messages.files');
    Route::get('/messages/history', [MessageActionsController::class, 'history'])->name('messages.history');
    Route::get('/messages/search', [MessageActionsController::class, 'search'])->name('messages.search');
    Route::post('/messages/share-file', [MessageActionsController::class, 'shareFile'])->name('messages.share');
    Route::post('/messages/{message}/forward', [MessageActionsController::class, 'forward'])->name('messages.forward');
    Route::patch('/messages/{message}', [MessageActionsController::class, 'update'])->name('messages.update');

    Route::get('/schedule/export', [ScheduleExportController::class, 'ics'])->name('schedule.export');
});
