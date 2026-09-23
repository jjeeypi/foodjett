<?php

namespace Tests\Feature\Payments;

use App\Models\Admin;
use App\Models\Customer;
use App\Models\CustomerAddress;
use App\Models\Order;
use App\Models\Payment;
use App\Models\Restaurant;
use App\Models\Rider;
use App\Models\RiderCashRemittance;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class CodCashFlowTest extends TestCase
{
    use RefreshDatabase;

    public function test_rider_at_cash_limit_cannot_see_or_accept_cod_pool_order(): void
    {
        $rider = Rider::factory()->approved()->create([
            'cash_on_hand' => 500,
            'cash_remit_limit' => 500,
        ]);
        $order = $this->makeOrder(['status' => 'finding_rider', 'payment_method' => 'cod']);

        $this->actingAs($rider->user)
            ->get(route('rider.orders.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('rider/orders')
                ->has('poolOrders', 0)
                ->where('blockedCodOrders', 1));

        $this->actingAs($rider->user)
            ->from(route('rider.orders.index'))
            ->post(route('rider.orders.accept', $order))
            ->assertRedirect(route('rider.orders.index'))
            ->assertSessionHasErrors('order');

        $this->assertNull($order->refresh()->rider_id);
    }

    public function test_online_order_is_not_blocked_by_rider_cash_limit(): void
    {
        $rider = Rider::factory()->approved()->create([
            'cash_on_hand' => 500,
            'cash_remit_limit' => 500,
        ]);
        $order = $this->makeOrder(['status' => 'finding_rider', 'payment_method' => 'gcash']);

        $this->actingAs($rider->user)
            ->post(route('rider.orders.accept', $order))
            ->assertRedirect();

        $this->assertSame($rider->id, $order->refresh()->rider_id);
    }

    public function test_cod_delivery_marks_payment_paid_and_increments_cash_on_hand_once(): void
    {
        $rider = Rider::factory()->approved()->create(['cash_on_hand' => 100]);
        $order = $this->makeOrder([
            'status' => 'on_the_way',
            'payment_method' => 'cod',
            'rider_id' => $rider->id,
            'total_amount' => 250,
        ]);
        $payment = $this->createPayment($order, 'pending');

        $this->actingAs($rider->user)
            ->patch(route('rider.orders.complete', $order), [
                'outcome' => 'delivered',
                'cash_collected' => true,
            ])
            ->assertRedirect();

        $this->assertSame('delivered', $order->refresh()->status);
        $this->assertSame('paid', $payment->refresh()->status);
        $this->assertSame('350.00', $rider->refresh()->cash_on_hand);
        $this->assertDatabaseHas('payment_status_history', [
            'payment_id' => $payment->id,
            'from_status' => 'pending',
            'to_status' => 'paid',
            'changed_by' => 'rider',
        ]);
    }

    public function test_failed_cod_delivery_keeps_payment_pending_and_cash_unchanged(): void
    {
        $rider = Rider::factory()->approved()->create(['cash_on_hand' => 100]);
        $order = $this->makeOrder([
            'status' => 'on_the_way',
            'payment_method' => 'cod',
            'rider_id' => $rider->id,
        ]);
        $payment = $this->createPayment($order, 'pending');

        $this->actingAs($rider->user)
            ->patch(route('rider.orders.complete', $order), [
                'outcome' => 'failed_delivery',
                'cancellation_reason' => 'Customer refused to pay.',
            ])
            ->assertRedirect();

        $this->assertSame('failed_delivery', $order->refresh()->status);
        $this->assertSame('Customer refused to pay.', $order->cancellation_reason);
        $this->assertSame('pending', $payment->refresh()->status);
        $this->assertSame('100.00', $rider->refresh()->cash_on_hand);
    }

    public function test_admin_confirmation_decrements_rider_cash_on_hand(): void
    {
        $rider = Rider::factory()->approved()->create(['cash_on_hand' => 300]);
        $admin = Admin::factory()->create();

        $this->actingAs($rider->user)
            ->post(route('rider.remittances.store'), [
                'amount' => 200,
                'reference_note' => 'Deposit slip 123',
            ])
            ->assertRedirect();

        $remittance = RiderCashRemittance::query()->sole();
        $this->assertSame('pending', $remittance->status);

        $this->actingAs($admin->user)
            ->patch(route('admin.remittances.confirm', $remittance))
            ->assertRedirect();

        $this->assertSame('confirmed', $remittance->refresh()->status);
        $this->assertSame($admin->id, $remittance->confirmed_by_admin_id);
        $this->assertNotNull($remittance->remitted_at);
        $this->assertSame('100.00', $rider->refresh()->cash_on_hand);
    }

    /** @param array<string, mixed> $overrides */
    private function makeOrder(array $overrides = []): Order
    {
        $customer = Customer::factory()->create();
        $address = CustomerAddress::factory()->create(['customer_id' => $customer->id]);
        $restaurant = Restaurant::factory()->approved()->create();

        return Order::create([
            'order_number' => 'FJ-'.fake()->unique()->numerify('######'),
            'customer_id' => $customer->id,
            'restaurant_id' => $restaurant->id,
            'customer_address_id' => $address->id,
            'status' => 'placed',
            'subtotal' => 200,
            'delivery_fee' => 50,
            'service_fee' => 0,
            'discount_amount' => 0,
            'tip_amount' => 0,
            'total_amount' => 250,
            'payment_method' => 'cod',
            ...$overrides,
        ]);
    }

    private function createPayment(Order $order, string $status): Payment
    {
        return Payment::create([
            'order_id' => $order->id,
            'method' => $order->payment_method,
            'status' => $status,
            'amount' => $order->total_amount,
        ]);
    }
}
