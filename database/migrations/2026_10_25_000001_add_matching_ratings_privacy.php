<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        // Matching inputs: what a student studies and when they are free.
        Schema::table('users', function (Blueprint $t) {
            $t->json('subjects')->nullable();            // ["Math","Programming"]
            $t->json('availability')->nullable();        // {"days":["Mon","Wed"],"time":"evening"}
            $t->timestamp('privacy_consent_at')->nullable(); // RA 10173: when the user agreed to the privacy notice
        });
        Schema::table('study_groups', function (Blueprint $t) {
            $t->json('meeting_days')->nullable();        // ["Mon","Wed"]
            $t->string('meeting_time')->nullable();      // morning | afternoon | evening
        });
        // Group ratings: one rating per member per circle.
        Schema::create('group_ratings', function (Blueprint $t) {
            $t->id();
            $t->foreignId('study_group_id')->constrained()->cascadeOnDelete();
            $t->foreignId('user_id')->constrained()->cascadeOnDelete();
            $t->unsignedTinyInteger('stars');            // 1..5
            $t->string('comment', 500)->nullable();
            $t->timestamps();
            $t->unique(['study_group_id', 'user_id']);
        });
    }
    public function down(): void {
        Schema::dropIfExists('group_ratings');
        Schema::table('study_groups', fn (Blueprint $t) => $t->dropColumn(['meeting_days', 'meeting_time']));
        Schema::table('users', fn (Blueprint $t) => $t->dropColumn(['subjects', 'availability', 'privacy_consent_at']));
    }
};
