<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('vouchers', function (Blueprint $table) {
            $table->id();
            $table->string('code')->unique();
            $table->enum('scope', ['platform', 'restaurant']);
            $table->foreignId('restaurant_id')->nullable()->constrained()->cascadeOnDelete();
            $table->enum('type', ['percentage', 'fixed', 'free_delivery']);
            $table->decimal('value', 8, 2)->nullable();
            $table->decimal('min_order_amount', 8, 2)->default(0);
            $table->unsignedInteger('usage_limit_total')->nullable();
            $table->unsignedInteger('usage_limit_per_customer')->default(1);
            $table->timestamp('starts_at')->nullable();
            $table->timestamp('ends_at')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('vouchers');
    }
};
