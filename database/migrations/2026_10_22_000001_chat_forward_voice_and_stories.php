<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Forwarded messages and voice clips live on the normal messages table.
        Schema::table('messages', function (Blueprint $table) {
            $table->boolean('is_forwarded')->default(false);
            $table->unsignedSmallInteger('voice_seconds')->nullable();   // set = this message is a voice clip
        });

        // Stories ("instants"): a photo that disappears after 24 hours.
        Schema::create('stories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('image_path');
            $table->string('caption', 200)->nullable();
            $table->string('audience', 10)->default('public');   // public | specific | private
            $table->timestamp('expires_at');
            $table->timestamps();
            $table->index(['user_id', 'expires_at']);
            $table->index(['audience', 'expires_at']);
        });

        // Who may see a "specific people" story.
        Schema::create('story_viewers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('story_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->unique(['story_id', 'user_id']);
        });

        // Who actually opened a story (shown to the owner).
        Schema::create('story_views', function (Blueprint $table) {
            $table->id();
            $table->foreignId('story_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->timestamp('viewed_at')->useCurrent();
            $table->unique(['story_id', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('story_views');
        Schema::dropIfExists('story_viewers');
        Schema::dropIfExists('stories');
        Schema::table('messages', function (Blueprint $table) {
            $table->dropColumn(['is_forwarded', 'voice_seconds']);
        });
    }
};
