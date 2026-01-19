<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('reports', function (Blueprint $table) {
            $table->id();
            $table->foreignId('location_id')->constrained()->cascadeOnDelete();
            $table->string('type', 32); // rain, flood, wind
            $table->string('severity', 16)->nullable();
            $table->text('note')->nullable();
            $table->string('photo_url')->nullable();
            $table->timestamp('reported_at')->useCurrent();
            $table->timestamps();

            $table->index(['location_id', 'reported_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('reports');
    }
};
