<?php

namespace Tests\Feature\Authorization;

use App\Models\Admin;
use App\Models\Customer;
use App\Models\CustomerAddress;
use App\Models\MenuCategory;
use App\Models\MenuItem;
use App\Models\Order;
use App\Models\Restaurant;
use App\Models\Rider;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Gate;
use Tests\TestCase;

class OwnershipPolicyTest extends TestCase
{
    use RefreshDatabase;

    public function test_restaurant_can_only_update_its_own_menu_items(): void
    {
        $restaurant = Restaurant::factory()->approved()->create();
        $otherRestaurant = Restaurant::factory()->approved()->create();
        $category = MenuCategory::factory()->create(['restaurant_id' => $restaurant->id]);
        $otherCategory = MenuCategory::factory()->create(['restaurant_id' => $otherRestaurant->id]);
        $item = MenuItem::factory()->create(['menu_category_id' => $category->id]);
        $otherItem = MenuItem::factory()->create(['menu_category_id' => $otherCategory->id]);

        $this->assertTrue(Gate::forUser($restaurant->user)->allows('update', $item));
        $this->assertFalse(Gate::forUser($restaurant->user)->allows('update', $otherItem));
    }

    public function test_admin_policy_override_allows_access_to_any_owned_record(): void
    {
        $admin = Admin::factory()->create()->user;
        $address = CustomerAddress::factory()->create();

        $this->assertTrue(Gate::forUser($admin)->allows('update', $address));
    }

    public function test_order_restaurant_updates_are_limited_to_the_orders_restaurant(): void
    {
        $restaurant = Restaurant::factory()->approved()->create();
        $otherRestaurant = Restaurant::factory()->approved()->create();
        $order = $this->makeOrder($restaurant);

        $this->assertTrue(Gate::forUser($restaurant->user)->allows('updateAsRestaurant', $order));
        $this->assertFalse(Gate::forUser($otherRestaurant->user)->allows('updateAsRestaurant', $order));
    }

    public function test_any_approved_rider_can_accept_a_pool_order_but_only_the_assigned_rider_can_update_it_afterwards(): void
    {
        $restaurant = Restaurant::factory()->approved()->create();
        $rider = Rider::factory()->create(['approval_status' => 'approved']);
        $otherRider = Rider::factory()->create(['approval_status' => 'approved']);
        $order = $this->makeOrder($restaurant, [
            'status' => 'finding_rider',
            'rider_id' => null,
        ]);

        $this->assertTrue(Gate::forUser($rider->user)->allows('updateAsRider', $order));
        $this->assertTrue(Gate::forUser($otherRider->user)->allows('updateAsRider', $order));

        $order->update([
            'status' => 'rider_assigned',
            'rider_id' => $rider->id,
        ]);

        $this->assertTrue(Gate::forUser($rider->user)->allows('updateAsRider', $order));
        $this->assertFalse(Gate::forUser($otherRider->user)->allows('updateAsRider', $order));
    }

    public function test_only_the_orders_customer_can_cancel_it(): void
    {
        $restaurant = Restaurant::factory()->approved()->create();
        $order = $this->makeOrder($restaurant);
        $otherCustomer = Customer::factory()->create();

        $this->assertTrue(Gate::forUser($order->customer->user)->allows('cancel', $order));
        $this->assertFalse(Gate::forUser($otherCustomer->user)->allows('cancel', $order));
        $this->assertFalse(Gate::forUser($restaurant->user)->allows('cancel', $order));
    }

    /**
     * @param  array<string, mixed>  $overrides
     */
    private function makeOrder(Restaurant $restaurant, array $overrides = []): Order
    {
        $customer = Customer::factory()->create();
        $address = CustomerAddress::factory()->create(['customer_id' => $customer->id]);

        return Order::create([
            'order_number' => 'FJ-'.fake()->unique()->numerify('######'),
            'customer_id' => $customer->id,
            'restaurant_id' => $restaurant->id,
            'customer_address_id' => $address->id,
            'status' => 'placed',
            'subtotal' => 100,
            'delivery_fee' => 30,
            'total_amount' => 130,
            'payment_method' => 'cod',
            ...$overrides,
        ]);
    }
}
