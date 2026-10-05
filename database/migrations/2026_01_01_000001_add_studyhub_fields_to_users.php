<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration {
    public function up(): void {
        Schema::table('users', function (Blueprint $t) {
            $t->string('role')->default('student')->index();      // student | admin
            $t->string('avatar')->nullable();
            $t->text('bio')->nullable();
            $t->json('study_preferences')->nullable();            // {skill_level, goal, mode}
            $t->boolean('is_suspended')->default(false);
            $t->timestamp('last_seen_at')->nullable();
        });
    }
    public function down(): void {
        Schema::table('users', fn (Blueprint $t) => $t->dropColumn(['role','avatar','bio','study_preferences','is_suspended','last_seen_at']));
    }
};
