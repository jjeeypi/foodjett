<?php

namespace Tests\Feature\Broadcasting;

use App\Events\OrderPlaced;
use App\Models\Customer;
use App\Models\CustomerAddress;
use App\Models\Order;
use App\Models\Restaurant;
use App\Models\User;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Broadcast;
use Tests\TestCase;

class RestaurantOrderChannelTest extends TestCase
{
    use RefreshDatabase;

    public function test_order_placed_uses_a_scoped_private_channel_and_lightweight_payload(): void
    {
        $restaurant = Restaurant::factory()->approved()->create();
        $customer = Customer::factory()->create();
        $address = CustomerAddress::factory()->create(['customer_id' => $customer->id]);
        $order = Order::query()->create([
            'order_number' => 'FJ-REALTIME-001',
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
            'commission_amount' => 30,
            'payment_method' => 'cod',
            'placed_at' => now(),
        ]);

        $event = new OrderPlaced($order);
        $channels = $event->broadcastOn();

        $this->assertCount(1, $channels);
        $this->assertInstanceOf(PrivateChannel::class, $channels[0]);
        $this->assertSame("private-restaurant.{$restaurant->id}.orders", $channels[0]->name);
        $this->assertSame('order.placed', $event->broadcastAs());
        $this->assertSame([
            'id' => $order->id,
            'order_number' => 'FJ-REALTIME-001',
            'restaurant_id' => $restaurant->id,
            'customer_name' => $customer->user->name,
            'total_amount' => '260.00',
            'placed_at' => $order->placed_at->toIso8601String(),
        ], $event->broadcastWith());
    }

    public function test_only_the_matching_restaurant_or_an_admin_can_join_the_order_channel(): void
    {
        $restaurant = Restaurant::factory()->approved()->create();
        $otherRestaurant = Restaurant::factory()->approved()->create();
        $admin = User::factory()->admin()->create();
        $customer = User::factory()->customer()->create();
        $authorizer = Broadcast::getChannels()->get('restaurant.{restaurantId}.orders');

        $this->assertIsCallable($authorizer);
        $this->assertTrue($authorizer($restaurant->user, $restaurant->id));
        $this->assertTrue($authorizer($admin, $restaurant->id));
        $this->assertFalse($authorizer($otherRestaurant->user, $restaurant->id));
        $this->assertFalse($authorizer($customer, $restaurant->id));
    }
}
