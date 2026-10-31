<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Admin actions keep a permanent trail. The log has no foreign keys on purpose, so it survives
 * even when the reported message, user, group or file is removed.
 */
return new class extends Migration {
    public function up(): void {
        Schema::create('moderation_logs', function (Blueprint $t) {
            $t->id();
            $t->unsignedBigInteger('admin_id')->nullable()->index();
            $t->string('action', 40);          // dismissed, removed, suspended, reinstated, role_changed, deleted
            $t->string('target_type', 30);     // message, user, group, file
            $t->unsignedBigInteger('target_id')->nullable();
            $t->string('summary', 255);
            $t->json('details')->nullable();   // snapshot of what was removed
            $t->timestamps();
            $t->index('created_at');
        });
        Schema::table('messages', function (Blueprint $t) {
            $t->unsignedBigInteger('flagged_by')->nullable();
            $t->timestamp('flagged_at')->nullable();
        });
    }
    public function down(): void {
        Schema::table('messages', fn (Blueprint $t) => $t->dropColumn(['flagged_by', 'flagged_at']));
        Schema::dropIfExists('moderation_logs');
    }
};
