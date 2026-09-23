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
                'key' => 'rider_search_initial_radius_km',
                'value' => '3',
                'description' => 'Initial search radius in kilometres when looking for a rider',
                'created_at' => $timestamp,
                'updated_at' => $timestamp,
            ],
            [
                'key' => 'rider_search_widen_radius_km',
                'value' => '8',
                'description' => 'Widened rider search radius in kilometres after escalation',
                'created_at' => $timestamp,
                'updated_at' => $timestamp,
            ],
            [
                'key' => 'rider_search_widen_after_minutes',
                'value' => '2',
                'description' => 'Minutes before widening the rider search radius',
                'created_at' => $timestamp,
                'updated_at' => $timestamp,
            ],
            [
                'key' => 'rider_incentive_after_minutes',
                'value' => '4',
                'description' => 'Minutes before adding an incentive to the rider offer',
                'created_at' => $timestamp,
                'updated_at' => $timestamp,
            ],
            [
                'key' => 'admin_alert_after_minutes',
                'value' => '6',
                'description' => 'Minutes before alerting an administrator about an unassigned order',
                'created_at' => $timestamp,
                'updated_at' => $timestamp,
            ],
            [
                'key' => 'customer_notify_after_minutes',
                'value' => '8',
                'description' => 'Minutes before notifying the customer about a rider-search delay',
                'created_at' => $timestamp,
                'updated_at' => $timestamp,
            ],
            [
                'key' => 'auto_cancel_after_minutes',
                'value' => '15',
                'description' => 'Minutes before automatically cancelling an order when no rider is found',
                'created_at' => $timestamp,
                'updated_at' => $timestamp,
            ],
            [
                'key' => 'default_commission_rate',
                'value' => '15',
                'description' => 'Default commission percentage assigned to newly registered restaurants',
                'created_at' => $timestamp,
                'updated_at' => $timestamp,
            ],
            [
                'key' => 'rider_waiting_compensation_threshold_minutes',
                'value' => '5',
                'description' => 'Restaurant waiting minutes before rider compensation begins',
                'created_at' => $timestamp,
                'updated_at' => $timestamp,
            ],
        ]);
    }

    public function down(): void
    {
        // Settings are operational data and are intentionally preserved on rollback.
    }
};
