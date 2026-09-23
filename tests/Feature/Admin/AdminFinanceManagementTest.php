<?php

namespace Tests\Feature\Admin;

use App\Models\Admin;
use App\Models\Customer;
use App\Models\CustomerAddress;
use App\Models\Order;
use App\Models\Payment;
use App\Models\Restaurant;
use App\Models\RestaurantPayout;
use App\Models\Rider;
use App\Models\RiderCashRemittance;
use App\Models\RiderEarning;
use App\Models\RiderPayout;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class AdminFinanceManagementTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_filter_the_paginated_transaction_ledger(): void
    {
        $admin = Admin::factory()->create();
        $matchingOrder = $this->createOrder(['payment_method' => 'gcash']);
        $matchingPayment = Payment::query()->create([
            'order_id' => $matchingOrder->id,
            'method' => 'gcash',
            'status' => 'paid',
            'amount' => 500,
            'transaction_reference' => 'pay_matching',
            'paid_at' => now(),
        ]);
        $otherOrder = $this->createOrder(['payment_method' => 'cod']);
        Payment::query()->create([
            'order_id' => $otherOrder->id,
            'method' => 'cod',
            'status' => 'pending',
            'amount' => 500,
        ]);

        $this->actingAs($admin->user)
            ->get(route('admin.transactions.index', [
                'method' => 'gcash',
                'status' => 'paid',
                'date_from' => today()->toDateString(),
                'date_to' => today()->toDateString(),
            ]))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('admin/finance/transactions')
                ->where('filters.method', 'gcash')
                ->where('filters.status', 'paid')
                ->has('payments.data', 1)
                ->where('payments.data.0.id', $matchingPayment->id)
                ->where('payments.data.0.order.order_number', $matchingOrder->order_number)
                ->has('payments.data.0.order.restaurant')
                ->has('payments.data.0.order.customer.user')
                ->has('payments.links'));
    }

    public function test_admin_can_record_partial_then_full_refunds(): void
    {
        $admin = Admin::factory()->create();
        $order = $this->createOrder(['payment_method' => 'card']);
        $payment = Payment::query()->create([
            'order_id' => $order->id,
            'method' => 'card',
            'status' => 'paid',
            'amount' => 500,
            'transaction_reference' => 'pay_refund_test',
            'paid_at' => now(),
        ]);

        $this->actingAs($admin->user)
            ->patch(route('admin.transactions.refund', $payment), [
                'amount' => 125.50,
                'reason' => 'One item was unavailable.',
            ])
            ->assertRedirect()
            ->assertSessionHas('success');

        $this->assertDatabaseHas('payments', [
            'id' => $payment->id,
            'status' => 'partially_refunded',
            'refunded_amount' => 125.50,
        ]);
        $this->assertDatabaseHas('payment_status_history', [
            'payment_id' => $payment->id,
            'from_status' => 'paid',
            'to_status' => 'partially_refunded',
            'changed_by' => 'admin',
        ]);

        $this->actingAs($admin->user)
            ->patch(route('admin.transactions.refund', $payment), [
                'amount' => 374.50,
                'reason' => 'Refunding the remaining balance.',
            ])
            ->assertRedirect()
            ->assertSessionHas('success');

        $this->assertDatabaseHas('payments', [
            'id' => $payment->id,
            'status' => 'refunded',
            'refunded_amount' => 500,
        ]);
        $this->assertDatabaseHas('payment_status_history', [
            'payment_id' => $payment->id,
            'from_status' => 'partially_refunded',
            'to_status' => 'refunded',
            'changed_by' => 'admin',
        ]);
        $this->assertDatabaseCount('audit_logs', 2);
    }

    public function test_refund_cannot_exceed_the_remaining_payment_balance(): void
    {
        $admin = Admin::factory()->create();
        $order = $this->createOrder(['payment_method' => 'gcash']);
        $payment = Payment::query()->create([
            'order_id' => $order->id,
            'method' => 'gcash',
            'status' => 'partially_refunded',
            'amount' => 500,
            'refunded_amount' => 100,
            'paid_at' => now(),
        ]);

        $this->actingAs($admin->user)
            ->from(route('admin.transactions.index'))
            ->patch(route('admin.transactions.refund', $payment), ['amount' => 401])
            ->assertRedirect(route('admin.transactions.index'))
            ->assertSessionHasErrors('amount');

        $this->assertSame('100.00', $payment->refresh()->refunded_amount);
    }

    public function test_admin_can_generate_and_pay_restaurant_payouts_without_overlap(): void
    {
        $admin = Admin::factory()->create();
        $restaurant = Restaurant::factory()->approved()->create();
        $this->createOrder([
            'restaurant_id' => $restaurant->id,
            'status' => 'delivered',
            'subtotal' => 400,
            'total_amount' => 460,
            'commission_amount' => 60,
            'delivered_at' => now()->subDay(),
        ]);
        $this->createOrder([
            'restaurant_id' => $restaurant->id,
            'status' => 'preparing',
            'subtotal' => 999,
            'commission_amount' => 100,
        ]);

        $periodStart = now()->subDays(2)->toDateString();
        $periodEnd = now()->toDateString();

        $this->actingAs($admin->user)
            ->post(route('admin.payouts.restaurants.generate'), [
                'period_start' => $periodStart,
                'period_end' => $periodEnd,
            ])
            ->assertRedirect()
            ->assertSessionHas('success');

        $payout = RestaurantPayout::query()->sole();
        $this->assertSame('400.00', $payout->gross_sales);
        $this->assertSame('60.00', $payout->commission_deducted);
        $this->assertSame('340.00', $payout->net_amount);
        $this->assertSame('pending', $payout->status);

        $this->actingAs($admin->user)
            ->from(route('admin.payouts.restaurants'))
            ->post(route('admin.payouts.restaurants.generate'), [
                'period_start' => now()->subDay()->toDateString(),
                'period_end' => $periodEnd,
            ])
            ->assertRedirect(route('admin.payouts.restaurants'))
            ->assertSessionHasErrors('period_start');
        $this->assertDatabaseCount('restaurant_payouts', 1);

        $this->actingAs($admin->user)
            ->patch(route('admin.payouts.restaurants.paid', $payout))
            ->assertRedirect()
            ->assertSessionHas('success');

        $this->assertSame('paid', $payout->refresh()->status);
        $this->assertNotNull($payout->paid_at);
        $this->assertDatabaseHas('audit_logs', [
            'action' => 'restaurant_payout.paid',
            'subject_id' => $payout->id,
        ]);
    }

    public function test_admin_can_filter_restaurant_payouts(): void
    {
        $admin = Admin::factory()->create();
        $restaurant = Restaurant::factory()->approved()->create();
        $matching = RestaurantPayout::query()->create([
            'restaurant_id' => $restaurant->id,
            'period_start' => now()->subWeek()->toDateString(),
            'period_end' => now()->subDay()->toDateString(),
            'gross_sales' => 1000,
            'commission_deducted' => 150,
            'net_amount' => 850,
            'status' => 'pending',
        ]);

        $this->actingAs($admin->user)
            ->get(route('admin.payouts.restaurants', [
                'status' => 'pending',
                'restaurant_id' => $restaurant->id,
            ]))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('admin/finance/restaurant-payouts')
                ->has('payouts.data', 1)
                ->where('payouts.data.0.id', $matching->id));
    }

    public function test_admin_can_generate_and_pay_rider_payouts_from_earnings(): void
    {
        $admin = Admin::factory()->create();
        $rider = Rider::factory()->approved()->create();
        $order = $this->createOrder([
            'rider_id' => $rider->id,
            'status' => 'delivered',
            'delivered_at' => now()->subDay(),
        ]);
        RiderEarning::query()->create([
            'rider_id' => $rider->id,
            'order_id' => $order->id,
            'base_pay' => 40,
            'distance_pay' => 25.50,
            'waiting_pay' => 10,
            'incentive_pay' => 5,
            'tip_amount' => 20,
            'total_earned' => 100.50,
        ]);

        $this->actingAs($admin->user)
            ->post(route('admin.payouts.riders.generate'), [
                'period_start' => now()->subDays(2)->toDateString(),
                'period_end' => now()->toDateString(),
            ])
            ->assertRedirect()
            ->assertSessionHas('success');

        $payout = RiderPayout::query()->sole();
        $this->assertSame($rider->id, $payout->rider_id);
        $this->assertSame('100.50', $payout->total_amount);
        $this->assertSame('pending', $payout->status);

        $this->actingAs($admin->user)
            ->patch(route('admin.payouts.riders.paid', $payout))
            ->assertRedirect()
            ->assertSessionHas('success');

        $this->assertSame('paid', $payout->refresh()->status);
        $this->assertNotNull($payout->paid_at);
        $this->assertDatabaseHas('audit_logs', [
            'action' => 'rider_payout.paid',
            'subject_id' => $payout->id,
        ]);
    }

    public function test_cash_remittance_page_and_confirmation_include_live_rider_balance_and_audit(): void
    {
        $admin = Admin::factory()->create();
        $rider = Rider::factory()->approved()->create(['cash_on_hand' => 300]);
        $originalRemittedAt = now()->subHour()->startOfSecond();
        $remittance = RiderCashRemittance::query()->create([
            'rider_id' => $rider->id,
            'amount' => 200,
            'reference_note' => 'Deposit 123',
            'status' => 'pending',
            'remitted_at' => $originalRemittedAt,
        ]);

        $this->actingAs($admin->user)
            ->get(route('admin.remittances.index', ['status' => 'pending']))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('admin/finance/cash-remittances')
                ->has('remittances.data', 1)
                ->where('remittances.data.0.id', $remittance->id)
                ->where('remittances.data.0.rider.cash_on_hand', '300.00'));

        $this->actingAs($admin->user)
            ->patch(route('admin.remittances.confirm', $remittance))
            ->assertRedirect()
            ->assertSessionHas('success');

        $this->assertSame('confirmed', $remittance->refresh()->status);
        $this->assertSame(
            $originalRemittedAt->format('Y-m-d H:i:s'),
            $remittance->refresh()->getRawOriginal('remitted_at')
        );
        $this->assertSame('100.00', $rider->refresh()->cash_on_hand);
        $this->assertDatabaseHas('audit_logs', [
            'action' => 'rider_remittance.confirmed',
            'subject_id' => $remittance->id,
        ]);
    }

    public function test_non_admin_cannot_access_finance_actions(): void
    {
        $customer = Customer::factory()->create();

        $this->actingAs($customer->user)
            ->get(route('admin.transactions.index'))
            ->assertForbidden();

        $this->actingAs($customer->user)
            ->post(route('admin.payouts.restaurants.generate'), [
                'period_start' => now()->subWeek()->toDateString(),
                'period_end' => now()->toDateString(),
            ])
            ->assertForbidden();
    }

    /** @param  array<string, mixed>  $overrides */
    private function createOrder(array $overrides = []): Order
    {
        $customerId = $overrides['customer_id'] ?? null;
        $restaurantId = $overrides['restaurant_id'] ?? null;
        $customer = is_int($customerId)
            ? Customer::query()->whereKey($customerId)->firstOrFail()
            : Customer::factory()->create();
        $restaurant = is_int($restaurantId)
            ? Restaurant::query()->whereKey($restaurantId)->firstOrFail()
            : Restaurant::factory()->approved()->create();
        $address = CustomerAddress::factory()->create(['customer_id' => $customer->id]);

        return Order::query()->create(array_merge([
            'order_number' => 'FJT-FIN-'.fake()->unique()->numerify('######'),
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
            'payment_method' => 'cod',
            'placed_at' => now(),
        ], $overrides));
    }
}
