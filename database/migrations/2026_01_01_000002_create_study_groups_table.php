<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration {
    public function up(): void {
        Schema::create('study_groups', function (Blueprint $t) {
            $t->id();
            $t->foreignId('owner_id')->constrained('users')->cascadeOnDelete();
            $t->string('title');
            $t->string('topic');
            $t->text('description')->nullable();
            $t->date('target_date')->nullable();
            $t->string('skill_level')->default('intermediate');
            $t->string('mode')->default('online');   // online | in-person
            $t->unsignedSmallInteger('max_members')->default(10);
            $t->timestamps();
        });
        Schema::create('group_members', function (Blueprint $t) {
            $t->id();
            $t->foreignId('study_group_id')->constrained()->cascadeOnDelete();
            $t->foreignId('user_id')->constrained()->cascadeOnDelete();
            $t->string('role')->default('member');   // admin | member
            $t->timestamps();
            $t->unique(['study_group_id','user_id']);
        });
    }
    public function down(): void { Schema::dropIfExists('group_members'); Schema::dropIfExists('study_groups'); }
};
