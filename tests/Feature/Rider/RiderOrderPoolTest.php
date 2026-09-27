<?php

namespace Tests\Feature\Rider;

use App\Actions\Orders\TransitionOrderStatus;
use App\Events\OrderAvailableInPool;
use App\Events\OrderStatusUpdated;
use App\Events\OrderTakenFromPool;
use App\Models\Customer;
use App\Models\CustomerAddress;
use App\Models\Order;
use App\Models\Restaurant;
use App\Models\Rider;
use App\Models\RiderPoolOffer;
use Illuminate\Broadcasting\Channel;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class RiderOrderPoolTest extends TestCase
{
    use RefreshDatabase;

    public function test_pool_only_lists_orders_inside_the_offer_radius_with_distance_and_pay(): void
    {
        $rider = Rider::factory()->approved()->create([
            'current_latitude' => 9.3000,
            'current_longitude' => 123.3000,
        ]);
        $nearby = $this->makePoolOrder(
            restaurantCoordinates: [9.3010, 123.3000],
            deliveryCoordinates: [9.3110, 123.3000],
            incentive: 15,
        );
        $this->makePoolOrder(
            restaurantCoordinates: [9.4000, 123.4000],
            deliveryCoordinates: [9.4100, 123.4000],
        );

        $this->actingAs($rider->user)
            ->get(route('rider.orders.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('rider/order-pool/index')
                ->has('poolOrders', 1)
                ->where('poolOrders.0.id', $nearby->id)
                ->where('poolOrders.0.restaurant.name', $nearby->restaurant->name)
                ->where('poolOrders.0.incentive_amount', 15)
                ->where('poolOrders.0.base_pay', 40)
                ->where('poolOrders.0.accept_block_reason', null)
                ->where('hasActiveOrder', false));
    }

    public function test_first_rider_to_accept_wins_and_the_order_is_removed_from_the_pool(): void
    {
        Event::fake([OrderStatusUpdated::class, OrderTakenFromPool::class]);
        $firstRider = Rider::factory()->approved()->create([
            'current_latitude' => 9.3000,
            'current_longitude' => 123.3000,
        ]);
        $secondRider = Rider::factory()->approved()->create([
            'current_latitude' => 9.3000,
            'current_longitude' => 123.3000,
        ]);
        $order = $this->makePoolOrder();

        $this->actingAs($firstRider->user)
            ->post(route('rider.orders.accept', $order))
            ->assertRedirect();

        $this->assertSame($firstRider->id, $order->refresh()->rider_id);
        $this->assertSame('rider_assigned', $order->status);
        Event::assertDispatched(
            OrderTakenFromPool::class,
            fn (OrderTakenFromPool $event): bool => $event->id === $order->id,
        );

        $this->actingAs($secondRider->user)
            ->from(route('rider.orders.index'))
            ->post(route('rider.orders.accept', $order))
            ->assertRedirect(route('rider.orders.index'))
            ->assertSessionHasErrors([
                'order' => 'This order was just taken by another rider.',
            ]);
    }

    public function test_rider_with_an_active_delivery_cannot_accept_another_order(): void
    {
        $rider = Rider::factory()->approved()->create([
            'current_latitude' => 9.3000,
            'current_longitude' => 123.3000,
        ]);
        $activeOrder = $this->makePoolOrder();
        $activeOrder->update([
            'rider_id' => $rider->id,
            'status' => 'on_the_way',
            'rider_assigned_at' => now(),
        ]);
        $availableOrder = $this->makePoolOrder();

        $this->actingAs($rider->user)
            ->get(route('rider.orders.index'))
            ->assertInertia(fn (Assert $page) => $page
                ->where('hasActiveOrder', true)
                ->where(
                    'poolOrders.0.accept_block_reason',
                    'Finish your active delivery before accepting another order.'
                ));

        $this->actingAs($rider->user)
            ->post(route('rider.orders.accept', $availableOrder))
            ->assertSessionHasErrors([
                'order' => 'Finish your active delivery before accepting another order.',
            ]);

        $this->assertNull($availableOrder->refresh()->rider_id);
    }

    public function test_entering_the_pool_sets_search_start_creates_offer_and_broadcasts_availability(): void
    {
        Event::fake([OrderStatusUpdated::class, OrderAvailableInPool::class]);
        $order = $this->makeOrder(['status' => 'accepted']);

        app(TransitionOrderStatus::class)->handle(
            $order,
            'finding_rider',
            'restaurant',
            'Restaurant requested a rider.',
        );

        $this->assertSame('finding_rider', $order->refresh()->status);
        $this->assertNotNull($order->rider_search_started_at);
        $this->assertDatabaseHas('rider_pool_offers', [
            'order_id' => $order->id,
            'search_radius_km' => 3,
            'escalation_stage' => 'initial',
        ]);
        Event::assertDispatched(
            OrderAvailableInPool::class,
            fn (OrderAvailableInPool $event): bool => $event->broadcastWith()['id'] === $order->id,
        );
    }

    public function test_pool_events_use_the_public_orders_pool_channel_and_lightweight_payloads(): void
    {
        $order = $this->makePoolOrder(incentive: 20);
        $available = new OrderAvailableInPool($order);
        $taken = new OrderTakenFromPool($order);

        $this->assertInstanceOf(Channel::class, $available->broadcastOn()[0]);
        $this->assertSame('orders.pool', $available->broadcastOn()[0]->name);
        $this->assertSame('order.pool.available', $available->broadcastAs());
        $this->assertSame($order->id, $available->broadcastWith()['id']);
        $this->assertSame($order->restaurant->name, $available->broadcastWith()['restaurant']['name']);
        $this->assertSame(20.0, $available->broadcastWith()['incentive_amount']);
        $this->assertGreaterThan(60, $available->broadcastWith()['estimated_pay']);
        $this->assertArrayNotHasKey('delivery_address', $available->broadcastWith());

        $this->assertInstanceOf(Channel::class, $taken->broadcastOn()[0]);
        $this->assertSame('orders.pool', $taken->broadcastOn()[0]->name);
        $this->assertSame('order.pool.taken', $taken->broadcastAs());
        $this->assertSame(['id' => $order->id], $taken->broadcastWith());
    }

    private function makePoolOrder(
        array $restaurantCoordinates = [9.3010, 123.3000],
        array $deliveryCoordinates = [9.3110, 123.3000],
        float $incentive = 0,
    ): Order {
        $order = $this->makeOrder(
            ['status' => 'finding_rider', 'rider_search_started_at' => now()],
            $restaurantCoordinates,
            $deliveryCoordinates,
        );
        RiderPoolOffer::query()->create([
            'order_id' => $order->id,
            'search_radius_km' => 3,
            'incentive_amount' => $incentive,
            'escalation_stage' => 'initial',
        ]);

        return $order;
    }

    /** @param array<string, mixed> $overrides */
    private function makeOrder(
        array $overrides = [],
        array $restaurantCoordinates = [9.3010, 123.3000],
        array $deliveryCoordinates = [9.3110, 123.3000],
    ): Order {
        $customer = Customer::factory()->create();
        $address = CustomerAddress::factory()->create([
            'customer_id' => $customer->id,
            'latitude' => $deliveryCoordinates[0],
            'longitude' => $deliveryCoordinates[1],
        ]);
        $restaurant = Restaurant::factory()->approved()->create([
            'latitude' => $restaurantCoordinates[0],
            'longitude' => $restaurantCoordinates[1],
        ]);

        return Order::query()->create([
            'order_number' => 'FJ-'.fake()->unique()->numerify('########'),
            'customer_id' => $customer->id,
            'restaurant_id' => $restaurant->id,
            'customer_address_id' => $address->id,
            'status' => 'placed',
            'subtotal' => 200,
            'delivery_fee' => 50,
            'service_fee' => 10,
            'discount_amount' => 0,
            'tip_amount' => 0,
            'total_amount' => 260,
            'payment_method' => 'gcash',
            'estimated_ready_at' => now()->addMinutes(15),
            'placed_at' => now(),
            ...$overrides,
        ]);
    }
}
