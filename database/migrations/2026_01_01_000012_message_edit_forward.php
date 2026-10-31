<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        // Some of these columns may already exist from an earlier change, so only add the missing ones.
        Schema::table('messages', function (Blueprint $t) {
            if (!Schema::hasColumn('messages', 'edited_at')) $t->timestamp('edited_at')->nullable();
            if (!Schema::hasColumn('messages', 'forwarded_from')) $t->string('forwarded_from')->nullable();
        });
    }

    public function down(): void {
        // Intentionally empty: these columns may have existed before this migration, so we never drop them.
    }
};