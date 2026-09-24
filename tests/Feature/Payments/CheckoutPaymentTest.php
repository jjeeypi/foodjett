<?php

namespace Tests\Feature\Payments;

use App\Events\OrderPlaced;
use App\Models\Customer;
use App\Models\CustomerAddress;
use App\Models\MenuCategory;
use App\Models\MenuItem;
use App\Models\Order;
use App\Models\PendingCheckout;
use App\Models\Restaurant;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\URL;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class CheckoutPaymentTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        config()->set('services.paymongo.secret_key', 'sk_test_example');
        config()->set('services.paymongo.webhook_secret', 'whsec_test_example');
        config()->set('services.paymongo.base_url', 'https://api.paymongo.com');
        config()->set('orders.delivery_fee', 50);
        config()->set('orders.service_fee', 10);
    }

    public function test_cod_checkout_creates_order_and_pending_payment_immediately(): void
    {
        Event::fake([OrderPlaced::class]);
        [$customer, $address, $restaurant, $menuItem] = $this->checkoutFixtures();

        $response = $this->actingAs($customer->user)->post(
            route('customer.checkout.store', $restaurant),
            $this->checkoutPayload($address, $menuItem, 'cod'),
        );

        $order = Order::query()->sole();
        $response->assertRedirect(route('customer.orders.placed', $order));
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
    }

    public function test_online_checkout_creates_no_order_until_paymongo_verifies_a_paid_payment(): void
    {
        Event::fake([OrderPlaced::class]);
        [$customer, $address, $restaurant, $menuItem] = $this->checkoutFixtures();

        Http::fake([
            'https://api.paymongo.com/v2/checkout_sessions' => Http::response([
                'data' => [
                    'id' => 'cs_paid_checkout',
                    'attributes' => ['checkout_url' => 'https://checkout.paymongo.com/cs_paid_checkout'],
                ],
            ]),
        ]);

        $response = $this->actingAs($customer->user)->post(
            route('customer.checkout.store', $restaurant),
            $this->checkoutPayload($address, $menuItem, 'gcash'),
            ['X-Inertia' => 'true'],
        );

        $response
            ->assertStatus(409)
            ->assertHeader('X-Inertia-Location', 'https://checkout.paymongo.com/cs_paid_checkout');
        $this->assertDatabaseCount('orders', 0);
        Event::assertNotDispatched(OrderPlaced::class);
        $pendingCheckout = PendingCheckout::query()->sole();

        Http::fake([
            'https://api.paymongo.com/v1/checkout_sessions/cs_paid_checkout' => Http::response([
                'data' => [
                    'id' => 'cs_paid_checkout',
                    'attributes' => [
                        'reference_number' => $pendingCheckout->paymongo_reference,
                        'payments' => [[
                            'id' => 'pay_verified_123',
                            'attributes' => [
                                'status' => 'paid',
                                'amount' => 26000,
                                'currency' => 'PHP',
                            ],
                        ]],
                    ],
                ],
            ]),
        ]);

        $callbackUrl = URL::temporarySignedRoute(
            'customer.checkout.callback',
            now()->addHour(),
            ['pendingCheckout' => $pendingCheckout, 'outcome' => 'success'],
        );

        $this->actingAs($customer->user)
            ->get($callbackUrl)
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('customer/payment-result')
                ->where('success', true));

        $this->assertDatabaseCount('orders', 1);
        $this->assertDatabaseHas('payments', [
            'method' => 'gcash',
            'status' => 'paid',
            'transaction_reference' => 'pay_verified_123',
        ]);
        $this->assertSame('paid', $pendingCheckout->refresh()->status);
        Event::assertDispatchedTimes(OrderPlaced::class, 1);
    }

    public function test_unpaid_paymongo_callback_does_not_create_an_order(): void
    {
        Event::fake([OrderPlaced::class]);
        [$customer, $address, $restaurant, $menuItem] = $this->checkoutFixtures();

        Http::fake([
            'https://api.paymongo.com/v2/checkout_sessions' => Http::response([
                'data' => [
                    'id' => 'cs_unpaid_checkout',
                    'attributes' => ['checkout_url' => 'https://checkout.paymongo.com/cs_unpaid_checkout'],
                ],
            ]),
        ]);

        $this->actingAs($customer->user)->post(
            route('customer.checkout.store', $restaurant),
            $this->checkoutPayload($address, $menuItem, 'card'),
            ['X-Inertia' => 'true'],
        );

        $pendingCheckout = PendingCheckout::query()->sole();
        Http::fake([
            'https://api.paymongo.com/v1/checkout_sessions/cs_unpaid_checkout' => Http::response([
                'data' => [
                    'id' => 'cs_unpaid_checkout',
                    'attributes' => [
                        'reference_number' => $pendingCheckout->paymongo_reference,
                        'payments' => [],
                        'status' => 'active',
                    ],
                ],
            ]),
        ]);

        $callbackUrl = URL::temporarySignedRoute(
            'customer.checkout.callback',
            now()->addHour(),
            ['pendingCheckout' => $pendingCheckout, 'outcome' => 'cancel'],
        );

        $this->actingAs($customer->user)
            ->get($callbackUrl)
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('customer/payment-result')
                ->where('success', false));

        $this->assertDatabaseCount('orders', 0);
        $this->assertDatabaseCount('payments', 0);
        $this->assertSame('cancelled', $pendingCheckout->refresh()->status);
        Event::assertNotDispatched(OrderPlaced::class);
    }

    public function test_signed_paymongo_webhook_fulfills_checkout_idempotently(): void
    {
        Event::fake([OrderPlaced::class]);
        [$customer, $address, $restaurant, $menuItem] = $this->checkoutFixtures();

        Http::fake([
            'https://api.paymongo.com/v2/checkout_sessions' => Http::response([
                'data' => [
                    'id' => 'cs_webhook_checkout',
                    'attributes' => ['checkout_url' => 'https://checkout.paymongo.com/cs_webhook_checkout'],
                ],
            ]),
        ]);

        $this->actingAs($customer->user)->post(
            route('customer.checkout.store', $restaurant),
            $this->checkoutPayload($address, $menuItem, 'gcash'),
            ['X-Inertia' => 'true'],
        );

        $pendingCheckout = PendingCheckout::query()->sole();
        $payload = json_encode([
            'data' => [
                'type' => 'checkout_session.payment.paid',
                'data' => [
                    'id' => 'cs_webhook_checkout',
                    'attributes' => [
                        'reference_number' => $pendingCheckout->paymongo_reference,
                        'payments' => [[
                            'id' => 'pay_webhook_123',
                            'attributes' => [
                                'status' => 'paid',
                                'amount' => 26000,
                                'currency' => 'PHP',
                            ],
                        ]],
                    ],
                ],
            ],
        ], JSON_THROW_ON_ERROR);
        $timestamp = (string) time();
        $signature = hash_hmac('sha256', $timestamp.'.'.$payload, 'whsec_test_example');
        $headers = [
            'CONTENT_TYPE' => 'application/json',
            'HTTP_PAYMONGO_SIGNATURE' => "t={$timestamp},te={$signature},li=",
        ];

        $this->call('POST', route('webhooks.paymongo'), [], [], [], $headers, $payload)
            ->assertOk();
        $this->call('POST', route('webhooks.paymongo'), [], [], [], $headers, $payload)
            ->assertOk();

        $this->assertDatabaseCount('orders', 1);
        $this->assertDatabaseHas('payments', [
            'status' => 'paid',
            'transaction_reference' => 'pay_webhook_123',
        ]);
        Event::assertDispatchedTimes(OrderPlaced::class, 1);
    }

    /** @return array{Customer, CustomerAddress, Restaurant, MenuItem} */
    private function checkoutFixtures(): array
    {
        $customer = Customer::factory()->create();
        $address = CustomerAddress::factory()->create(['customer_id' => $customer->id]);
        $restaurant = Restaurant::factory()->approved()->create(['commission_rate' => 15]);
        $category = MenuCategory::factory()->create(['restaurant_id' => $restaurant->id]);
        $menuItem = MenuItem::factory()->available()->create([
            'menu_category_id' => $category->id,
            'base_price' => 100,
        ]);

        return [$customer, $address, $restaurant, $menuItem];
    }

    /** @return array<string, mixed> */
    private function checkoutPayload(CustomerAddress $address, MenuItem $menuItem, string $method): array
    {
        return [
            'customer_address_id' => $address->id,
            'payment_method' => $method,
            'items' => [[
                'menu_item_id' => $menuItem->id,
                'quantity' => 2,
                'addon_ids' => [],
            ]],
        ];
    }
}
