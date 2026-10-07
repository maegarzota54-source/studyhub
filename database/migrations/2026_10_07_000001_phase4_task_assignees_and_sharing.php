<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\{DB, Schema};
return new class extends Migration {
    public function up(): void {
        // Many assigned members per task (the old single assignee_id column stays, unused, so nothing breaks).
        Schema::create('task_user', function (Blueprint $t) {
            $t->id();
            $t->foreignId('task_id')->constrained()->cascadeOnDelete();
            $t->foreignId('user_id')->constrained()->cascadeOnDelete();
            $t->timestamps();
            $t->unique(['task_id', 'user_id']);
        });
        DB::table('tasks')->whereNotNull('assignee_id')->orderBy('id')->each(function ($task) {
            DB::table('task_user')->insert(['task_id' => $task->id, 'user_id' => $task->assignee_id, 'created_at' => now(), 'updated_at' => now()]);
        });
        // A chat message can point at a task, so a posted task shows as a clickable card in the group chat.
        Schema::table('messages', function (Blueprint $t) {
            $t->foreignId('task_id')->nullable()->after('parent_id')->constrained()->nullOnDelete();
        });
    }
    public function down(): void {
        Schema::table('messages', function (Blueprint $t) { $t->dropConstrainedForeignId('task_id'); });
        Schema::dropIfExists('task_user');
    }
};
