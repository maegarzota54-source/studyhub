<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('chat_read_states', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('conversation_key', 80);
            $table->unsignedBigInteger('delivered_through_id')->nullable();
            $table->unsignedBigInteger('read_through_id')->nullable();
            $table->timestamps();
            $table->unique(['user_id', 'conversation_key']);
            $table->index(['conversation_key', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('chat_read_states');
    }
};
