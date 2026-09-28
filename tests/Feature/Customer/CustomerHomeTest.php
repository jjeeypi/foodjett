<?php

namespace Tests\Feature\Customer;

use App\Models\Customer;
use App\Models\CustomerAddress;
use App\Models\MenuCategory;
use App\Models\MenuItem;
use App\Models\Order;
use App\Models\Restaurant;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class CustomerHomeTest extends TestCase
{
    use RefreshDatabase;

    public function test_customer_home_shows_featured_and_nearby_open_restaurants(): void
    {
        $customer = Customer::factory()->create();
        CustomerAddress::factory()->default()->create([
            'customer_id' => $customer->id,
            'latitude' => 9.3070,
            'longitude' => 123.3000,
        ]);
        $nearRestaurant = Restaurant::factory()->approved()->create([
            'name' => 'Near Filipino Kitchen',
            'cuisine_type' => 'Filipino',
            'latitude' => 9.3075,
            'longitude' => 123.3005,
        ]);
        $farRestaurant = Restaurant::factory()->approved()->create([
            'name' => 'Far Dessert Shop',
            'cuisine_type' => 'Desserts',
            'latitude' => 9.3170,
            'longitude' => 123.3100,
        ]);
        $closedRestaurant = Restaurant::factory()->approved()->create([
            'name' => 'Closed Restaurant',
            'operating_status' => 'closed',
        ]);
        $category = MenuCategory::factory()->create([
            'restaurant_id' => $nearRestaurant->id,
        ]);
        MenuItem::factory()->available()->create([
            'menu_category_id' => $category->id,
            'is_featured' => true,
        ]);

        $this->actingAs($customer->user)
            ->get(route('customer.home'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('customer/home')
                ->where('featuredSource', 'featured_items')
                ->has('featuredRestaurants', 1)
                ->where('featuredRestaurants.0.id', $nearRestaurant->id)
                ->has('nearbyRestaurants', 2)
                ->where('nearbyRestaurants.0.id', $nearRestaurant->id)
                ->where('nearbyRestaurants.1.id', $farRestaurant->id)
                ->where('defaultAddress.is_default', true)
                ->where('customerContext.active_order', null)
                ->where('nearbyRestaurants', fn ($restaurants): bool => collect($restaurants)
                    ->doesntContain('id', $closedRestaurant->id)));
    }

    public function test_home_cuisine_search_lands_on_the_filtered_search_page(): void
    {
        $customer = Customer::factory()->create();
        CustomerAddress::factory()->default()->create(['customer_id' => $customer->id]);
        $matchingRestaurant = Restaurant::factory()->approved()->create([
            'name' => 'Lola Nena Kitchen',
            'cuisine_type' => 'Filipino',
        ]);
        Restaurant::factory()->approved()->create([
            'name' => 'Burger Corner',
            'cuisine_type' => 'Fast Food',
        ]);

        $this->actingAs($customer->user)
            ->get(route('customer.search.index', [
                'cuisine' => 'Filipino',
                'q' => 'Lola',
            ]))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('customer/search/index')
                ->where('filters.cuisine', 'Filipino')
                ->where('filters.q', 'Lola')
                ->has('results.data', 1)
                ->where('results.data.0.id', $matchingRestaurant->id));
    }

    public function test_home_prompts_for_an_address_instead_of_building_nearby_results(): void
    {
        $customer = Customer::factory()->create();
        Restaurant::factory()->approved()->create();

        $this->actingAs($customer->user)
            ->get(route('customer.home'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('defaultAddress', null)
                ->has('nearbyRestaurants', 0)
                ->has('featuredRestaurants', 1));
    }

    public function test_layout_receives_the_customers_latest_active_order(): void
    {
        $customer = Customer::factory()->create();
        $address = CustomerAddress::factory()->create(['customer_id' => $customer->id]);
        $restaurant = Restaurant::factory()->approved()->create();
        $order = $this->createOrder($customer, $address, $restaurant, 'preparing');
        $this->createOrder($customer, $address, $restaurant, 'delivered');

        $this->actingAs($customer->user)
            ->get(route('customer.home'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('customerContext.active_order.id', $order->id)
                ->where('customerContext.active_order.order_number', $order->order_number)
                ->where('customerContext.active_order.status', 'preparing')
                ->where(
                    'customerContext.active_order.track_url',
                    route('customer.orders.track', $order, absolute: false),
                ));
    }

    private function createOrder(
        Customer $customer,
        CustomerAddress $address,
        Restaurant $restaurant,
        string $status,
    ): Order {
        return Order::query()->create([
            'order_number' => 'FJ-'.fake()->unique()->numerify('########'),
            'customer_id' => $customer->id,
            'restaurant_id' => $restaurant->id,
            'customer_address_id' => $address->id,
            'status' => $status,
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
    }
}
