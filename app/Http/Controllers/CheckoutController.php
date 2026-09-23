<?php

namespace App\Http\Controllers;

use App\Actions\Orders\BuildCheckoutData;
use App\Actions\Orders\CreateOrderFromCart;
use App\Http\Requests\StoreCheckoutRequest;
use App\Models\CustomerAddress;
use App\Models\PendingCheckout;
use App\Models\Restaurant;
use App\Services\PayMongo\PayMongoClient;
use Illuminate\Http\Client\RequestException;
use Illuminate\Http\RedirectResponse;
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
        abort_unless(
            $restaurant->approval_status === 'approved' && $restaurant->operating_status === 'open',
            404,
        );

        $customer = request()->user()?->customer;
        abort_unless($customer !== null, 403);

        $restaurant->load([
            'menuCategories' => fn ($query) => $query->orderBy('sort_order'),
            'menuCategories.menuItems' => fn ($query) => $query->where('is_available', true)->orderBy('name'),
            'menuCategories.menuItems.variants',
            'menuCategories.menuItems.addons' => fn ($query) => $query->where('is_available', true),
        ]);

        return Inertia::render('customer/checkout', [
            'restaurant' => $restaurant->only(['id', 'name', 'cuisine_type', 'address', 'min_order_amount']) + [
                'menuCategories' => $restaurant->menuCategories,
            ],
            'addresses' => $customer->addresses()->orderByDesc('is_default')->get(),
            'fees' => [
                'delivery' => (float) config('orders.delivery_fee'),
                'service' => (float) config('orders.service_fee'),
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
        $user = $request->user();
        $customer = $user->customer;
        abort_unless($customer !== null, 403);

        $address = CustomerAddress::query()->findOrFail($request->addressId());
        $checkout = $buildCheckout->handle(
            $customer,
            $restaurant,
            $address,
            $request->paymentMethod(),
            $request->customerNotes(),
            $request->items(),
        );

        if ($checkout->paymentMethod === 'cod') {
            $order = $createOrder->handle($checkout, 'pending');

            return to_route('customer.orders.placed', $order);
        }

        $pendingCheckout = PendingCheckout::create([
            'customer_id' => $checkout->customerId,
            'restaurant_id' => $checkout->restaurantId,
            'customer_address_id' => $checkout->customerAddressId,
            'payment_method' => $checkout->paymentMethod,
            'payload' => $checkout->toArray(),
            'total_amount' => $checkout->totalAmount,
            'paymongo_reference' => 'FJ-'.Str::upper((string) Str::ulid()),
            'expires_at' => now()->addHour(),
        ]);

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
            $session = $payMongo->createCheckoutSession($pendingCheckout, $user, $successUrl, $cancelUrl);
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
}
