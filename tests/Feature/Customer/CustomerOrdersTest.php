<?php

namespace Tests\Feature\Customer;

use App\Models\Customer;
use App\Models\CustomerAddress;
use App\Models\MenuCategory;
use App\Models\MenuItem;
use App\Models\MenuItemAddon;
use App\Models\MenuItemVariant;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\OrderItemAddon;
use App\Models\Payment;
use App\Models\Restaurant;
use App\Models\Rider;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Gate;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class CustomerOrdersTest extends TestCase
{
    use RefreshDatabase;

    public function test_history_is_scoped_to_customer_and_split_into_active_and_past_tabs(): void
    {
        $customer = Customer::factory()->create();
        $active = $this->makeOrder($customer, ['status' => 'preparing']);
        $past = $this->makeOrder($customer, [
            'status' => 'delivered',
            'delivered_at' => now(),
        ]);
        $this->makeOrder(Customer::factory()->create(), ['status' => 'preparing']);

        $this->actingAs($customer->user)
            ->get(route('customer.orders.index', ['tab' => 'active']))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('customer/orders/index')
                ->where('tab', 'active')
                ->has('orders.data', 1)
                ->where('orders.data.0.id', $active->id)
                ->where('orders.data.0.can_reorder', false));

        $this->actingAs($customer->user)
            ->get(route('customer.orders.index', ['tab' => 'past']))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('tab', 'past')
                ->has('orders.data', 1)
                ->where('orders.data.0.id', $past->id)
                ->where('orders.data.0.can_reorder', true));
    }

    public function test_show_contains_the_itemized_receipt_payment_and_delivery_details(): void
    {
        $customer = Customer::factory()->create();
        $order = $this->makeOrder($customer);
        [$item, $variant, $addon] = $this->menuSelection($order->restaurant);
        $orderItem = OrderItem::query()->create([
            'order_id' => $order->id,
            'menu_item_id' => $item->id,
            'menu_item_variant_id' => $variant->id,
            'quantity' => 2,
            'unit_price' => 120,
            'special_instructions' => 'No onions',
        ]);
        OrderItemAddon::query()->create([
            'order_item_id' => $orderItem->id,
            'menu_item_addon_id' => $addon->id,
            'price' => 15,
        ]);
        Payment::query()->create([
            'order_id' => $order->id,
            'method' => 'cod',
            'status' => 'pending',
            'amount' => $order->total_amount,
        ]);

        $this->actingAs($customer->user)
            ->get(route('customer.orders.show', $order))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('customer/orders/show')
                ->where('order.id', $order->id)
                ->where('order.items.0.name', $item->name)
                ->where('order.items.0.variant', $variant->name)
                ->where('order.items.0.addons.0.name', $addon->name)
                ->where('order.items.0.line_total', 270)
                ->where('order.payment.status', 'pending')
                ->where('order.can_cancel', true)
                ->where(
                    'order.delivery_address.address_line',
                    $order->deliveryAddress->address_line,
                ));
    }

    public function test_customer_cancellation_is_allowed_before_acceptance_but_not_after_acceptance(): void
    {
        $customer = Customer::factory()->create();
        $placed = $this->makeOrder($customer, [
            'status' => 'placed',
            'payment_method' => 'gcash',
        ]);
        $payment = Payment::query()->create([
            'order_id' => $placed->id,
            'method' => 'gcash',
            'status' => 'paid',
            'amount' => $placed->total_amount,
            'paid_at' => now(),
        ]);
        $accepted = $this->makeOrder($customer, ['status' => 'accepted']);

        $this->assertTrue(Gate::forUser($customer->user)->allows('cancel', $placed));
        $this->assertFalse(Gate::forUser($customer->user)->allows('cancel', $accepted));

        $this->actingAs($customer->user)
            ->patch(route('customer.orders.cancel', $placed))
            ->assertRedirect(route('customer.orders.show', $placed));

        $this->assertSame('cancelled_by_customer', $placed->refresh()->status);
        $this->assertSame('refunded', $payment->refresh()->status);

        $this->actingAs($customer->user)
            ->patch(route('customer.orders.cancel', $accepted))
            ->assertForbidden();
    }

    public function test_reorder_returns_current_available_items_and_current_prices(): void
    {
        $customer = Customer::factory()->create();
        $order = $this->makeOrder($customer, [
            'status' => 'delivered',
            'delivered_at' => now(),
        ]);
        [$item, $variant, $addon] = $this->menuSelection($order->restaurant);
        $orderItem = OrderItem::query()->create([
            'order_id' => $order->id,
            'menu_item_id' => $item->id,
            'menu_item_variant_id' => $variant->id,
            'quantity' => 2,
            'unit_price' => 100,
            'special_instructions' => 'Extra napkins',
        ]);
        OrderItemAddon::query()->create([
            'order_item_id' => $orderItem->id,
            'menu_item_addon_id' => $addon->id,
            'price' => 10,
        ]);
        $item->update(['base_price' => 110]);

        $this->actingAs($customer->user)
            ->postJson(route('customer.orders.reorder', $order))
            ->assertOk()
            ->assertJsonPath('price_changed', true)
            ->assertJsonPath('items.0.menuItemId', $item->id)
            ->assertJsonPath('items.0.basePrice', 110)
            ->assertJsonPath('items.0.variant.id', $variant->id)
            ->assertJsonPath('items.0.addons.0.id', $addon->id);

        $addon->update(['is_available' => false]);
        $this->actingAs($customer->user)
            ->postJson(route('customer.orders.reorder', $order))
            ->assertUnprocessable()
            ->assertJsonValidationErrors('order');
    }

    public function test_delivered_order_can_be_reviewed_once_for_restaurant_and_rider(): void
    {
        $customer = Customer::factory()->create();
        $rider = Rider::factory()->approved()->create();
        $order = $this->makeOrder($customer, [
            'status' => 'delivered',
            'rider_id' => $rider->id,
            'delivered_at' => now(),
        ]);

        $this->actingAs($customer->user)
            ->post(route('customer.orders.review', $order), [
                'restaurant_rating' => 5,
                'rider_rating' => 4,
                'comment' => 'Fresh food and careful packaging.',
            ])
            ->assertRedirect();

        $this->assertDatabaseHas('restaurant_reviews', [
            'order_id' => $order->id,
            'customer_id' => $customer->id,
            'rating' => 5,
        ]);
        $this->assertDatabaseHas('rider_reviews', [
            'order_id' => $order->id,
            'rider_id' => $rider->id,
            'rating' => 4,
        ]);

        $this->actingAs($customer->user)
            ->post(route('customer.orders.review', $order), [
                'restaurant_rating' => 1,
                'rider_rating' => 1,
            ])
            ->assertSessionHasErrors('restaurant_rating');
    }

    public function test_problem_reports_are_allowed_while_active_and_for_seven_days_after_delivery(): void
    {
        $customer = Customer::factory()->create();
        $active = $this->makeOrder($customer, ['status' => 'on_the_way']);
        $expired = $this->makeOrder($customer, [
            'status' => 'delivered',
            'delivered_at' => now()->subDays(8),
        ]);

        $this->actingAs($customer->user)
            ->post(route('customer.orders.reports.store', $active), [
                'type' => 'missing_item',
                'description' => 'The drink is missing from the bag.',
            ])
            ->assertRedirect();

        $this->assertDatabaseHas('order_reports', [
            'order_id' => $active->id,
            'reported_by_user_id' => $customer->user_id,
            'against' => 'restaurant',
            'type' => 'missing_item',
            'status' => 'open',
        ]);

        $this->actingAs($customer->user)
            ->post(route('customer.orders.reports.store', $expired), [
                'type' => 'other',
                'description' => 'This should be outside the reporting window.',
            ])
            ->assertForbidden();
    }

    /** @param array<string, mixed> $overrides */
    private function makeOrder(Customer $customer, array $overrides = []): Order
    {
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

    /** @return array{MenuItem, MenuItemVariant, MenuItemAddon} */
    private function menuSelection(Restaurant $restaurant): array
    {
        $category = MenuCategory::factory()->create(['restaurant_id' => $restaurant->id]);
        $item = MenuItem::factory()->available()->create([
            'menu_category_id' => $category->id,
            'base_price' => 100,
        ]);
        $variant = MenuItemVariant::factory()->create([
            'menu_item_id' => $item->id,
            'price_delta' => 20,
        ]);
        $addon = MenuItemAddon::factory()->create([
            'menu_item_id' => $item->id,
            'price' => 15,
        ]);

        return [$item, $variant, $addon];
    }
}
