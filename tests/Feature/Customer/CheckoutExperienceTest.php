<?php

namespace Tests\Feature\Customer;

use App\Events\OrderPlaced;
use App\Models\Customer;
use App\Models\CustomerAddress;
use App\Models\DeliveryZone;
use App\Models\MenuCategory;
use App\Models\MenuItem;
use App\Models\Order;
use App\Models\PlatformSetting;
use App\Models\Restaurant;
use App\Models\Voucher;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class CheckoutExperienceTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        config()->set('orders.service_fee', 10);
        PlatformSetting::query()->updateOrCreate(
            ['key' => 'delivery_base_fee'],
            ['value' => '35', 'description' => 'Test base fee'],
        );
        PlatformSetting::query()->updateOrCreate(
            ['key' => 'delivery_fee_per_km'],
            ['value' => '10', 'description' => 'Test distance fee'],
        );
    }

    public function test_checkout_page_lists_addresses_and_issues_an_idempotency_token(): void
    {
        [$customer, $address, $restaurant] = $this->fixtures();

        $this->actingAs($customer->user)
            ->get(route('customer.checkout.show', $restaurant))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('customer/checkout/index')
                ->where('restaurant.id', $restaurant->id)
                ->where('addresses.0.id', $address->id)
                ->where('addresses.0.is_default', true)
                ->where('idempotencyToken', fn (string $token): bool => Str::isUuid($token)));
    }

    public function test_quote_uses_settings_tip_and_percentage_voucher(): void
    {
        [$customer, $address, $restaurant, $menuItem] = $this->fixtures();
        $voucher = Voucher::factory()->create([
            'code' => 'SAVE10',
            'scope' => 'platform',
            'restaurant_id' => null,
            'type' => 'percentage',
            'value' => 10,
            'min_order_amount' => 100,
            'usage_limit_total' => 10,
            'usage_limit_per_customer' => 1,
            'starts_at' => now()->subDay(),
            'ends_at' => now()->addDay(),
            'is_active' => true,
        ]);

        $this->actingAs($customer->user)
            ->postJson(
                route('customer.checkout.quote', $restaurant),
                $this->payload($address, $menuItem, voucher: 'save10', tip: 20),
            )
            ->assertOk()
            ->assertJsonPath('quote.subtotal', 200)
            ->assertJsonPath('quote.delivery_fee', 35)
            ->assertJsonPath('quote.service_fee', 10)
            ->assertJsonPath('quote.discount_amount', 20)
            ->assertJsonPath('quote.tip_amount', 20)
            ->assertJsonPath('quote.total_amount', 245)
            ->assertJsonPath('quote.voucher.id', $voucher->id);
    }

    public function test_cod_checkout_is_idempotent_and_records_voucher_once(): void
    {
        Event::fake([OrderPlaced::class]);
        [$customer, $address, $restaurant, $menuItem] = $this->fixtures();
        $voucher = Voucher::factory()->create([
            'code' => 'FIXED50',
            'scope' => 'restaurant',
            'restaurant_id' => $restaurant->id,
            'type' => 'fixed',
            'value' => 50,
            'min_order_amount' => 0,
            'usage_limit_total' => 1,
            'usage_limit_per_customer' => 1,
            'starts_at' => now()->subDay(),
            'ends_at' => now()->addDay(),
            'is_active' => true,
        ]);
        $token = (string) Str::uuid();
        $payload = $this->payload($address, $menuItem, 'FIXED50', 0, $token);

        $first = $this->actingAs($customer->user)
            ->post(route('customer.checkout.store', $restaurant), $payload);
        $order = Order::query()->sole();
        $first->assertRedirect(route('customer.orders.show', $order));

        $this->actingAs($customer->user)
            ->post(route('customer.checkout.store', $restaurant), $payload)
            ->assertRedirect(route('customer.orders.show', $order));

        $this->assertDatabaseCount('orders', 1);
        $this->assertDatabaseCount('voucher_redemptions', 1);
        $this->assertDatabaseHas('voucher_redemptions', [
            'voucher_id' => $voucher->id,
            'order_id' => $order->id,
            'customer_id' => $customer->id,
            'discount_applied' => '50.00',
        ]);
        Event::assertDispatchedTimes(OrderPlaced::class, 1);
    }

    public function test_quote_rejects_an_address_outside_active_delivery_zones(): void
    {
        [$customer, $address, $restaurant, $menuItem] = $this->fixtures();
        $address->update(['latitude' => 10.5, 'longitude' => 124.5]);

        $this->actingAs($customer->user)
            ->postJson(
                route('customer.checkout.quote', $restaurant),
                $this->payload($address, $menuItem),
            )
            ->assertUnprocessable()
            ->assertJsonValidationErrors('customer_address_id');
    }

    public function test_quote_rejects_a_cart_price_that_changed(): void
    {
        [$customer, $address, $restaurant, $menuItem] = $this->fixtures();
        $payload = $this->payload($address, $menuItem);
        $payload['items'][0]['expected_unit_price'] = 90;

        $this->actingAs($customer->user)
            ->postJson(route('customer.checkout.quote', $restaurant), $payload)
            ->assertUnprocessable()
            ->assertJsonValidationErrors('items.0.expected_unit_price');
    }

    public function test_customer_can_add_an_address_inline(): void
    {
        $customer = Customer::factory()->create();

        $this->actingAs($customer->user)
            ->postJson(route('customer.checkout.addresses.store'), [
                'label' => 'School',
                'address_line' => 'Hibbard Avenue, Dumaguete City',
                'landmark' => 'Main gate',
                'delivery_instructions' => 'Call on arrival',
                'latitude' => 9.3068,
                'longitude' => 123.3054,
            ])
            ->assertCreated()
            ->assertJsonPath('address.is_default', true);

        $this->assertDatabaseHas('customer_addresses', [
            'customer_id' => $customer->id,
            'label' => 'School',
            'is_default' => true,
        ]);
    }

    /** @return array{Customer, CustomerAddress, Restaurant, MenuItem} */
    private function fixtures(): array
    {
        $latitude = 9.3068;
        $longitude = 123.3054;
        $customer = Customer::factory()->create();
        $address = CustomerAddress::factory()->default()->create([
            'customer_id' => $customer->id,
            'latitude' => $latitude,
            'longitude' => $longitude,
        ]);
        DeliveryZone::factory()->create([
            'is_active' => true,
            'polygon' => [
                'type' => 'circle',
                'center' => [$latitude, $longitude],
                'radius_km' => 5,
            ],
        ]);
        $restaurant = Restaurant::factory()->approved()->create([
            'latitude' => $latitude,
            'longitude' => $longitude,
            'min_order_amount' => 100,
        ]);
        $category = MenuCategory::factory()->create(['restaurant_id' => $restaurant->id]);
        $menuItem = MenuItem::factory()->available()->create([
            'menu_category_id' => $category->id,
            'base_price' => 100,
        ]);

        return [$customer, $address, $restaurant, $menuItem];
    }

    /** @return array<string, mixed> */
    private function payload(
        CustomerAddress $address,
        MenuItem $menuItem,
        ?string $voucher = null,
        float $tip = 0,
        ?string $token = null,
    ): array {
        return [
            'customer_address_id' => $address->id,
            'payment_method' => 'cod',
            'customer_notes' => 'Please call on arrival.',
            'voucher_code' => $voucher,
            'tip_amount' => $tip,
            'idempotency_token' => $token ?? (string) Str::uuid(),
            'items' => [[
                'menu_item_id' => $menuItem->id,
                'menu_item_variant_id' => null,
                'quantity' => 2,
                'addon_ids' => [],
                'special_instructions' => 'No onions',
                'expected_unit_price' => 100,
            ]],
        ];
    }
}
