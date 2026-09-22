<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('rider_earnings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('rider_id')->constrained()->cascadeOnDelete();
            $table->foreignId('order_id')->unique()->constrained()->cascadeOnDelete();
            $table->decimal('base_pay', 6, 2);
            $table->decimal('distance_pay', 6, 2);
            $table->decimal('waiting_pay', 6, 2)->default(0);
            $table->decimal('incentive_pay', 6, 2)->default(0);
            $table->decimal('tip_amount', 6, 2)->default(0);
            $table->decimal('total_earned', 6, 2);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('rider_earnings');
    }
};
