<?php

namespace Tests\Feature\Rider;

use App\Models\Customer;
use App\Models\CustomerAddress;
use App\Models\Order;
use App\Models\Restaurant;
use App\Models\Rider;
use App\Models\RiderCashRemittance;
use App\Models\RiderEarning;
use App\Models\RiderPayout;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class RiderEarningsTest extends TestCase
{
    use RefreshDatabase;

    public function test_rider_sees_scoped_summaries_filtered_earnings_payouts_and_cash(): void
    {
        $this->travelTo(Carbon::parse('2026-09-30 12:00:00'));
        $rider = Rider::factory()->approved()->create([
            'cash_on_hand' => 450,
            'cash_remit_limit' => 500,
        ]);
        $otherRider = Rider::factory()->approved()->create();

        $today = $this->makeEarning($rider, '2026-09-30 10:00:00', 100);
        $this->makeEarning($rider, '2026-09-28 09:00:00', 50);
        $this->makeEarning($rider, '2026-09-02 14:00:00', 25);
        $this->makeEarning($rider, '2026-08-31 14:00:00', 10);
        $this->makeEarning($otherRider, '2026-09-30 11:00:00', 999);

        $payout = RiderPayout::query()->create([
            'rider_id' => $rider->id,
            'period_start' => '2026-09-01',
            'period_end' => '2026-09-15',
            'total_amount' => 175,
            'status' => 'paid',
            'paid_at' => now()->subDay(),
        ]);
        RiderPayout::query()->create([
            'rider_id' => $otherRider->id,
            'period_start' => '2026-09-01',
            'period_end' => '2026-09-15',
            'total_amount' => 999,
            'status' => 'pending',
        ]);
        $pending = RiderCashRemittance::query()->create([
            'rider_id' => $rider->id,
            'amount' => 100,
            'reference_note' => 'Deposit 100',
            'status' => 'pending',
        ]);
        RiderCashRemittance::query()->create([
            'rider_id' => $otherRider->id,
            'amount' => 200,
            'status' => 'pending',
        ]);

        $this->actingAs($rider->user)
            ->get(route('rider.earnings', [
                'from' => '2026-09-28',
                'to' => '2026-09-30',
            ]))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('rider/earnings/index')
                ->where('summary.today', 100)
                ->where('summary.week', 150)
                ->where('summary.month', 175)
                ->where('filters.from', '2026-09-28')
                ->where('filters.to', '2026-09-30')
                ->where('earnings.total', 2)
                ->has('earnings.data', 2)
                ->where('earnings.data.0.id', $today->id)
                ->where('earnings.data.0.order_number', $today->order->order_number)
                ->where('earnings.data.0.total_earned', 100)
                ->has('payouts', 1)
                ->where('payouts.0.id', $payout->id)
                ->where('payouts.0.status', 'paid')
                ->where('cash.cash_on_hand', 450)
                ->where('cash.cash_remit_limit', 500)
                ->where('cash.pending_remittance_total', 100)
                ->where('cash.available_to_remit', 350)
                ->has('remittances', 1)
                ->where('remittances.0.id', $pending->id));
    }

    public function test_remittance_submission_from_earnings_remains_scoped_and_reserves_cash(): void
    {
        $rider = Rider::factory()->approved()->create([
            'cash_on_hand' => 300,
            'cash_remit_limit' => 500,
        ]);
        RiderCashRemittance::query()->create([
            'rider_id' => $rider->id,
            'amount' => 100,
            'status' => 'pending',
        ]);

        $this->actingAs($rider->user)
            ->post(route('rider.remittances.store'), [
                'amount' => 200,
                'reference_note' => 'Receipt 456',
            ])
            ->assertRedirect()
            ->assertSessionHasNoErrors();

        $this->assertDatabaseHas('rider_cash_remittances', [
            'rider_id' => $rider->id,
            'amount' => 200,
            'reference_note' => 'Receipt 456',
            'status' => 'pending',
        ]);

        $this->actingAs($rider->user)
            ->post(route('rider.remittances.store'), ['amount' => 0.01])
            ->assertSessionHasErrors('amount');
    }

    private function makeEarning(Rider $rider, string $deliveredAt, float $total): RiderEarning
    {
        $customer = Customer::factory()->create();
        $address = CustomerAddress::factory()->create(['customer_id' => $customer->id]);
        $restaurant = Restaurant::factory()->approved()->create();
        $order = Order::query()->create([
            'order_number' => 'FJ-'.fake()->unique()->numerify('########'),
            'customer_id' => $customer->id,
            'restaurant_id' => $restaurant->id,
            'customer_address_id' => $address->id,
            'rider_id' => $rider->id,
            'status' => 'delivered',
            'subtotal' => 200,
            'delivery_fee' => 50,
            'service_fee' => 0,
            'discount_amount' => 0,
            'tip_amount' => 0,
            'total_amount' => 250,
            'payment_method' => 'card',
            'placed_at' => Carbon::parse($deliveredAt)->subHour(),
            'delivered_at' => Carbon::parse($deliveredAt),
        ]);

        return RiderEarning::query()->create([
            'rider_id' => $rider->id,
            'order_id' => $order->id,
            'base_pay' => $total,
            'distance_pay' => 0,
            'waiting_pay' => 0,
            'incentive_pay' => 0,
            'tip_amount' => 0,
            'total_earned' => $total,
        ]);
    }
}
