<?php

namespace Tests\Feature\Rider;

use App\Models\Customer;
use App\Models\CustomerAddress;
use App\Models\Order;
use App\Models\Restaurant;
use App\Models\Rider;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class RiderAvailabilityTest extends TestCase
{
    use RefreshDatabase;

    public function test_approved_rider_pages_use_the_rider_app_routes(): void
    {
        $rider = Rider::factory()->approved()->create([
            'availability_status' => 'offline',
        ]);

        $this->actingAs($rider->user)
            ->get(route('rider.dashboard'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('rider/order-pool/index')
                ->where('riderContext.availability_status', 'offline')
                ->where('riderContext.is_busy', false));

        foreach (['active', 'earnings', 'account'] as $pageName) {
            $this->actingAs($rider->user)
                ->get(route("rider.{$pageName}"))
                ->assertOk()
                ->assertInertia(fn (Assert $page) => $page
                    ->component('rider/coming-soon'));
        }
    }

    public function test_rider_can_go_online_and_refresh_their_location(): void
    {
        $rider = Rider::factory()->approved()->create([
            'availability_status' => 'offline',
            'current_latitude' => null,
            'current_longitude' => null,
            'last_location_at' => null,
        ]);

        $this->actingAs($rider->user)
            ->post(route('rider.availability.toggle'), [
                'latitude' => 9.3071234,
                'longitude' => 123.3056789,
            ])
            ->assertSessionHasNoErrors();

        $rider->refresh();
        $this->assertSame('available', $rider->availability_status);
        $this->assertSame(9.3071234, $rider->current_latitude);
        $this->assertSame(123.3056789, $rider->current_longitude);
        $this->assertNotNull($rider->last_location_at);
    }

    public function test_rider_can_go_offline_without_overwriting_their_location(): void
    {
        $rider = Rider::factory()->approved()->create([
            'availability_status' => 'available',
            'current_latitude' => 9.3,
            'current_longitude' => 123.3,
        ]);
        $previousLocationAt = $rider->last_location_at;

        $this->actingAs($rider->user)
            ->post(route('rider.availability.toggle'))
            ->assertSessionHasNoErrors();

        $rider->refresh();
        $this->assertSame('offline', $rider->availability_status);
        $this->assertSame(9.3, $rider->current_latitude);
        $this->assertSame(123.3, $rider->current_longitude);
        $this->assertTrue($rider->last_location_at?->equalTo($previousLocationAt));
    }

    public function test_active_delivery_locks_the_availability_toggle(): void
    {
        $rider = Rider::factory()->approved()->create([
            'availability_status' => 'available',
        ]);
        $this->makeOrder($rider, 'picked_up');

        $this->actingAs($rider->user)
            ->from(route('rider.active'))
            ->post(route('rider.availability.toggle'))
            ->assertRedirect(route('rider.active'))
            ->assertSessionHasErrors([
                'availability' => 'Finish your current delivery first.',
            ]);

        $this->assertSame('available', $rider->refresh()->availability_status);

        $this->actingAs($rider->user)
            ->get(route('rider.active'))
            ->assertInertia(fn (Assert $page) => $page
                ->where('riderContext.is_busy', true));
    }

    private function makeOrder(Rider $rider, string $status): Order
    {
        $customer = Customer::factory()->create();
        $address = CustomerAddress::factory()->create(['customer_id' => $customer->id]);
        $restaurant = Restaurant::factory()->approved()->create();

        return Order::query()->create([
            'order_number' => 'FJ-'.fake()->unique()->numerify('########'),
            'customer_id' => $customer->id,
            'restaurant_id' => $restaurant->id,
            'customer_address_id' => $address->id,
            'rider_id' => $rider->id,
            'status' => $status,
            'subtotal' => 200,
            'delivery_fee' => 50,
            'service_fee' => 10,
            'discount_amount' => 0,
            'tip_amount' => 0,
            'total_amount' => 260,
            'payment_method' => 'gcash',
            'placed_at' => now(),
            'rider_assigned_at' => now(),
        ]);
    }
}
