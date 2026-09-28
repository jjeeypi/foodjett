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
                'key' => 'delivery_base_fee',
                'value' => '35',
                'description' => 'Base delivery fee charged on every order',
                'created_at' => $timestamp,
                'updated_at' => $timestamp,
            ],
            [
                'key' => 'delivery_fee_per_km',
                'value' => '10',
                'description' => 'Additional delivery fee charged per kilometre',
                'created_at' => $timestamp,
                'updated_at' => $timestamp,
            ],
        ]);
    }

    public function down(): void
    {
        // Operational settings are intentionally retained on rollback.
    }
};
