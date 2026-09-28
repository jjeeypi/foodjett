<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $timestamp = now();

        DB::table('platform_settings')->insertOrIgnore([
            'key' => 'chat_close_after_minutes',
            'value' => '30',
            'description' => 'Minutes that order conversations remain writable after an order finishes',
            'created_at' => $timestamp,
            'updated_at' => $timestamp,
        ]);
    }

    public function down(): void
    {
        // Operational settings are intentionally retained on rollback.
    }
};
