<?php

namespace Tests\Feature\Restaurant;

use App\Models\Customer;
use App\Models\CustomerAddress;
use App\Models\MenuCategory;
use App\Models\MenuItem;
use App\Models\MenuItemAddon;
use App\Models\MenuItemVariant;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\OrderItemAddon;
use App\Models\Restaurant;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class RestaurantMenuManagementTest extends TestCase
{
    use RefreshDatabase;

    public function test_item_list_is_paginated_filtered_and_scoped_to_authenticated_restaurant(): void
    {
        $restaurant = Restaurant::factory()->approved()->create();
        $category = MenuCategory::factory()->create([
            'restaurant_id' => $restaurant->id,
            'name' => 'Rice Meals',
        ]);
        $matching = MenuItem::factory()->create([
            'menu_category_id' => $category->id,
            'name' => 'Chicken Adobo',
            'is_available' => true,
        ]);
        MenuItem::factory()->create([
            'menu_category_id' => $category->id,
            'name' => 'Sold Out Soup',
            'is_available' => false,
        ]);
        MenuItem::factory()->create();

        $this->actingAs($restaurant->user)
            ->get(route('restaurant.menu.items.index', [
                'search' => 'Adobo',
                'category_id' => $category->id,
                'availability' => 'available',
            ]))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('restaurant/menu/items')
                ->where('filters.search', 'Adobo')
                ->where('filters.category_id', (string) $category->id)
                ->has('items.data', 1)
                ->where('items.data.0.id', $matching->id)
                ->has('items.links'));
    }

    public function test_restaurant_can_create_item_with_photo_variants_and_addons(): void
    {
        Storage::fake('public');
        $restaurant = Restaurant::factory()->approved()->create();
        $category = MenuCategory::factory()->create(['restaurant_id' => $restaurant->id]);

        $this->actingAs($restaurant->user)
            ->post(route('restaurant.menu.items.store'), [
                'menu_category_id' => $category->id,
                'name' => 'House Burger',
                'description' => 'A testing burger.',
                'photo' => UploadedFile::fake()->createWithContent(
                    'burger.png',
                    base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', true)
                ),
                'base_price' => 180,
                'is_available' => true,
                'is_featured' => true,
                'available_from' => '10:00',
                'available_until' => '22:00',
                'variants' => [
                    ['id' => null, 'key' => 'new-1', 'name' => 'Regular', 'price_delta' => 0],
                    ['id' => null, 'key' => 'new-2', 'name' => 'Large', 'price_delta' => 50],
                ],
                'addons' => [
                    ['id' => null, 'key' => 'new-3', 'name' => 'Extra cheese', 'price' => 25, 'is_available' => true],
                ],
            ])
            ->assertRedirect(route('restaurant.menu.items.index'));

        $item = MenuItem::query()->where('name', 'House Burger')->firstOrFail();
        $this->assertSame($category->id, $item->menu_category_id);
        $this->assertTrue($item->is_featured);
        $this->assertNotNull($item->photo_path);
        Storage::disk('public')->assertExists($item->photo_path);
        $this->assertDatabaseCount('menu_item_variants', 2);
        $this->assertDatabaseHas('menu_item_addons', [
            'menu_item_id' => $item->id,
            'name' => 'Extra cheese',
            'price' => 25,
        ]);
    }

    public function test_restaurant_can_update_item_and_sync_owned_options(): void
    {
        $restaurant = Restaurant::factory()->approved()->create();
        $category = MenuCategory::factory()->create(['restaurant_id' => $restaurant->id]);
        $item = MenuItem::factory()->create(['menu_category_id' => $category->id]);
        $variant = MenuItemVariant::factory()->create(['menu_item_id' => $item->id]);
        $addon = MenuItemAddon::factory()->create(['menu_item_id' => $item->id]);

        $this->actingAs($restaurant->user)
            ->patch(route('restaurant.menu.items.update', $item), [
                'menu_category_id' => $category->id,
                'name' => 'Updated Meal',
                'description' => null,
                'base_price' => 225.50,
                'is_available' => true,
                'is_featured' => false,
                'available_from' => null,
                'available_until' => null,
                'variants' => [
                    ['id' => $variant->id, 'name' => 'Updated Size', 'price_delta' => 15],
                    ['name' => 'Family', 'price_delta' => 100],
                ],
                'addons' => [
                    ['id' => $addon->id, 'name' => 'Updated Add-on', 'price' => 30, 'is_available' => false],
                ],
            ])
            ->assertRedirect(route('restaurant.menu.items.index'));

        $this->assertDatabaseHas('menu_items', [
            'id' => $item->id,
            'name' => 'Updated Meal',
            'base_price' => 225.50,
        ]);
        $this->assertDatabaseHas('menu_item_variants', [
            'id' => $variant->id,
            'name' => 'Updated Size',
        ]);
        $this->assertSame(2, $item->variants()->count());
        $this->assertDatabaseHas('menu_item_addons', [
            'id' => $addon->id,
            'name' => 'Updated Add-on',
            'is_available' => false,
        ]);
    }

    public function test_restaurant_cannot_manage_another_restaurants_menu_resources(): void
    {
        $restaurant = Restaurant::factory()->approved()->create();
        $otherItem = MenuItem::factory()->create();
        $otherCategory = $otherItem->category;

        $this->actingAs($restaurant->user)
            ->get(route('restaurant.menu.items.edit', $otherItem))
            ->assertForbidden();
        $this->actingAs($restaurant->user)
            ->patch(route('restaurant.menu.items.availability', $otherItem), [
                'is_available' => false,
            ])
            ->assertForbidden();
        $this->actingAs($restaurant->user)
            ->patch(route('restaurant.menu.categories.update', $otherCategory), [
                'name' => 'Unauthorized rename',
            ])
            ->assertForbidden();
        $this->actingAs($restaurant->user)
            ->post(route('restaurant.menu.items.store'), [
                'menu_category_id' => $otherCategory->id,
                'name' => 'Unauthorized item',
                'base_price' => 100,
                'is_available' => true,
                'is_featured' => false,
            ])
            ->assertSessionHasErrors('menu_category_id');
    }

    public function test_variants_and_addons_used_in_order_history_cannot_be_removed(): void
    {
        $restaurant = Restaurant::factory()->approved()->create();
        $category = MenuCategory::factory()->create(['restaurant_id' => $restaurant->id]);
        $item = MenuItem::factory()->create(['menu_category_id' => $category->id]);
        $variant = MenuItemVariant::factory()->create(['menu_item_id' => $item->id]);
        $addon = MenuItemAddon::factory()->create(['menu_item_id' => $item->id]);
        $order = $this->createOrder($restaurant);
        $orderItem = OrderItem::query()->create([
            'order_id' => $order->id,
            'menu_item_id' => $item->id,
            'menu_item_variant_id' => $variant->id,
            'quantity' => 1,
            'unit_price' => 250,
        ]);
        OrderItemAddon::query()->create([
            'order_item_id' => $orderItem->id,
            'menu_item_addon_id' => $addon->id,
            'price' => 25,
        ]);

        $basePayload = [
            'menu_category_id' => $category->id,
            'name' => $item->name,
            'base_price' => $item->base_price,
            'is_available' => true,
            'is_featured' => false,
            'available_from' => null,
            'available_until' => null,
        ];

        $this->actingAs($restaurant->user)
            ->patch(route('restaurant.menu.items.update', $item), [
                ...$basePayload,
                'variants' => [],
                'addons' => [[
                    'id' => $addon->id,
                    'name' => $addon->name,
                    'price' => $addon->price,
                    'is_available' => true,
                ]],
            ])
            ->assertSessionHasErrors('variants');

        $this->actingAs($restaurant->user)
            ->patch(route('restaurant.menu.items.update', $item), [
                ...$basePayload,
                'variants' => [[
                    'id' => $variant->id,
                    'name' => $variant->name,
                    'price_delta' => $variant->price_delta,
                ]],
                'addons' => [],
            ])
            ->assertSessionHasErrors('addons');

        $this->assertDatabaseHas('menu_item_variants', ['id' => $variant->id]);
        $this->assertDatabaseHas('menu_item_addons', ['id' => $addon->id]);
    }

    public function test_item_with_order_history_is_marked_unavailable_instead_of_deleted(): void
    {
        $restaurant = Restaurant::factory()->approved()->create();
        $category = MenuCategory::factory()->create(['restaurant_id' => $restaurant->id]);
        $item = MenuItem::factory()->available()->create(['menu_category_id' => $category->id]);
        $order = $this->createOrder($restaurant);
        OrderItem::query()->create([
            'order_id' => $order->id,
            'menu_item_id' => $item->id,
            'quantity' => 1,
            'unit_price' => $item->base_price,
        ]);

        $this->actingAs($restaurant->user)
            ->delete(route('restaurant.menu.items.destroy', $item))
            ->assertRedirect();

        $this->assertDatabaseHas('menu_items', [
            'id' => $item->id,
            'is_available' => false,
        ]);
    }

    public function test_unreferenced_item_and_its_photo_can_be_deleted(): void
    {
        Storage::fake('public');
        $restaurant = Restaurant::factory()->approved()->create();
        $category = MenuCategory::factory()->create(['restaurant_id' => $restaurant->id]);
        Storage::disk('public')->put('menu-items/test/item.jpg', 'image');
        $item = MenuItem::factory()->create([
            'menu_category_id' => $category->id,
            'photo_path' => 'menu-items/test/item.jpg',
        ]);

        $this->actingAs($restaurant->user)
            ->delete(route('restaurant.menu.items.destroy', $item))
            ->assertRedirect();

        $this->assertDatabaseMissing('menu_items', ['id' => $item->id]);
        Storage::disk('public')->assertMissing('menu-items/test/item.jpg');
    }

    public function test_categories_can_be_created_renamed_reordered_and_only_deleted_when_empty(): void
    {
        $restaurant = Restaurant::factory()->approved()->create();
        $first = MenuCategory::factory()->create([
            'restaurant_id' => $restaurant->id,
            'name' => 'First',
            'sort_order' => 0,
        ]);
        $second = MenuCategory::factory()->create([
            'restaurant_id' => $restaurant->id,
            'name' => 'Second',
            'sort_order' => 1,
        ]);

        $this->actingAs($restaurant->user)
            ->post(route('restaurant.menu.categories.store'), ['name' => 'Third'])
            ->assertRedirect();
        $third = MenuCategory::query()->where('restaurant_id', $restaurant->id)
            ->where('name', 'Third')
            ->firstOrFail();

        $this->actingAs($restaurant->user)
            ->patch(route('restaurant.menu.categories.update', $third), ['name' => 'Desserts'])
            ->assertRedirect();
        $this->actingAs($restaurant->user)
            ->patch(route('restaurant.menu.categories.move', $second), ['direction' => 'up'])
            ->assertRedirect();

        $this->assertLessThan($first->fresh()->sort_order, $second->fresh()->sort_order);

        MenuItem::factory()->create(['menu_category_id' => $first->id]);
        $this->actingAs($restaurant->user)
            ->delete(route('restaurant.menu.categories.destroy', $first))
            ->assertSessionHasErrors('category');
        $this->assertDatabaseHas('menu_categories', ['id' => $first->id]);

        $this->actingAs($restaurant->user)
            ->delete(route('restaurant.menu.categories.destroy', $third))
            ->assertRedirect();
        $this->assertDatabaseMissing('menu_categories', ['id' => $third->id]);
    }

    private function createOrder(Restaurant $restaurant): Order
    {
        $customer = Customer::factory()->create();
        $address = CustomerAddress::factory()->create(['customer_id' => $customer->id]);

        return Order::query()->create([
            'order_number' => 'FJ-MENU-'.fake()->unique()->numerify('######'),
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
        ]);
    }
}
