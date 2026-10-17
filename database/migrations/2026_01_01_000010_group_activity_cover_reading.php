<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        // "who is in the group chat right now" (green / gray indicator)
        Schema::table('group_members', fn (Blueprint $t) => $t->timestamp('last_active_at')->nullable());

        // custom group picture + "Recommended by my teacher"
        Schema::table('study_groups', function (Blueprint $t) {
            $t->string('cover')->nullable();
            $t->string('recommended_by')->nullable();
        });

        // the document the circle is currently reading together (one per group)
        Schema::create('group_readings', function (Blueprint $t) {
            $t->id();
            $t->foreignId('study_group_id')->unique()->constrained()->cascadeOnDelete();
            $t->foreignId('message_id')->constrained()->cascadeOnDelete();
            $t->foreignId('user_id')->constrained()->cascadeOnDelete();
            $t->unsignedInteger('page')->default(1);
            $t->unsignedTinyInteger('scroll')->default(0);
            $t->timestamp('started_at')->nullable();
            $t->timestamps();
        });
    }
    public function down(): void {
        Schema::dropIfExists('group_readings');
        Schema::table('study_groups', fn (Blueprint $t) => $t->dropColumn(['cover', 'recommended_by']));
        Schema::table('group_members', fn (Blueprint $t) => $t->dropColumn('last_active_at'));
    }
};
