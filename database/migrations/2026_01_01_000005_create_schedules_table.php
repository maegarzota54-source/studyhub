<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration {
    public function up(): void {
        Schema::create('schedules', function (Blueprint $t) {
            $t->id();
            $t->foreignId('user_id')->constrained()->cascadeOnDelete();
            $t->foreignId('study_group_id')->nullable()->constrained()->cascadeOnDelete();
            $t->string('title');
            $t->text('description')->nullable();
            $t->dateTime('starts_at')->index();
            $t->dateTime('ends_at')->nullable();
            $t->string('visibility')->default('public'); // public (circle) | private | specific
            $t->timestamps();
        });
        Schema::create('schedule_user', function (Blueprint $t) {
            $t->foreignId('schedule_id')->constrained()->cascadeOnDelete();
            $t->foreignId('user_id')->constrained()->cascadeOnDelete();
            $t->primary(['schedule_id','user_id']);
        });
    }
    public function down(): void { Schema::dropIfExists('schedule_user'); Schema::dropIfExists('schedules'); }
};
