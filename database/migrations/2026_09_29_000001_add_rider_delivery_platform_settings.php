<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $timestamp = now();

        DB::table('platform_settings')->insertOrIgnore([
            [
                'key' => 'rider_waiting_compensation_amount',
                'value' => '10',
                'description' => 'Fixed rider waiting pay once the restaurant waiting threshold is reached',
                'created_at' => $timestamp,
                'updated_at' => $timestamp,
            ],
            [
                'key' => 'rider_customer_unreachable_wait_minutes',
                'value' => '5',
                'description' => 'Minutes a rider must wait after arrival before reporting the customer unreachable',
                'created_at' => $timestamp,
                'updated_at' => $timestamp,
            ],
        ]);
    }

    public function down(): void
    {
        DB::table('platform_settings')->whereIn('key', [
            'rider_waiting_compensation_amount',
            'rider_customer_unreachable_wait_minutes',
        ])->delete();
    }
};
