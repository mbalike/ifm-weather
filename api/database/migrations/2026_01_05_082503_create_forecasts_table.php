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
        Schema::create('forecasts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('location_id')->constrained()->cascadeOnDelete();
            $table->timestamp('observed_at');
            $table->decimal('temp_c', 5, 2)->nullable();
            $table->decimal('feels_like_c', 5, 2)->nullable();
            $table->unsignedTinyInteger('humidity')->nullable();
            $table->decimal('wind_ms', 5, 2)->nullable();
            $table->decimal('rain_mm', 6, 2)->default(0);
            $table->string('summary')->nullable();
            $table->json('raw')->nullable();
            $table->timestamps();

            $table->index(['location_id', 'observed_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('forecasts');
    }
};
