<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('menu_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('menu_category_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->text('description')->nullable();
            $table->string('photo_path')->nullable();
            $table->decimal('base_price', 8, 2);
            $table->boolean('is_available')->default(true);
            $table->time('available_from')->nullable();
            $table->time('available_until')->nullable();
            $table->boolean('is_featured')->default(false);
            $table->timestamps();

            $table->index('is_available');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('menu_items');
    }
};
