<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Phase 2: remembers which chat message a Notes & Files item was auto-saved from.
return new class extends Migration {
    public function up(): void {
        Schema::table('notes_files', function (Blueprint $t) {
            $t->foreignId('message_id')->nullable()->after('study_group_id')->constrained('messages')->nullOnDelete();
        });
    }
    public function down(): void {
        Schema::table('notes_files', function (Blueprint $t) {
            $t->dropConstrainedForeignId('message_id');
        });
    }
};
