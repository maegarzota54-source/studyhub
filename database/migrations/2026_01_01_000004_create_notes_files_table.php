<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration {
    public function up(): void {
        Schema::create('notes_files', function (Blueprint $t) {
            $t->id();
            $t->foreignId('user_id')->constrained()->cascadeOnDelete();
            $t->foreignId('study_group_id')->nullable()->constrained()->cascadeOnDelete(); // null = personal
            $t->string('kind')->default('file');   // note | file | module
            $t->string('title');
            $t->longText('body')->nullable();
            $t->string('path')->nullable();
            $t->string('mime')->nullable();
            $t->unsignedBigInteger('size')->nullable();
            $t->timestamps();
        });
    }
    public function down(): void { Schema::dropIfExists('notes_files'); }
};
