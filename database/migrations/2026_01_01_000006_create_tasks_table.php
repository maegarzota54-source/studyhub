<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration {
    public function up(): void {
        Schema::create('tasks', function (Blueprint $t) {
            $t->id();
            $t->foreignId('created_by')->constrained('users')->cascadeOnDelete();
            $t->foreignId('assignee_id')->nullable()->constrained('users')->nullOnDelete();
            $t->foreignId('study_group_id')->nullable()->constrained()->cascadeOnDelete(); // null = personal
            $t->string('title');
            $t->text('description')->nullable();
            $t->date('due_date')->nullable();
            $t->string('status')->default('pending'); // pending | completed
            $t->timestamps();
        });
        Schema::create('task_comments', function (Blueprint $t) {
            $t->id();
            $t->foreignId('task_id')->constrained()->cascadeOnDelete();
            $t->foreignId('user_id')->constrained()->cascadeOnDelete();
            $t->text('body');
            $t->timestamps();
        });
    }
    public function down(): void { Schema::dropIfExists('task_comments'); Schema::dropIfExists('tasks'); }
};
