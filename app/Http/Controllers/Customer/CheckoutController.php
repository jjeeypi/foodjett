<?php

namespace App\Http\Controllers\Customer;

use App\Actions\Orders\BuildCheckoutData;
use App\Actions\Orders\CreateOrderFromCart;
use App\Data\OrderCheckoutData;
use App\Http\Controllers\Controller;
use App\Http\Requests\Customer\SaveAddressRequest;
use App\Http\Requests\StoreCheckoutRequest;
use App\Models\CustomerAddress;
use App\Models\Order;
use App\Models\PendingCheckout;
use App\Models\Restaurant;
use App\Services\CustomerAddressService;
use App\Services\PayMongo\PayMongoClient;
use Illuminate\Database\QueryException;
use Illuminate\Http\Client\RequestException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\Response as SymfonyResponse;
use Throwable;

class CheckoutController extends Controller
{
    public function show(Restaurant $restaurant): Response
    {
        abort_unless($restaurant->approval_status === 'approved', 404);

        $customer = request()->user()?->customer;
        abort_unless($customer !== null, 403);

        return Inertia::render('customer/checkout/index', [
            'restaurant' => [
                'id' => $restaurant->id,
                'name' => $restaurant->name,
                'cuisine_type' => $restaurant->cuisine_type,
                'address' => $restaurant->address,
                'latitude' => (float) $restaurant->latitude,
                'longitude' => (float) $restaurant->longitude,
                'min_order_amount' => (float) $restaurant->min_order_amount,
            ],
            'addresses' => $customer->addresses()
                ->orderByDesc('is_default')
                ->latest('id')
                ->get()
                ->map(fn (CustomerAddress $address): array => $this->addressData($address))
                ->values(),
            'idempotencyToken' => (string) Str::uuid(),
        ]);
    }

    public function quote(
        StoreCheckoutRequest $request,
        Restaurant $restaurant,
        BuildCheckoutData $buildCheckout,
    ): JsonResponse {
        $checkout = $this->checkoutData($request, $restaurant, $buildCheckout);

        return response()->json([
            'quote' => [
                'subtotal' => $checkout->subtotal,
                'delivery_fee' => $checkout->deliveryFee,
                'delivery_distance_km' => $checkout->deliveryDistanceKm,
                'service_fee' => $checkout->serviceFee,
                'discount_amount' => $checkout->discountAmount,
                'tip_amount' => $checkout->tipAmount,
                'total_amount' => $checkout->totalAmount,
                'voucher' => $checkout->voucherId === null ? null : [
                    'id' => $checkout->voucherId,
                    'code' => $checkout->voucherCode,
                ],
            ],
        ]);
    }

