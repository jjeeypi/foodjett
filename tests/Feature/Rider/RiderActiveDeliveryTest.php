<?php

namespace Tests\Feature\Rider;

use App\Events\OrderStatusUpdated;
use App\Models\Conversation;
use App\Models\Customer;
use App\Models\CustomerAddress;
use App\Models\Order;
use App\Models\Payment;
use App\Models\PlatformSetting;
use App\Models\Restaurant;
use App\Models\Rider;
use App\Models\RiderPoolOffer;
use App\Services\ConversationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class RiderActiveDeliveryTest extends TestCase
{
    use RefreshDatabase;

    public function test_active_page_has_an_empty_state_or_the_riders_current_order(): void
    {
        $rider = Rider::factory()->approved()->create();

        $this->actingAs($rider->user)
            ->get(route('rider.active'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('rider/active')
                ->where('order', null));

        $order = $this->makeOrder($rider, 'rider_assigned');

        $this->actingAs($rider->user)
            ->get(route('rider.active'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('rider/active')
                ->where('order.id', $order->id)
                ->where('order.status', 'rider_assigned')
                ->where('conversation.type', 'customer_rider')
                ->where('conversation.counterpart.name', $order->customer->user->name)
                ->has('messages.data', 0));
    }

    public function test_status_steps_cannot_be_skipped_and_arrival_is_timestamped_and_broadcast(): void
    {
        Event::fake([OrderStatusUpdated::class]);
        $rider = Rider::factory()->approved()->create();
        $order = $this->makeOrder($rider, 'rider_assigned');

        $this->actingAs($rider->user)
            ->from(route('rider.active'))
            ->post(route('rider.active.advance'), ['next_status' => 'on_the_way'])
            ->assertSessionHasErrors('next_status');

        $this->assertSame('rider_assigned', $order->refresh()->status);

        $this->actingAs($rider->user)
            ->post(route('rider.active.advance'), ['next_status' => 'at_restaurant'])
            ->assertSessionHasNoErrors();

        $this->assertSame('at_restaurant', $order->refresh()->status);
        $this->assertNotNull($order->rider_arrived_restaurant_at);
        $this->assertDatabaseHas('order_status_history', [
            'order_id' => $order->id,
            'status' => 'at_restaurant',
            'changed_by' => 'rider',
        ]);
        Event::assertDispatched(
            OrderStatusUpdated::class,
            fn (OrderStatusUpdated $event): bool => $event->id === $order->id
                && $event->status === 'at_restaurant',
        );
    }

    public function test_pickup_requires_the_restaurants_code_then_start_delivery_is_explicit(): void
    {
        $rider = Rider::factory()->approved()->create();
        $order = $this->makeOrder($rider, 'at_restaurant', [
            'pickup_code' => 'A7K2',
            'rider_arrived_restaurant_at' => now()->subMinutes(8),
        ]);

        $this->actingAs($rider->user)
            ->post(route('rider.active.advance'), [
                'next_status' => 'picked_up',
                'pickup_code' => 'NOPE',
            ])
            ->assertSessionHasErrors('pickup_code');

        $this->actingAs($rider->user)
            ->post(route('rider.active.advance'), [
                'next_status' => 'picked_up',
                'pickup_code' => 'a7k2',
            ])
            ->assertSessionHasNoErrors();

        $this->assertSame('picked_up', $order->refresh()->status);
        $this->assertNotNull($order->picked_up_at);

        $this->actingAs($rider->user)
            ->post(route('rider.active.advance'), ['next_status' => 'on_the_way'])
            ->assertSessionHasNoErrors();

        $this->assertSame('on_the_way', $order->refresh()->status);
    }

    public function test_cod_delivery_requires_photo_and_cash_then_records_payment_cash_and_earnings(): void
    {
        Storage::fake('public');
        $rider = Rider::factory()->approved()->create(['cash_on_hand' => 100]);
        $order = $this->makeOrder($rider, 'arrived', [
            'payment_method' => 'cod',
            'total_amount' => 250,
            'tip_amount' => 20,
            'rider_arrived_restaurant_at' => now()->subMinutes(12),
            'picked_up_at' => now()->subMinutes(4),
        ]);
        $payment = $this->makePayment($order, 'pending');
        RiderPoolOffer::query()->create([
            'order_id' => $order->id,
            'search_radius_km' => 3,
            'incentive_amount' => 5,
            'escalation_stage' => 'incentivized',
        ]);

        $this->actingAs($rider->user)
            ->post(route('rider.active.advance'), [
                'next_status' => 'delivered',
                'proof_of_delivery' => UploadedFile::fake()->create('proof.jpg', 100, 'image/jpeg'),
                'cash_collected' => false,
            ])
            ->assertSessionHasErrors('cash_collected');

        $this->actingAs($rider->user)
            ->post(route('rider.active.advance'), [
                'next_status' => 'delivered',
                'proof_of_delivery' => UploadedFile::fake()->create('proof.jpg', 100, 'image/jpeg'),
                'cash_collected' => true,
            ])
            ->assertSessionHasNoErrors();

        $order->refresh();
        $this->assertSame('delivered', $order->status);
        $this->assertNotNull($order->delivered_at);
        $this->assertNotNull($order->proof_of_delivery_path);
        Storage::disk('public')->assertExists($order->proof_of_delivery_path);
        $this->assertSame('paid', $payment->refresh()->status);
        $this->assertSame('350.00', $rider->refresh()->cash_on_hand);
        $this->assertDatabaseHas('rider_earnings', [
            'order_id' => $order->id,
            'rider_id' => $rider->id,
            'base_pay' => 40,
            'waiting_pay' => 10,
            'incentive_pay' => 5,
            'tip_amount' => 20,
        ]);
    }

    public function test_customer_unreachable_wait_is_enforced_and_cod_cash_remains_untouched(): void
    {
        $rider = Rider::factory()->approved()->create(['cash_on_hand' => 100]);
        $order = $this->makeOrder($rider, 'arrived', ['payment_method' => 'cod']);
        $payment = $this->makePayment($order, 'pending');
        PlatformSetting::query()
            ->where('key', 'rider_customer_unreachable_wait_minutes')
            ->update(['value' => '5']);
        PlatformSetting::forgetCached('rider_customer_unreachable_wait_minutes');

        $this->actingAs($rider->user)
            ->post(route('rider.active.failed'), ['reason' => 'No answer at the door.'])
            ->assertSessionHasErrors('reason');

        $this->travel(6)->minutes();

        $this->actingAs($rider->user)
            ->post(route('rider.active.failed'), ['reason' => 'Called and messaged repeatedly.'])
            ->assertSessionHasNoErrors();

        $this->assertSame('failed_delivery', $order->refresh()->status);
        $this->assertSame('pending', $payment->refresh()->status);
        $this->assertSame('100.00', $rider->refresh()->cash_on_hand);
        $this->assertDatabaseHas('order_reports', [
            'order_id' => $order->id,
            'reported_by_user_id' => $rider->user_id,
            'against' => 'customer',
            'type' => 'customer_unreachable',
            'status' => 'open',
        ]);
    }

    public function test_rider_can_report_issues_and_cancel_only_before_pickup(): void
    {
        $rider = Rider::factory()->approved()->create();
        $order = $this->makeOrder($rider, 'at_restaurant');

        $this->actingAs($rider->user)
            ->post(route('rider.active.issues.store'), [
                'issue_type' => 'restaurant_delay',
                'description' => 'Food is twenty minutes behind the estimate.',
            ])
            ->assertSessionHasNoErrors();

        $this->assertDatabaseHas('order_reports', [
            'order_id' => $order->id,
            'against' => 'restaurant',
            'type' => 'late_delivery',
        ]);

        $this->actingAs($rider->user)
            ->post(route('rider.active.cancel'), ['reason' => 'Motorcycle breakdown.'])
            ->assertSessionHasNoErrors();

        $this->assertSame('failed_delivery', $order->refresh()->status);
        $this->assertSame('rider', $order->cancelled_by);

        $secondOrder = $this->makeOrder($rider, 'picked_up');
        $this->actingAs($rider->user)
            ->post(route('rider.active.cancel'), ['reason' => 'Changed my mind.'])
            ->assertSessionHasErrors('reason');
        $this->assertSame('picked_up', $secondOrder->refresh()->status);
    }

    public function test_shared_conversation_endpoint_allows_the_assigned_rider_only(): void
    {
        $rider = Rider::factory()->approved()->create();
        $otherRider = Rider::factory()->approved()->create();
        $order = $this->makeOrder($rider, 'rider_assigned');
        $conversation = app(ConversationService::class)->forOrder(
            $order,
            Conversation::CUSTOMER_RIDER,
        );

        $this->actingAs($rider->user)
            ->postJson(route('conversations.messages.store', $conversation), [
                'body' => 'I am heading to the restaurant now.',
            ])
            ->assertCreated()
            ->assertJsonPath('message.body', 'I am heading to the restaurant now.');

        $this->actingAs($otherRider->user)
            ->postJson(route('conversations.messages.store', $conversation), [
                'body' => 'Not my delivery.',
            ])
            ->assertForbidden();
    }

    /** @param array<string, mixed> $overrides */
    private function makeOrder(Rider $rider, string $status, array $overrides = []): Order
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
            'service_fee' => 0,
            'discount_amount' => 0,
            'tip_amount' => 0,
            'total_amount' => 250,
            'payment_method' => 'gcash',
            'placed_at' => now()->subHour(),
            'rider_assigned_at' => now()->subMinutes(20),
            'pickup_code' => 'A7K2',
            ...$overrides,
        ]);
    }

    private function makePayment(Order $order, string $status): Payment
    {
        return Payment::query()->create([
            'order_id' => $order->id,
            'method' => $order->payment_method,
            'status' => $status,
            'amount' => $order->total_amount,
        ]);
    }
}
