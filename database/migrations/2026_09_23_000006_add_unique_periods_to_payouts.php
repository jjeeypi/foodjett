<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('restaurant_payouts', function (Blueprint $table) {
            $table->unique(
                ['restaurant_id', 'period_start', 'period_end'],
                'restaurant_payout_period_unique'
            );
        });

        Schema::table('rider_payouts', function (Blueprint $table) {
            $table->unique(
                ['rider_id', 'period_start', 'period_end'],
                'rider_payout_period_unique'
            );
        });
    }

    public function down(): void
    {
        Schema::table('restaurant_payouts', function (Blueprint $table) {
            $table->dropUnique('restaurant_payout_period_unique');
        });

        Schema::table('rider_payouts', function (Blueprint $table) {
            $table->dropUnique('rider_payout_period_unique');
        });
    }
};
