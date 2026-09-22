<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('orders', function (Blueprint $table) {
            $table->id();
            $table->string('order_number')->unique();
            $table->foreignId('customer_id')->constrained()->cascadeOnDelete();
            $table->foreignId('restaurant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('customer_address_id')->constrained()->restrictOnDelete();
            $table->foreignId('rider_id')->nullable()->constrained()->nullOnDelete();

            $table->enum('status', [
                // food track
                'placed', 'accepted', 'preparing', 'ready',
                // delivery track
                'finding_rider', 'rider_assigned', 'at_restaurant',
                'picked_up', 'on_the_way', 'arrived', 'delivered',
                // terminal
                'rejected_by_restaurant', 'cancelled_by_customer',
                'cancelled_by_restaurant', 'cancelled_no_rider', 'failed_delivery',
            ])->default('placed');

            $table->decimal('subtotal', 8, 2);
            $table->decimal('delivery_fee', 8, 2);
            $table->decimal('service_fee', 8, 2)->default(0);
            $table->decimal('discount_amount', 8, 2)->default(0);
            $table->decimal('tip_amount', 8, 2)->default(0);
            $table->decimal('total_amount', 8, 2);
            $table->decimal('commission_amount', 8, 2)->nullable();

            $table->enum('payment_method', ['cod', 'gcash', 'card']);

            $table->text('customer_notes')->nullable();
            $table->text('rejection_reason')->nullable();
            $table->text('cancellation_reason')->nullable();
            $table->enum('cancelled_by', ['customer', 'restaurant', 'rider', 'system'])->nullable();

            $table->timestamp('placed_at')->useCurrent();
            $table->timestamp('accepted_at')->nullable();
            $table->unsignedInteger('estimated_prep_minutes')->nullable();
            $table->timestamp('estimated_ready_at')->nullable();
            $table->unsignedInteger('prep_extended_minutes')->nullable();
            $table->timestamp('ready_at')->nullable();

            $table->timestamp('rider_search_started_at')->nullable();
            $table->timestamp('rider_assigned_at')->nullable();
            $table->timestamp('rider_arrived_restaurant_at')->nullable();
            $table->timestamp('picked_up_at')->nullable();
            $table->timestamp('delivered_at')->nullable();

            $table->string('pickup_code')->nullable();
            $table->string('proof_of_delivery_path')->nullable();

            $table->timestamps();

            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('orders');
    }
};
