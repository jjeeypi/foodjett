<?php

namespace Tests\Feature\Payments;

use App\Events\OrderPlaced;
use App\Models\Customer;
use App\Models\CustomerAddress;
use App\Models\DeliveryZone;
use App\Models\MenuCategory;
use App\Models\MenuItem;
use App\Models\Order;
use App\Models\PlatformSetting;
use App\Models\Restaurant;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class CheckoutPaymentTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        config()->set('inertia.ssr.enabled', false);
        config()->set('orders.delivery_fee', 50);
        config()->set('orders.service_fee', 10);
        PlatformSetting::query()->updateOrCreate(
            ['key' => 'delivery_base_fee'],
            ['value' => '50', 'description' => 'Test base fee'],
        );
        PlatformSetting::query()->updateOrCreate(
            ['key' => 'delivery_fee_per_km'],
            ['value' => '0', 'description' => 'Test distance fee'],
        );
    }

    public function test_cod_checkout_creates_order_and_pending_payment_immediately(): void
    {
        Http::preventStrayRequests();
        Event::fake([OrderPlaced::class]);
        [$customer, $address, $restaurant, $menuItem] = $this->checkoutFixtures();

        $response = $this->actingAs($customer->user)->post(
            route('customer.checkout.store', $restaurant),
            $this->checkoutPayload($address, $menuItem, 'cod'),
        );

        $order = Order::query()->sole();
        $response->assertRedirect(route('customer.orders.show', $order));
        $this->assertSame('placed', $order->status);
        $this->assertSame('260.00', $order->total_amount);
        $this->assertDatabaseHas('payments', [
            'order_id' => $order->id,
            'method' => 'cod',
            'status' => 'pending',
        ]);
        $this->assertDatabaseHas('payment_status_history', [
            'payment_id' => $order->payment->id,
            'from_status' => null,
            'to_status' => 'pending',
        ]);
        Event::assertDispatched(OrderPlaced::class, fn (OrderPlaced $event): bool => $event->id === $order->id
            && $event->restaurant_id === $restaurant->id
            && $event->customer_name === $customer->user->name
            && $event->total_amount === '260.00');
        Http::assertNothingSent();
    }

    public function test_gcash_checkout_creates_a_paid_order_immediately_without_external_requests(): void
    {
        $this->assertSimulatedOnlineCheckout('gcash');
    }

    public function test_card_checkout_creates_a_paid_order_immediately_without_external_requests(): void
    {
        $this->assertSimulatedOnlineCheckout('card');
    }

    public function test_simulated_checkout_remains_idempotent(): void
    {
        Http::preventStrayRequests();
        Event::fake([OrderPlaced::class]);
        [$customer, $address, $restaurant, $menuItem] = $this->checkoutFixtures();
        $token = (string) Str::uuid();
        $payload = $this->checkoutPayload($address, $menuItem, 'gcash', $token);

        $first = $this->actingAs($customer->user)
            ->post(route('customer.checkout.store', $restaurant), $payload);
        $order = Order::query()->sole();
        $first->assertRedirect(route('customer.checkout.success', $order));

        $this->actingAs($customer->user)
            ->post(route('customer.checkout.store', $restaurant), $payload)
            ->assertRedirect(route('customer.checkout.success', $order));

        $this->assertDatabaseCount('orders', 1);
        $this->assertDatabaseCount('payments', 1);
        $this->assertDatabaseCount('pending_checkouts', 0);
        Event::assertDispatchedTimes(OrderPlaced::class, 1);
        Http::assertNothingSent();
    }

    /** @return array{Customer, CustomerAddress, Restaurant, MenuItem} */
    private function checkoutFixtures(): array
    {
        $customer = Customer::factory()->create();
        $address = CustomerAddress::factory()->create(['customer_id' => $customer->id]);
        DeliveryZone::factory()->create([
            'is_active' => true,
            'polygon' => [
                'type' => 'circle',
                'center' => [(float) $address->latitude, (float) $address->longitude],
                'radius_km' => 100,
            ],
        ]);
        $restaurant = Restaurant::factory()->approved()->create([
            'commission_rate' => 15,
            'min_order_amount' => 0,
        ]);
        $category = MenuCategory::factory()->create(['restaurant_id' => $restaurant->id]);
        $menuItem = MenuItem::factory()->available()->create([
            'menu_category_id' => $category->id,
            'base_price' => 100,
        ]);

        return [$customer, $address, $restaurant, $menuItem];
    }

    /** @return array<string, mixed> */
    private function checkoutPayload(
        CustomerAddress $address,
        MenuItem $menuItem,
        string $method,
        ?string $token = null,
    ): array {
        return [
            'customer_address_id' => $address->id,
            'payment_method' => $method,
            'tip_amount' => 0,
            'idempotency_token' => $token ?? (string) Str::uuid(),
            'items' => [[
                'menu_item_id' => $menuItem->id,
                'quantity' => 2,
                'addon_ids' => [],
                'expected_unit_price' => 100,
            ]],
        ];
    }

    private function assertSimulatedOnlineCheckout(string $method): void
    {
        Http::preventStrayRequests();
        Event::fake([OrderPlaced::class]);
        [$customer, $address, $restaurant, $menuItem] = $this->checkoutFixtures();

        $response = $this->actingAs($customer->user)->post(
            route('customer.checkout.store', $restaurant),
            $this->checkoutPayload($address, $menuItem, $method),
        );

        $order = Order::query()->sole();
        $payment = $order->payment;

        $response
            ->assertRedirect(route('customer.checkout.success', $order))
            ->assertSessionHas('checkoutCompleted', true);
        $this->assertSame('placed', $order->status);
        $this->assertSame($method, $order->payment_method);
        $this->assertSame('paid', $payment?->status);
        $this->assertNotNull($payment?->paid_at);
        $this->assertMatchesRegularExpression(
            '/^SIMULATED-[A-Z0-9]{16}$/',
            (string) $payment?->transaction_reference,
        );
        $this->assertDatabaseHas('payment_status_history', [
            'payment_id' => $payment?->id,
            'from_status' => null,
            'to_status' => 'paid',
        ]);
        $this->assertDatabaseCount('pending_checkouts', 0);
        Event::assertDispatchedTimes(OrderPlaced::class, 1);
        Http::assertNothingSent();

        $this->actingAs($customer->user)
            ->get(route('customer.checkout.success', $order))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('customer/checkout/success')
                ->where('orderNumber', $order->order_number)
                ->where('orderId', $order->id)
                ->where('totalAmount', 260));
    }
}
