<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration {
    public function up(): void {
        Schema::create('messages', function (Blueprint $t) {
            $t->id();
            $t->foreignId('sender_id')->constrained('users')->cascadeOnDelete();
            $t->foreignId('recipient_id')->nullable()->constrained('users')->cascadeOnDelete(); // direct
            $t->foreignId('study_group_id')->nullable()->constrained()->cascadeOnDelete();      // group
            $t->foreignId('parent_id')->nullable()->constrained('messages')->cascadeOnDelete(); // threads
            $t->string('kind')->default('message');   // message | comment | answer | suggestion
            $t->text('body')->nullable();
            $t->string('attachment_path')->nullable();
            $t->string('attachment_name')->nullable();
            $t->string('attachment_mime')->nullable();
            $t->unsignedBigInteger('attachment_size')->nullable();
            $t->boolean('is_flagged')->default(false);
            $t->timestamps();
            $t->index(['study_group_id','created_at']);
            $t->index(['sender_id','recipient_id']);
        });
    }
    public function down(): void { Schema::dropIfExists('messages'); }
};
