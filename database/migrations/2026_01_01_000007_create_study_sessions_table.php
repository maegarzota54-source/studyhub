<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration {
    public function up(): void {
        Schema::create('study_sessions', function (Blueprint $t) {
            $t->id();
            $t->foreignId('user_id')->constrained()->cascadeOnDelete();
            $t->foreignId('study_group_id')->nullable()->constrained()->nullOnDelete();
            $t->string('topic')->nullable();
            $t->unsignedInteger('minutes');
            $t->date('studied_on')->index();
            $t->timestamps();
        });
    }
    public function down(): void { Schema::dropIfExists('study_sessions'); }
};
