<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->uuid('checkout_token')->nullable()->unique()->after('order_number');
        });

        Schema::table('pending_checkouts', function (Blueprint $table) {
            $table->uuid('idempotency_token')->nullable()->unique()->after('id');
        });
    }

    public function down(): void
    {
        Schema::table('pending_checkouts', function (Blueprint $table) {
            $table->dropUnique(['idempotency_token']);
            $table->dropColumn('idempotency_token');
        });

        Schema::table('orders', function (Blueprint $table) {
            $table->dropUnique(['checkout_token']);
            $table->dropColumn('checkout_token');
        });
    }
};
