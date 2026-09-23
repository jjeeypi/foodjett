<?php

namespace Tests\Feature\Admin;

use App\Models\Admin;
use App\Models\AuditLog;
use App\Models\Customer;
use App\Models\CustomerAddress;
use App\Models\Order;
use App\Models\OrderReport;
use App\Models\Payment;
use App\Models\Restaurant;
use App\Models\Rider;
use App\Models\RiderPoolOffer;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class AdminOrderManagementTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_filter_the_paginated_order_list(): void
    {
        $admin = Admin::factory()->create();
        $restaurant = Restaurant::factory()->approved()->create(['name' => 'Target Kitchen']);
        $matching = $this->createOrder([
            'restaurant_id' => $restaurant->id,
            'order_number' => 'FJT-SEARCH-100',
            'status' => 'preparing',
        ]);
        $this->createOrder(['order_number' => 'FJT-OTHER-200', 'status' => 'placed']);

        $this->actingAs($admin->user)
            ->get(route('admin.orders.index', [
                'search' => 'SEARCH',
                'status' => 'preparing',
                'restaurant_id' => $restaurant->id,
            ]))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('admin/orders/index')
                ->where('filters.search', 'SEARCH')
                ->where('filters.status', 'preparing')
                ->where('filters.restaurant_id', (string) $restaurant->id)
                ->has('orders.data', 1)
                ->where('orders.data.0.id', $matching->id)
                ->has('orders.links'));
    }

    public function test_admin_can_view_an_order_with_its_operational_context(): void
    {
        $admin = Admin::factory()->create();
        $order = $this->createOrder();
        $order->statusHistory()->create([
            'status' => 'placed',
            'changed_by' => 'customer',
            'note' => 'Order submitted.',
        ]);
        Payment::query()->create([
            'order_id' => $order->id,
            'method' => 'cod',
            'status' => 'pending',
            'amount' => $order->total_amount,
        ]);

        $this->actingAs($admin->user)
            ->get(route('admin.orders.show', $order))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('admin/orders/show')
                ->where('order.id', $order->id)
                ->has('order.restaurant')
                ->has('order.customer.user')
                ->has('order.delivery_address')
                ->has('order.status_history', 1)
                ->where('order.payment.status', 'pending'));
    }

    public function test_unassigned_queue_only_contains_escalated_searches(): void
    {
        $admin = Admin::factory()->create();
        $escalated = $this->createOrder([
            'status' => 'finding_rider',
            'rider_search_started_at' => now()->subMinutes(25),
        ]);
        RiderPoolOffer::query()->create([
            'order_id' => $escalated->id,
            'escalation_stage' => 'admin_alerted',
            'search_radius_km' => 8,
            'incentive_amount' => 35,
        ]);
        $ordinary = $this->createOrder([
            'status' => 'finding_rider',
            'rider_search_started_at' => now()->subMinutes(5),
        ]);
        RiderPoolOffer::query()->create([
            'order_id' => $ordinary->id,
            'escalation_stage' => 'widened',
        ]);

        $this->actingAs($admin->user)
            ->get(route('admin.orders.unassigned'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('admin/orders/unassigned')
                ->has('orders.data', 1)
                ->where('orders.data.0.id', $escalated->id)
                ->where('orders.data.0.pool_offer.escalation_stage', 'admin_alerted'));
    }

    public function test_nearby_riders_are_distance_sorted_and_cod_limit_is_enforced(): void
    {
        $admin = Admin::factory()->create();
        $restaurant = Restaurant::factory()->approved()->create([
            'latitude' => 9.3068,
            'longitude' => 123.3054,
        ]);
        $order = $this->createOrder([
            'restaurant_id' => $restaurant->id,
            'status' => 'finding_rider',
            'payment_method' => 'cod',
            'rider_search_started_at' => now()->subMinutes(20),
        ]);
        RiderPoolOffer::query()->create([
            'order_id' => $order->id,
            'escalation_stage' => 'admin_alerted',
        ]);
        $near = Rider::factory()->approved()->create([
            'current_latitude' => 9.3070,
            'current_longitude' => 123.3056,
            'cash_on_hand' => 100,
            'cash_remit_limit' => 500,
        ]);
        $far = Rider::factory()->approved()->create([
            'current_latitude' => 9.3200,
            'current_longitude' => 123.3200,
            'cash_on_hand' => 100,
            'cash_remit_limit' => 500,
        ]);
        $capped = Rider::factory()->approved()->create([
            'current_latitude' => 9.3069,
            'current_longitude' => 123.3055,
            'cash_on_hand' => 500,
            'cash_remit_limit' => 500,
        ]);

        $this->actingAs($admin->user)
            ->getJson(route('admin.orders.nearby-riders', $order))
            ->assertOk()
            ->assertJsonPath('riders.0.id', $near->id)
            ->assertJsonPath('riders.1.id', $far->id)
            ->assertJsonMissing(['id' => $capped->id]);
    }

    public function test_admin_can_manually_assign_an_available_rider(): void
    {
        $admin = Admin::factory()->create();
        $order = $this->createOrder([
            'status' => 'finding_rider',
            'rider_search_started_at' => now()->subMinutes(30),
        ]);
        $offer = RiderPoolOffer::query()->create([
            'order_id' => $order->id,
            'escalation_stage' => 'admin_alerted',
        ]);
        $rider = Rider::factory()->approved()->create();

        $this->actingAs($admin->user)
            ->patch(route('admin.orders.assign-rider', $order), [
                'rider_id' => $rider->id,
            ])
            ->assertRedirect()
            ->assertSessionHas('success');

        $this->assertDatabaseHas('orders', [
            'id' => $order->id,
            'rider_id' => $rider->id,
            'status' => 'rider_assigned',
        ]);
        $this->assertDatabaseHas('rider_pool_offers', [
            'id' => $offer->id,
            'admin_assigned' => true,
        ]);
        $this->assertDatabaseHas('order_status_history', [
            'order_id' => $order->id,
            'status' => 'rider_assigned',
            'changed_by' => 'admin',
        ]);
        $this->assertDatabaseHas('audit_logs', [
            'action' => 'order.rider_assigned',
            'subject_id' => $order->id,
        ]);
    }

    public function test_admin_cannot_assign_a_cash_limited_rider_to_a_cod_order(): void
    {
        $admin = Admin::factory()->create();
        $order = $this->createOrder([
            'status' => 'finding_rider',
            'payment_method' => 'cod',
            'rider_search_started_at' => now()->subMinutes(30),
        ]);
        RiderPoolOffer::query()->create([
            'order_id' => $order->id,
            'escalation_stage' => 'admin_alerted',
        ]);
        $rider = Rider::factory()->approved()->create([
            'cash_on_hand' => 500,
            'cash_remit_limit' => 500,
        ]);

        $this->actingAs($admin->user)
            ->from(route('admin.orders.unassigned'))
            ->patch(route('admin.orders.assign-rider', $order), [
                'rider_id' => $rider->id,
            ])
            ->assertRedirect(route('admin.orders.unassigned'))
            ->assertSessionHasErrors('rider_id');

        $this->assertDatabaseHas('orders', [
            'id' => $order->id,
            'rider_id' => null,
            'status' => 'finding_rider',
        ]);
    }

    public function test_admin_can_cancel_a_non_terminal_order_with_a_reason(): void
    {
        $admin = Admin::factory()->create();
        $order = $this->createOrder(['status' => 'preparing']);

        $this->actingAs($admin->user)
            ->patch(route('admin.orders.cancel', $order), [
                'reason' => 'Restaurant lost power during preparation.',
            ])
            ->assertRedirect()
            ->assertSessionHas('success');

        $this->assertDatabaseHas('orders', [
            'id' => $order->id,
            'status' => 'cancelled_by_admin',
            'cancelled_by' => 'admin',
            'cancellation_reason' => 'Restaurant lost power during preparation.',
        ]);
        $this->assertDatabaseHas('order_status_history', [
            'order_id' => $order->id,
            'status' => 'cancelled_by_admin',
            'changed_by' => 'admin',
        ]);
    }

    public function test_admin_can_record_a_full_refund_with_payment_history(): void
    {
        $admin = Admin::factory()->create();
        $order = $this->createOrder(['payment_method' => 'gcash']);
        $payment = Payment::query()->create([
            'order_id' => $order->id,
            'method' => 'gcash',
            'status' => 'paid',
            'amount' => $order->total_amount,
            'transaction_reference' => 'pay_test_123',
            'paid_at' => now(),
        ]);

        $this->actingAs($admin->user)
            ->patch(route('admin.orders.refund', $order), [
                'reason' => 'Customer and restaurant agreed on a full refund.',
            ])
            ->assertRedirect()
            ->assertSessionHas('success');

        $this->assertDatabaseHas('payments', [
            'id' => $payment->id,
            'status' => 'refunded',
            'refunded_amount' => $order->total_amount,
        ]);
        $this->assertDatabaseHas('payment_status_history', [
            'payment_id' => $payment->id,
            'from_status' => 'paid',
            'to_status' => 'refunded',
            'changed_by' => 'admin',
        ]);
        $this->assertDatabaseHas('audit_logs', [
            'action' => 'payment.refunded',
            'subject_id' => $payment->id,
        ]);
    }

    public function test_admin_can_filter_view_and_close_order_reports(): void
    {
        $admin = Admin::factory()->create();
        $order = $this->createOrder();
        $report = OrderReport::query()->create([
            'order_id' => $order->id,
            'reported_by_user_id' => $order->customer->user_id,
            'against' => 'rider',
            'type' => 'late_delivery',
            'description' => 'The delivery arrived much later than shown.',
            'status' => 'open',
        ]);
        OrderReport::query()->create([
            'order_id' => $order->id,
            'reported_by_user_id' => $order->customer->user_id,
            'against' => 'platform',
            'type' => 'other',
            'description' => 'A different report.',
            'status' => 'resolved',
            'resolution' => 'Already handled.',
            'resolved_by_admin_id' => $admin->id,
            'resolved_at' => now(),
        ]);

        $this->actingAs($admin->user)
            ->get(route('admin.orders.reports', [
                'status' => 'open',
                'type' => 'late_delivery',
                'against' => 'rider',
            ]))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('admin/orders/reports')
                ->has('reports.data', 1)
                ->where('reports.data.0.id', $report->id));

        $this->actingAs($admin->user)
            ->get(route('admin.orders.reports.show', $report))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('admin/orders/report-show')
                ->where('report.id', $report->id)
                ->where('report.order.order_number', $order->order_number));

        $this->actingAs($admin->user)
            ->patch(route('admin.orders.reports.resolve', $report), [
                'resolution' => 'A delivery credit was applied after review.',
            ])
            ->assertRedirect()
            ->assertSessionHas('success');

        $this->assertDatabaseHas('order_reports', [
            'id' => $report->id,
            'status' => 'resolved',
            'resolved_by_admin_id' => $admin->id,
            'resolution' => 'A delivery credit was applied after review.',
        ]);
        $this->assertSame(1, AuditLog::query()
            ->where('action', 'order_report.resolved')
            ->count());

        $reportToReject = OrderReport::query()->create([
            'order_id' => $order->id,
            'reported_by_user_id' => $order->customer->user_id,
            'against' => 'restaurant',
            'type' => 'wrong_item',
            'description' => 'The item did not match the receipt.',
            'status' => 'open',
        ]);

        $this->actingAs($admin->user)
            ->patch(route('admin.orders.reports.reject', $reportToReject), [
                'resolution' => 'Receipt and packing photo show the correct item.',
            ])
            ->assertRedirect()
            ->assertSessionHas('success');

        $this->assertDatabaseHas('order_reports', [
            'id' => $reportToReject->id,
            'status' => 'rejected',
            'resolved_by_admin_id' => $admin->id,
        ]);
    }

    public function test_non_admin_cannot_use_admin_order_actions(): void
    {
        $customer = Customer::factory()->create();
        $order = $this->createOrder();

        $this->actingAs($customer->user)
            ->patch(route('admin.orders.cancel', $order), ['reason' => 'Not allowed.'])
            ->assertForbidden();
    }

    /** @param array<string, mixed> $overrides */
    private function createOrder(array $overrides = []): Order
    {
        $customer = isset($overrides['customer_id'])
            ? Customer::query()->findOrFail($overrides['customer_id'])
            : Customer::factory()->create();
        $restaurant = isset($overrides['restaurant_id'])
            ? Restaurant::query()->findOrFail($overrides['restaurant_id'])
            : Restaurant::factory()->approved()->create();
        $address = CustomerAddress::factory()->create([
            'customer_id' => $customer->id,
        ]);

        return Order::query()->create(array_merge([
            'order_number' => 'FJT-'.fake()->unique()->numerify('########'),
            'customer_id' => $customer->id,
            'restaurant_id' => $restaurant->id,
            'customer_address_id' => $address->id,
            'status' => 'placed',
            'subtotal' => 420,
            'delivery_fee' => 50,
            'service_fee' => 10,
            'discount_amount' => 0,
            'tip_amount' => 20,
            'total_amount' => 500,
            'commission_amount' => 63,
            'payment_method' => 'cod',
            'placed_at' => now(),
        ], $overrides));
    }
}
