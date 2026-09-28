<?php

namespace Tests\Feature\Customer;

use App\Models\Customer;
use App\Models\CustomerAddress;
use App\Models\MenuCategory;
use App\Models\MenuItem;
use App\Models\MenuItemAddon;
use App\Models\MenuItemVariant;
use App\Models\Order;
use App\Models\Restaurant;
use App\Models\RestaurantOperatingHour;
use App\Models\RestaurantReview;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class CustomerBrowsingTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        CarbonImmutable::setTestNow(CarbonImmutable::parse('2026-09-28 12:00:00', 'Asia/Manila'));
    }

    protected function tearDown(): void
    {
        CarbonImmutable::setTestNow();
        parent::tearDown();
    }

    public function test_restaurant_page_shows_menu_options_hours_and_paginated_reviews(): void
    {
        $customer = Customer::factory()->create();
        CustomerAddress::factory()->default()->create(['customer_id' => $customer->id]);
        $restaurant = Restaurant::factory()->approved()->create([
            'name' => 'Monday Kitchen',
            'operating_status' => 'open',
            'min_order_amount' => 150,
        ]);
        RestaurantOperatingHour::factory()->create([
            'restaurant_id' => $restaurant->id,
            'day_of_week' => 1,
            'opens_at' => '08:00:00',
            'closes_at' => '20:00:00',
        ]);
        $category = MenuCategory::factory()->create([
            'restaurant_id' => $restaurant->id,
            'name' => 'Rice Meals',
            'sort_order' => 1,
        ]);
        $available = MenuItem::factory()->available()->create([
            'menu_category_id' => $category->id,
            'name' => 'Chicken Adobo',
            'available_from' => '10:00:00',
            'available_until' => '14:00:00',
        ]);
        MenuItemVariant::factory()->create([
            'menu_item_id' => $available->id,
            'name' => 'Large',
            'price_delta' => 30,
        ]);
        MenuItemAddon::factory()->create([
            'menu_item_id' => $available->id,
            'name' => 'Extra Rice',
            'price' => 25,
        ]);
        MenuItem::factory()->create([
            'menu_category_id' => $category->id,
            'name' => 'Sold Out Sisig',
            'is_available' => false,
        ]);
        MenuItem::factory()->available()->create([
            'menu_category_id' => $category->id,
            'name' => 'Dinner Special',
            'available_from' => '18:00:00',
            'available_until' => '22:00:00',
        ]);
        $order = $this->createOrder($customer, $restaurant);
        RestaurantReview::query()->create([
            'order_id' => $order->id,
            'customer_id' => $customer->id,
            'restaurant_id' => $restaurant->id,
            'rating' => 5,
            'comment' => 'Excellent food.',
            'restaurant_reply' => 'Thank you!',
            'replied_at' => now(),
        ]);

        $this->actingAs($customer->user)
            ->get(route('customer.restaurants.show', $restaurant))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('customer/restaurants/show')
                ->where('restaurant.id', $restaurant->id)
                ->where('restaurant.is_open', true)
                ->where('restaurant.min_order_amount', 150)
                ->has('restaurant.opening_hours', 1)
                ->where('restaurant.opening_hours.0.day', 'Monday')
                ->has('restaurant.menu_categories', 1)
                ->has('restaurant.menu_categories.0.items', 3)
                ->where('restaurant.menu_categories.0.items.0.name', 'Chicken Adobo')
                ->where('restaurant.menu_categories.0.items.0.is_available', true)
                ->has('restaurant.menu_categories.0.items.0.variants', 1)
                ->has('restaurant.menu_categories.0.items.0.addons', 1)
                ->where('restaurant.menu_categories.0.items.1.name', 'Dinner Special')
                ->where('restaurant.menu_categories.0.items.1.is_available', false)
                ->where('restaurant.menu_categories.0.items.2.name', 'Sold Out Sisig')
                ->where('restaurant.menu_categories.0.items.2.availability_label', 'Sold out')
                ->has('reviews.data', 1)
                ->where('reviews.data.0.customer_name', $customer->user->name)
                ->where('reviews.data.0.restaurant_reply', 'Thank you!'));
    }

    public function test_restaurant_hours_can_close_the_menu_without_hiding_it(): void
    {
        $customer = Customer::factory()->create();
        $restaurant = Restaurant::factory()->approved()->create(['operating_status' => 'open']);
        RestaurantOperatingHour::factory()->create([
            'restaurant_id' => $restaurant->id,
            'day_of_week' => 1,
            'opens_at' => '18:00:00',
            'closes_at' => '22:00:00',
        ]);
        $category = MenuCategory::factory()->create(['restaurant_id' => $restaurant->id]);
        MenuItem::factory()->available()->create(['menu_category_id' => $category->id]);

        $this->actingAs($customer->user)
            ->get(route('customer.restaurants.show', $restaurant))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('restaurant.is_open', false)
                ->where('restaurant.closed_message', 'This restaurant is outside its opening hours.')
                ->has('restaurant.menu_categories.0.items', 1));
    }

    public function test_unapproved_restaurant_is_not_publicly_viewable(): void
    {
        $customer = Customer::factory()->create();
        $restaurant = Restaurant::factory()->create(['approval_status' => 'pending']);

        $this->actingAs($customer->user)
            ->get(route('customer.restaurants.show', $restaurant))
            ->assertNotFound();
    }

    public function test_foods_only_lists_currently_available_items_from_open_approved_restaurants(): void
    {
        $customer = Customer::factory()->create();
        CustomerAddress::factory()->default()->create([
            'customer_id' => $customer->id,
            'latitude' => 9.3070,
            'longitude' => 123.3000,
        ]);
        $near = Restaurant::factory()->approved()->create([
            'latitude' => 9.3071,
            'longitude' => 123.3001,
            'operating_status' => 'open',
        ]);
        $far = Restaurant::factory()->approved()->create([
            'latitude' => 9.3170,
            'longitude' => 123.3100,
            'operating_status' => 'open',
        ]);
        $closed = Restaurant::factory()->approved()->create(['operating_status' => 'closed']);
        $nearCategory = MenuCategory::factory()->create(['restaurant_id' => $near->id]);
        $farCategory = MenuCategory::factory()->create(['restaurant_id' => $far->id]);
        $closedCategory = MenuCategory::factory()->create(['restaurant_id' => $closed->id]);
        $nearItem = MenuItem::factory()->available()->create([
            'menu_category_id' => $nearCategory->id,
            'name' => 'Near Lunch',
        ]);
        $farItem = MenuItem::factory()->available()->create([
            'menu_category_id' => $farCategory->id,
            'name' => 'Far Lunch',
        ]);
        MenuItem::factory()->create([
            'menu_category_id' => $nearCategory->id,
            'is_available' => false,
        ]);
        MenuItem::factory()->available()->create([
            'menu_category_id' => $nearCategory->id,
            'available_from' => '18:00:00',
            'available_until' => '22:00:00',
        ]);
        MenuItem::factory()->available()->create(['menu_category_id' => $closedCategory->id]);

        $this->actingAs($customer->user)
            ->get(route('customer.foods.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('customer/foods/index')
                ->has('items.data', 2)
                ->where('items.data.0.id', $nearItem->id)
                ->where('items.data.1.id', $farItem->id)
                ->where('items.data.0.restaurant.is_open', true));
    }

    public function test_search_matches_restaurants_and_dish_descriptions_with_open_filter(): void
    {
        $customer = Customer::factory()->create();
        $openRestaurant = Restaurant::factory()->approved()->create([
            'name' => 'Adobo House',
            'cuisine_type' => 'Filipino',
            'operating_status' => 'open',
        ]);
        $closedRestaurant = Restaurant::factory()->approved()->create([
            'name' => 'Night Kitchen',
            'cuisine_type' => 'Filipino',
            'operating_status' => 'closed',
        ]);
        $openCategory = MenuCategory::factory()->create(['restaurant_id' => $openRestaurant->id]);
        $closedCategory = MenuCategory::factory()->create(['restaurant_id' => $closedRestaurant->id]);
        $openDish = MenuItem::factory()->available()->create([
            'menu_category_id' => $openCategory->id,
            'name' => 'Chicken Bowl',
            'description' => 'A spicy garlic favorite.',
        ]);
        MenuItem::factory()->available()->create([
            'menu_category_id' => $closedCategory->id,
            'name' => 'Pork Bowl',
            'description' => 'A spicy evening meal.',
        ]);

        $this->actingAs($customer->user)
            ->get(route('customer.search.index', ['q' => 'Adobo']))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('customer/search/index')
                ->where('counts.restaurants', 1)
                ->where('results.data.0.id', $openRestaurant->id));

        $this->actingAs($customer->user)
            ->get(route('customer.search.index', [
                'q' => 'spicy',
                'tab' => 'dishes',
                'open_now' => 1,
            ]))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('filters.tab', 'dishes')
                ->where('filters.open_now', true)
                ->where('counts.dishes', 1)
                ->has('results.data', 1)
                ->where('results.data.0.id', $openDish->id));
    }

    private function createOrder(Customer $customer, Restaurant $restaurant): Order
    {
        $address = CustomerAddress::factory()->create(['customer_id' => $customer->id]);

        return Order::query()->create([
            'order_number' => 'FJ-'.fake()->unique()->numerify('########'),
            'customer_id' => $customer->id,
            'restaurant_id' => $restaurant->id,
            'customer_address_id' => $address->id,
            'status' => 'delivered',
            'subtotal' => 200,
            'delivery_fee' => 50,
            'service_fee' => 10,
            'discount_amount' => 0,
            'tip_amount' => 0,
            'total_amount' => 260,
            'commission_amount' => 30,
            'payment_method' => 'cod',
            'placed_at' => now(),
            'delivered_at' => now(),
        ]);
    }
}
