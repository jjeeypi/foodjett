<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('rider_pool_offers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->unique()->constrained()->cascadeOnDelete();
            $table->decimal('search_radius_km', 4, 1)->default(3.0);
            $table->decimal('incentive_amount', 6, 2)->default(0);
            $table->enum('escalation_stage', [
                'initial', 'widened', 'incentivized', 'admin_alerted', 'customer_notified', 'auto_cancelled',
            ])->default('initial');
            $table->boolean('admin_assigned')->default(false);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('rider_pool_offers');
    }
};
