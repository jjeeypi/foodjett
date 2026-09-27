<?php

namespace Tests\Feature\Customer;

use App\Actions\Orders\TransitionOrderStatus;
use App\Events\OrderStatusUpdated;
use App\Models\Admin;
use App\Models\Customer;
use App\Models\CustomerAddress;
use App\Models\Order;
use App\Models\OrderStatusHistory;
use App\Models\Payment;
use App\Models\Restaurant;
use App\Models\Rider;
use App\Models\RiderPoolOffer;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Broadcast;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class CustomerOrderTrackingTest extends TestCase
{
    use RefreshDatabase;

    public function test_owner_and_admin_can_view_tracking_but_another_customer_cannot(): void
    {
        $customer = Customer::factory()->create();
        $otherCustomer = Customer::factory()->create();
        $admin = Admin::factory()->create();
        $rider = Rider::factory()->approved()->create(['vehicle_type' => 'motorcycle']);
        $order = $this->makeOrder($customer, [
            'status' => 'rider_assigned',
            'rider_id' => $rider->id,
            'estimated_ready_at' => now()->addMinutes(15),
        ]);
        OrderStatusHistory::query()->create([
            'order_id' => $order->id,
            'status' => 'rider_assigned',
            'changed_by' => 'rider',
            'note' => 'Rider accepted the delivery.',
        ]);

        $this->actingAs($customer->user)
            ->get(route('customer.orders.track', $order))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('customer/orders/track')
                ->where('order.id', $order->id)
                ->where('order.status', 'rider_assigned')
                ->where('order.rider.name', $rider->user->name)
                ->where('order.rider.vehicle_type', 'motorcycle')
                ->has('history', 1));

        $this->actingAs($admin->user)
            ->get(route('customer.orders.track', $order))
            ->assertOk();

        $this->actingAs($otherCustomer->user)
            ->get(route('customer.orders.track', $order))
            ->assertForbidden();
    }

    public function test_status_event_uses_the_order_private_channel_and_customer_payload(): void
    {
        $customer = Customer::factory()->create();
        $rider = Rider::factory()->approved()->create(['vehicle_type' => 'bicycle']);
        $order = $this->makeOrder($customer, [
            'status' => 'rider_assigned',
            'rider_id' => $rider->id,
            'estimated_ready_at' => now()->addMinutes(12),
        ]);

        $event = new OrderStatusUpdated($order);
        $payload = $event->broadcastWith();
        $channels = $event->broadcastOn();

        $this->assertCount(1, $channels);
        $this->assertInstanceOf(PrivateChannel::class, $channels[0]);
        $this->assertSame("private-order.{$order->id}.status", $channels[0]->name);
        $this->assertSame('order.status.updated', $event->broadcastAs());
        $this->assertSame($order->id, $payload['id']);
        $this->assertSame($order->order_number, $payload['order_number']);
        $this->assertSame('rider_assigned', $payload['status']);
        $this->assertSame($rider->user->name, $payload['rider']['name']);
        $this->assertSame('bicycle', $payload['rider']['vehicle_type']);
        $this->assertNotEmpty($payload['event_id']);
    }

    public function test_only_the_owner_or_an_admin_can_join_an_order_status_channel(): void
    {
        $customer = Customer::factory()->create();
        $otherCustomer = Customer::factory()->create();
        $admin = Admin::factory()->create();
        $order = $this->makeOrder($customer);
        $authorizer = Broadcast::getChannels()->get('order.{orderId}.status');

        $this->assertIsCallable($authorizer);
        $this->assertTrue($authorizer($customer->user, $order->id));
        $this->assertTrue($authorizer($admin->user, $order->id));
        $this->assertFalse($authorizer($otherCustomer->user, $order->id));
    }

    public function test_central_transition_records_history_and_broadcasts_prep_extension(): void
    {
        Event::fake([OrderStatusUpdated::class]);
        $order = $this->makeOrder(overrides: ['status' => 'accepted']);

        DB::transaction(function () use ($order): void {
            app(TransitionOrderStatus::class)->handle(
                $order,
                'preparing',
                'restaurant',
                'Preparation estimate extended by five minutes.',
                [
                    'estimated_ready_at' => now()->addMinutes(20),
                    'prep_extended_minutes' => 5,
                ],
            );
        });

        $this->assertDatabaseHas('order_status_history', [
            'order_id' => $order->id,
            'status' => 'preparing',
            'changed_by' => 'restaurant',
        ]);
        Event::assertDispatched(OrderStatusUpdated::class, fn (OrderStatusUpdated $event): bool => $event->id === $order->id
            && $event->status === 'preparing'
            && $event->notice === 'prep_extended'
            && $event->prep_extended_minutes === 5);
    }

    public function test_customer_notify_escalation_broadcasts_the_delay_notice(): void
    {
        Event::fake([OrderStatusUpdated::class]);
        $order = $this->makeOrder(overrides: ['status' => 'finding_rider']);
        $offer = RiderPoolOffer::query()->create([
            'order_id' => $order->id,
            'search_radius_km' => 5,
            'incentive_amount' => 20,
            'escalation_stage' => 'admin_alerted',
        ]);

        $offer->update(['escalation_stage' => 'customer_notified']);

        Event::assertDispatched(OrderStatusUpdated::class, fn (OrderStatusUpdated $event): bool => $event->id === $order->id
            && $event->status === 'finding_rider'
            && $event->notice === 'rider_search_delayed'
            && $event->escalation_stage === 'customer_notified');
    }

    public function test_customer_can_cancel_after_delay_and_full_refund_is_recorded(): void
    {
        Event::fake([OrderStatusUpdated::class]);
        $customer = Customer::factory()->create();
        $order = $this->makeOrder($customer, [
            'status' => 'finding_rider',
            'payment_method' => 'gcash',
        ]);
        RiderPoolOffer::query()->create([
            'order_id' => $order->id,
            'search_radius_km' => 8,
            'incentive_amount' => 30,
            'escalation_stage' => 'customer_notified',
        ]);
        $payment = Payment::query()->create([
            'order_id' => $order->id,
            'method' => 'gcash',
            'status' => 'paid',
            'amount' => $order->total_amount,
            'paid_at' => now(),
        ]);

        $this->actingAs($customer->user)
            ->patch(route('customer.orders.cancel', $order))
            ->assertRedirect(route('customer.orders.track', $order));

        $this->assertSame('cancelled_by_customer', $order->refresh()->status);
        $this->assertSame('customer', $order->cancelled_by);
        $this->assertSame('refunded', $payment->refresh()->status);
        $this->assertSame($payment->amount, $payment->refunded_amount);
        $this->assertNotNull($payment->refunded_at);
        $this->assertDatabaseHas('payment_status_history', [
            'payment_id' => $payment->id,
            'from_status' => 'paid',
            'to_status' => 'refunded',
            'changed_by' => 'customer',
        ]);
        Event::assertDispatched(OrderStatusUpdated::class, fn (OrderStatusUpdated $event): bool => $event->id === $order->id
            && $event->status === 'cancelled_by_customer');
    }

    /** @param array<string, mixed> $overrides */
    private function makeOrder(?Customer $customer = null, array $overrides = []): Order
    {
        $customer ??= Customer::factory()->create();
        $address = CustomerAddress::factory()->create(['customer_id' => $customer->id]);
        $restaurant = Restaurant::factory()->approved()->create();

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
            'commission_amount' => 30,
            'payment_method' => 'cod',
            'placed_at' => now(),
            ...$overrides,
        ]);
    }
}