    public function store(
        StoreCheckoutRequest $request,
        Restaurant $restaurant,
        BuildCheckoutData $buildCheckout,
        CreateOrderFromCart $createOrder,
        PayMongoClient $payMongo,
    ): RedirectResponse|SymfonyResponse {
        $token = $request->idempotencyToken();
        $existingOrder = Order::query()->where('checkout_token', $token)->first();

        if ($existingOrder !== null) {
            abort_unless(
                $existingOrder->customer_id === $request->user()->customer?->id
                    && $existingOrder->restaurant_id === $restaurant->id,
                409,
            );

            return to_route('customer.orders.show', $existingOrder)
                ->with('checkoutCompleted', true);
        }

        $existing = PendingCheckout::query()
            ->where('idempotency_token', $token)
            ->first();
        if ($existing !== null) {
            return $this->existingPendingResponse($existing, $request, $restaurant);
        }

        $checkout = $this->checkoutData($request, $restaurant, $buildCheckout);

        if ($checkout->paymentMethod === 'cod') {
            $order = $createOrder->handle($checkout, 'pending', checkoutToken: $token);

            return to_route('customer.orders.show', $order)
                ->with('checkoutCompleted', true);
        }

        try {
            $pendingCheckout = PendingCheckout::query()->create([
                'idempotency_token' => $token,
                'customer_id' => $checkout->customerId,
                'restaurant_id' => $checkout->restaurantId,
                'customer_address_id' => $checkout->customerAddressId,
                'payment_method' => $checkout->paymentMethod,
                'payload' => $checkout->toArray(),
                'total_amount' => $checkout->totalAmount,
                'paymongo_reference' => 'FJ-'.Str::upper((string) Str::ulid()),
                'expires_at' => now()->addHour(),
            ]);
        } catch (QueryException $exception) {
            $pendingCheckout = PendingCheckout::query()
                ->where('idempotency_token', $token)
                ->first();

            if ($pendingCheckout === null) {
                throw $exception;
            }

            return $this->existingPendingResponse($pendingCheckout, $request, $restaurant);
        }

        $successUrl = URL::temporarySignedRoute(
            'customer.checkout.callback',
            now()->addHour(),
            ['pendingCheckout' => $pendingCheckout, 'outcome' => 'success'],
        );
        $cancelUrl = URL::temporarySignedRoute(
            'customer.checkout.callback',
            now()->addHour(),
            ['pendingCheckout' => $pendingCheckout, 'outcome' => 'cancel'],
        );

        try {
            $session = $payMongo->createCheckoutSession(
                $pendingCheckout,
                $request->user(),
                $successUrl,
                $cancelUrl,
            );
        } catch (Throwable $exception) {
            report($exception);
            $pendingCheckout->update(['status' => 'failed']);

            $message = $exception instanceof RequestException
                ? 'PayMongo rejected the checkout request. Please try another payment method.'
                : 'The payment gateway is unavailable. Please try again shortly.';

            throw ValidationException::withMessages(['payment_method' => $message]);
        }

        $pendingCheckout->update([
            'paymongo_session_id' => $session['id'],
            'paymongo_checkout_url' => $session['checkout_url'],
        ]);

        return Inertia::location($session['checkout_url']);
    }

    public function storeAddress(
        SaveAddressRequest $request,
        CustomerAddressService $addresses,
    ): JsonResponse {
        $customer = $request->user()?->customer;
        abort_unless($customer !== null, 403);
        Gate::authorize('create', CustomerAddress::class);

        $address = $addresses->create($customer, $request->validated());

        return response()->json([
            'address' => $addresses->data($address),
            'outside_delivery_zone' => $addresses->isOutsideDeliveryZones($address),
        ], 201);
    }

    private function checkoutData(
        StoreCheckoutRequest $request,
        Restaurant $restaurant,
        BuildCheckoutData $buildCheckout,
    ): OrderCheckoutData {
        $customer = $request->user()->customer;
        abort_unless($customer !== null, 403);
        $address = CustomerAddress::query()->findOrFail($request->addressId());

        return $buildCheckout->handle(
            $customer,
            $restaurant,
            $address,
            $request->paymentMethod(),
            $request->customerNotes(),
            $request->items(),
            $request->voucherCode(),
            $request->tipAmount(),
        );
    }

    private function existingPendingResponse(
        PendingCheckout $checkout,
        StoreCheckoutRequest $request,
        Restaurant $restaurant,
    ): RedirectResponse|SymfonyResponse {
        abort_unless(
            $checkout->customer_id === $request->user()->customer?->id
                && $checkout->restaurant_id === $restaurant->id,
            409,
        );

        if ($checkout->order_id !== null) {
            return to_route('customer.orders.show', $checkout->order_id)
                ->with('checkoutCompleted', true);
        }

        if ($checkout->status === 'pending' && $checkout->paymongo_checkout_url !== null) {
            return Inertia::location($checkout->paymongo_checkout_url);
        }

        throw ValidationException::withMessages([
            'idempotency_token' => 'This checkout attempt has already ended. Reload checkout to try again.',
        ]);
    }

    /** @return array<string, mixed> */
    private function addressData(CustomerAddress $address): array
    {
        return [
            'id' => $address->id,
            'label' => $address->label,
            'address_line' => $address->address_line,
            'landmark' => $address->landmark,
            'delivery_instructions' => $address->delivery_instructions,
            'latitude' => (float) $address->latitude,
            'longitude' => (float) $address->longitude,
            'is_default' => $address->is_default,
        ];
    }
}
