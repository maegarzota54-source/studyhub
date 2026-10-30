<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * ISO/IEC 25010 follow-up:
 *  - Functional suitability: a study session can be marked as completed (session completion stage of the lifecycle).
 *  - Performance efficiency: indexes for the queries the chat, progress and task pages run most often.
 */
return new class extends Migration {
    public function up(): void {
        Schema::table('schedules', function (Blueprint $t) {
            $t->timestamp('completed_at')->nullable();
            $t->foreignId('completed_by')->nullable()->constrained('users')->nullOnDelete();
        });
        Schema::table('messages', fn (Blueprint $t) => $t->index(['study_group_id', 'created_at'], 'messages_group_created_idx'));
        Schema::table('study_sessions', fn (Blueprint $t) => $t->index(['user_id', 'studied_on'], 'study_sessions_user_day_idx'));
        Schema::table('study_sessions', fn (Blueprint $t) => $t->index(['study_group_id', 'studied_on'], 'study_sessions_group_day_idx'));
        Schema::table('tasks', fn (Blueprint $t) => $t->index(['study_group_id', 'status'], 'tasks_group_status_idx'));
    }
    public function down(): void {
        Schema::table('tasks', fn (Blueprint $t) => $t->dropIndex('tasks_group_status_idx'));
        Schema::table('study_sessions', fn (Blueprint $t) => $t->dropIndex('study_sessions_group_day_idx'));
        Schema::table('study_sessions', fn (Blueprint $t) => $t->dropIndex('study_sessions_user_day_idx'));
        Schema::table('messages', fn (Blueprint $t) => $t->dropIndex('messages_group_created_idx'));
        Schema::table('schedules', function (Blueprint $t) {
            $t->dropConstrainedForeignId('completed_by');
            $t->dropColumn('completed_at');
        });
    }
};
