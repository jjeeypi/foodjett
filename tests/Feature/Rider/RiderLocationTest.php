<?php

namespace Tests\Feature\Rider;

use App\Events\RiderLocationUpdated;
use App\Models\Customer;
use App\Models\CustomerAddress;
use App\Models\Order;
use App\Models\Restaurant;
use App\Models\Rider;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\RateLimiter;
use Tests\TestCase;

class RiderLocationTest extends TestCase
{
    use RefreshDatabase;

    public function test_location_update_is_saved_and_broadcast_for_an_active_order(): void
    {
        Event::fake([RiderLocationUpdated::class]);
        $rider = Rider::factory()->approved()->create();
        $order = $this->makeOrder($rider, 'on_the_way');
        RateLimiter::clear("rider-location:{$rider->id}");

        $this->actingAs($rider->user)
            ->postJson(route('rider.location.update'), [
                'latitude' => 9.3071234,
                'longitude' => 123.3056789,
            ])
            ->assertOk()
            ->assertJson([
                'updated' => true,
                'broadcast' => true,
            ]);

        $rider->refresh();
        $this->assertSame(9.3071234, $rider->current_latitude);
        $this->assertSame(123.3056789, $rider->current_longitude);
        $this->assertNotNull($rider->last_location_at);
        Event::assertDispatched(
            RiderLocationUpdated::class,
            fn (RiderLocationUpdated $event): bool => $event->order_id === $order->id
                && $event->latitude === 9.3071234
                && $event->longitude === 123.3056789,
        );
    }

    public function test_location_is_saved_without_broadcast_when_rider_has_no_trackable_order(): void
    {
        Event::fake([RiderLocationUpdated::class]);
        $rider = Rider::factory()->approved()->create();
        $this->makeOrder($rider, 'arrived');
        RateLimiter::clear("rider-location:{$rider->id}");

        $this->actingAs($rider->user)
            ->postJson(route('rider.location.update'), [
                'latitude' => 9.31,
                'longitude' => 123.31,
            ])
            ->assertOk()
            ->assertJson([
                'updated' => true,
                'broadcast' => false,
            ]);

        $this->assertSame(9.31, $rider->refresh()->current_latitude);
        Event::assertNotDispatched(RiderLocationUpdated::class);
    }

    public function test_location_writes_are_debounced_for_five_seconds(): void
    {
        Event::fake([RiderLocationUpdated::class]);
        $rider = Rider::factory()->approved()->create();
        $this->makeOrder($rider, 'picked_up');
        RateLimiter::clear("rider-location:{$rider->id}");

        $this->actingAs($rider->user)
            ->postJson(route('rider.location.update'), [
                'latitude' => 9.30,
                'longitude' => 123.30,
            ])
            ->assertOk();

        $this->actingAs($rider->user)
            ->postJson(route('rider.location.update'), [
                'latitude' => 9.32,
                'longitude' => 123.32,
            ])
            ->assertStatus(202)
            ->assertJson(['updated' => false]);

        $rider->refresh();
        $this->assertSame(9.30, $rider->current_latitude);
        $this->assertSame(123.30, $rider->current_longitude);
        Event::assertDispatchedTimes(RiderLocationUpdated::class, 1);
    }

    public function test_location_event_reuses_the_private_order_status_channel(): void
    {
        $rider = Rider::factory()->approved()->create([
            'current_latitude' => 9.30,
            'current_longitude' => 123.30,
            'last_location_at' => now(),
        ]);
        $order = $this->makeOrder($rider, 'rider_assigned');
        $event = new RiderLocationUpdated($order, $rider);

        $this->assertInstanceOf(PrivateChannel::class, $event->broadcastOn()[0]);
        $this->assertSame("private-order.{$order->id}.status", $event->broadcastOn()[0]->name);
        $this->assertSame('rider.location.updated', $event->broadcastAs());
        $this->assertSame([
            'order_id' => $order->id,
            'latitude' => 9.30,
            'longitude' => 123.30,
            'timestamp' => $rider->last_location_at->toIso8601String(),
        ], $event->broadcastWith());
    }

    public function test_non_rider_cannot_submit_rider_location(): void
    {
        Event::fake([RiderLocationUpdated::class]);
        $customer = Customer::factory()->create();

        $this->actingAs($customer->user)
            ->postJson(route('rider.location.update'), [
                'latitude' => 9.30,
                'longitude' => 123.30,
            ])
            ->assertForbidden();

        Event::assertNotDispatched(RiderLocationUpdated::class);
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
