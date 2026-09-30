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
use App\Models\Restaurant;
use App\Services\CustomerAddressService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

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
    ): RedirectResponse {
        $token = $request->idempotencyToken();
        $existingOrder = Order::query()->where('checkout_token', $token)->first();

        if ($existingOrder !== null) {
            abort_unless(
                $existingOrder->customer_id === $request->user()->customer?->id
                    && $existingOrder->restaurant_id === $restaurant->id,
                409,
            );

            return $this->completedResponse($existingOrder);
        }

        $checkout = $this->checkoutData($request, $restaurant, $buildCheckout);
        $isCashOnDelivery = $checkout->paymentMethod === 'cod';
        $order = $createOrder->handle(
            $checkout,
            $isCashOnDelivery ? 'pending' : 'paid',
            $isCashOnDelivery ? null : 'SIMULATED-'.Str::upper(Str::random(16)),
            $token,
        );

        return $this->completedResponse($order);
    }

    public function success(Order $order): Response
    {
        Gate::authorize('view', $order);
        abort_unless(in_array($order->payment_method, ['gcash', 'card'], true), 404);

        return Inertia::render('customer/checkout/success', [
            'orderNumber' => $order->order_number,
            'orderId' => $order->id,
            'totalAmount' => (float) $order->total_amount,
        ]);
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

    private function completedResponse(Order $order): RedirectResponse
    {
        $route = $order->payment_method === 'cod'
            ? 'customer.orders.show'
            : 'customer.checkout.success';

        return to_route($route, $order)->with('checkoutCompleted', true);
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
