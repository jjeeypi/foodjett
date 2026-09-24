<?php

namespace Tests\Feature\Restaurant;

use App\Models\Customer;
use App\Models\CustomerAddress;
use App\Models\Order;
use App\Models\Payment;
use App\Models\Restaurant;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class RestaurantDashboardTest extends TestCase
{
    use RefreshDatabase;

    public function test_approved_restaurant_sees_scoped_dashboard_metrics_and_context(): void
    {
        $restaurant = Restaurant::factory()->approved()->create([
            'name' => 'Dashboard Kitchen',
            'default_prep_time_minutes' => 18,
        ]);
        $otherRestaurant = Restaurant::factory()->approved()->create();

        foreach ([15, 20, 25] as $minutes) {
            $this->createOrder($restaurant, [
                'status' => 'ready',
                'accepted_at' => now()->subMinutes($minutes),
                'ready_at' => now(),
                'estimated_prep_minutes' => 18,
            ]);
        }

        $pendingOrder = $this->createOrder($restaurant, ['status' => 'placed']);
        Payment::query()->create([
            'order_id' => $pendingOrder->id,
            'method' => 'gcash',
            'status' => 'partially_refunded',
            'amount' => 500,
            'refunded_amount' => 50,
            'paid_at' => now(),
        ]);
        $this->createOrder($otherRestaurant, ['status' => 'placed']);

        $this->actingAs($restaurant->user)
            ->get(route('restaurant.dashboard'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('restaurant/dashboard')
                ->where('restaurantContext.name', 'Dashboard Kitchen')
                ->where('restaurantContext.operating_status', 'open')
                ->where('stats.orders_today', 4)
                ->where('stats.revenue_today', fn ($value): bool => (float) $value === 450.0)
                ->where('stats.pending_orders', 1)
                ->where('stats.prep_time.sample_size', 3)
                ->where('stats.prep_time.actual_minutes', fn ($value): bool => (float) $value === 20.0)
                ->where('stats.prep_time.estimated_minutes', fn ($value): bool => (float) $value === 18.0)
                ->has('recentOrders', 4));
    }

    public function test_dashboard_uses_estimated_prep_time_until_enough_history_exists(): void
    {
        $restaurant = Restaurant::factory()->approved()->create([
            'default_prep_time_minutes' => 22,
        ]);
        $this->createOrder($restaurant, [
            'status' => 'ready',
            'accepted_at' => now()->subMinutes(12),
            'ready_at' => now(),
            'estimated_prep_minutes' => 16,
        ]);

        $this->actingAs($restaurant->user)
            ->get(route('restaurant.dashboard'))
            ->assertInertia(fn (Assert $page) => $page
                ->where('stats.prep_time.actual_minutes', null)
                ->where('stats.prep_time.estimated_minutes', fn ($value): bool => (float) $value === 16.0));
    }

    public function test_pending_restaurant_is_redirected_from_dashboard_and_menu(): void
    {
        $restaurant = Restaurant::factory()->create(['approval_status' => 'pending']);

        $this->actingAs($restaurant->user)
            ->get(route('restaurant.dashboard'))
            ->assertRedirect(route('restaurant.pending'));
        $this->actingAs($restaurant->user)
            ->get(route('restaurant.menu.items.index'))
            ->assertRedirect(route('restaurant.pending'));
    }

    public function test_restaurant_can_quickly_toggle_operating_status(): void
    {
        $restaurant = Restaurant::factory()->approved()->create(['operating_status' => 'open']);

        $this->actingAs($restaurant->user)
            ->patch(route('restaurant.operating-status.update'), [
                'operating_status' => 'closed',
            ])
            ->assertRedirect();

        $this->assertSame('closed', $restaurant->fresh()->operating_status);
    }

    /** @param array<string, mixed> $overrides */
    private function createOrder(Restaurant $restaurant, array $overrides = []): Order
    {
        $customer = Customer::factory()->create();
        $address = CustomerAddress::factory()->create(['customer_id' => $customer->id]);

        return Order::query()->create(array_merge([
            'order_number' => 'FJR-'.fake()->unique()->numerify('########'),
            'customer_id' => $customer->id,
            'restaurant_id' => $restaurant->id,
            'customer_address_id' => $address->id,
            'status' => 'placed',
            'subtotal' => 440,
            'delivery_fee' => 50,
            'service_fee' => 10,
            'discount_amount' => 0,
            'tip_amount' => 0,
            'total_amount' => 500,
            'commission_amount' => 66,
            'payment_method' => 'gcash',
            'placed_at' => now(),
        ], $overrides));
    }
}
