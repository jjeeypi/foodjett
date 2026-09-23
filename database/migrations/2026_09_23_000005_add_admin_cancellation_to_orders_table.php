<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** @var list<string> */
    private array $statuses = [
        'placed', 'accepted', 'preparing', 'ready',
        'finding_rider', 'rider_assigned', 'at_restaurant',
        'picked_up', 'on_the_way', 'arrived', 'delivered',
        'rejected_by_restaurant', 'cancelled_by_customer',
        'cancelled_by_restaurant', 'cancelled_no_rider',
        'cancelled_by_admin', 'failed_delivery',
    ];

    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->enum('status', $this->statuses)
                ->default('placed')
                ->change();
            $table->enum('cancelled_by', ['customer', 'restaurant', 'rider', 'admin', 'system'])
                ->nullable()
                ->change();
        });
    }

    public function down(): void
    {
        DB::table('orders')
            ->where('status', 'cancelled_by_admin')
            ->update([
                'status' => 'cancelled_no_rider',
                'cancelled_by' => 'system',
            ]);

        Schema::table('orders', function (Blueprint $table) {
            $table->enum('status', array_values(array_filter(
                $this->statuses,
                fn (string $status): bool => $status !== 'cancelled_by_admin'
            )))->default('placed')->change();
            $table->enum('cancelled_by', ['customer', 'restaurant', 'rider', 'system'])
                ->nullable()
                ->change();
        });
    }
};
