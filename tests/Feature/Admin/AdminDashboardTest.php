<?php

namespace Tests\Feature\Admin;

use App\Models\Admin;
use App\Models\Customer;
use App\Models\CustomerAddress;
use App\Models\Order;
use App\Models\OrderReport;
use App\Models\Payment;
use App\Models\Restaurant;
use App\Models\Rider;
use App\Models\RiderPoolOffer;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class AdminDashboardTest extends TestCase
{
    use RefreshDatabase;

    public function test_dashboard_shows_operational_metrics_and_recent_activity(): void
    {
        $admin = Admin::factory()->create();
        $restaurant = Restaurant::factory()->approved()->create();
        Restaurant::factory()->create(['approval_status' => 'pending']);
        Rider::factory()->approved()->create();
        Rider::factory()->create(['approval_status' => 'pending']);
        $customer = Customer::factory()->create();
        $address = CustomerAddress::factory()->create(['customer_id' => $customer->id]);

        $order = Order::query()->create([
            'order_number' => 'FJ-ADMIN-DASHBOARD',
            'customer_id' => $customer->id,
            'restaurant_id' => $restaurant->id,
            'customer_address_id' => $address->id,
            'status' => 'finding_rider',
            'subtotal' => 300,
            'delivery_fee' => 40,
            'service_fee' => 10,
            'discount_amount' => 0,
            'tip_amount' => 0,
            'total_amount' => 350,
            'payment_method' => 'gcash',
            'placed_at' => now(),
        ]);
        Payment::query()->create([
            'order_id' => $order->id,
            'method' => 'gcash',
            'status' => 'paid',
            'amount' => 350,
            'paid_at' => now(),
        ]);
        RiderPoolOffer::query()->create([
            'order_id' => $order->id,
            'escalation_stage' => 'admin_alerted',
        ]);
        OrderReport::query()->create([
            'order_id' => $order->id,
            'reported_by_user_id' => $customer->user_id,
            'against' => 'platform',
            'type' => 'other',
            'description' => 'Please review this order.',
            'status' => 'open',
        ]);

        $this->actingAs($admin->user)
            ->get(route('admin.dashboard'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('admin/dashboard')
                ->where('stats.orders_today', 1)
                ->where('stats.revenue_today', fn ($value): bool => (float) $value === 350.0)
                ->where('stats.active_restaurants', 1)
                ->where('stats.active_riders', 1)
                ->where('stats.pending_approvals', 2)
                ->where('unassignedOrdersCount', 1)
                ->where('adminPendingApprovals.restaurants', 1)
                ->where('adminPendingApprovals.riders', 1)
                ->has('recentActivity'));
    }

    public function test_non_admin_cannot_access_admin_dashboard(): void
    {
        $customer = Customer::factory()->create();

        $this->actingAs($customer->user)
            ->get(route('admin.dashboard'))
            ->assertForbidden();
    }
}
