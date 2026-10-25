<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('messages', 'edited_at')) {
            Schema::table('messages', function (Blueprint $table) {
                $table->timestamp('edited_at')->nullable();
            });
        }

        if (! Schema::hasTable('message_user_hides')) {
            Schema::create('message_user_hides', function (Blueprint $table) {
                $table->id();
                $table->foreignId('message_id')->constrained()->cascadeOnDelete();
                $table->foreignId('user_id')->constrained()->cascadeOnDelete();
                $table->timestamp('created_at');
                $table->unique(['message_id', 'user_id']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('message_user_hides');

        if (Schema::hasColumn('messages', 'edited_at')) {
            Schema::table('messages', function (Blueprint $table) {
                $table->dropColumn('edited_at');
            });
        }
    }
};