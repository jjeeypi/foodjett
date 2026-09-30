<?php

namespace App\Http\Controllers\Rider;

use App\Actions\Orders\TransitionOrderStatus;
use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\Rider;
use App\Models\RiderPoolOffer;
use App\Services\RiderPayCalculator;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class OrderPoolController extends Controller
{
    public function index(RiderPayCalculator $payCalculator): Response
    {
        $rider = request()->user()?->rider;
        abort_unless($rider !== null, 403);

        $activeOrders = Order::query()
            ->with(['restaurant:id,name,address', 'deliveryAddress:id,address_line', 'payment'])
            ->where('rider_id', $rider->id)
            ->whereIn('status', Order::RIDER_ACTIVE_STATUSES)
            ->oldest('rider_assigned_at')
            ->get();
        $hasActiveOrder = $activeOrders->isNotEmpty();
        $poolOrders = $this->poolOrders($rider, $payCalculator, $hasActiveOrder);

        return Inertia::render('rider/order-pool/index', [
            'rider' => [
                'cash_on_hand' => (float) $rider->cash_on_hand,
                'cash_remit_limit' => (float) $rider->cash_remit_limit,
                'current_latitude' => $rider->current_latitude,
                'current_longitude' => $rider->current_longitude,
                'last_location_at' => $rider->last_location_at === null
                    ? null
                    : Carbon::parse($rider->last_location_at)->toIso8601String(),
            ],
            'poolOrders' => $poolOrders,
            'activeOrders' => $activeOrders,
            'hasActiveOrder' => $hasActiveOrder,
            'blockedCodOrders' => collect($poolOrders)
                ->whereNotNull('accept_block_reason')
                ->where('payment_method', 'cod')
                ->count(),
        ]);
    }

    public function accept(
        Order $order,
        TransitionOrderStatus $transition,
        RiderPayCalculator $payCalculator,
    ): RedirectResponse {
        $rider = request()->user()?->rider;
        abort_unless($rider !== null, 403);

        DB::transaction(function () use ($order, $rider, $transition, $payCalculator): void {
            // Locking the rider serializes attempts to accept different orders, enforcing one active order.
            $lockedRider = Rider::query()->lockForUpdate()->findOrFail($rider->id);
            $lockedOrder = Order::query()->lockForUpdate()->findOrFail($order->id);

            if ($lockedOrder->rider_id !== null || $lockedOrder->status !== 'finding_rider') {
                throw ValidationException::withMessages([
                    'order' => 'This order was just taken by another rider.',
                ]);
            }

            $offer = RiderPoolOffer::query()
                ->where('order_id', $lockedOrder->id)
                ->lockForUpdate()
                ->firstOrFail();

            if ($lockedRider->current_latitude === null || $lockedRider->current_longitude === null) {
                throw ValidationException::withMessages([
                    'order' => 'Update your current location before accepting an order.',
                ]);
            }

            $lockedOrder->loadMissing('restaurant:id,latitude,longitude');
            $pickupDistance = $payCalculator->distanceInKilometres(
                (float) $lockedRider->current_latitude,
                (float) $lockedRider->current_longitude,
                (float) $lockedOrder->restaurant->latitude,
                (float) $lockedOrder->restaurant->longitude,
            );

            if ($pickupDistance > (float) $offer->search_radius_km) {
                throw ValidationException::withMessages([
                    'order' => 'This pickup is outside the current rider search radius.',
                ]);
            }

            $hasActiveOrder = Order::query()
                ->where('rider_id', $lockedRider->id)
                ->whereIn('status', Order::RIDER_ACTIVE_STATUSES)
                ->lockForUpdate()
                ->exists();

            if ($hasActiveOrder) {
                throw ValidationException::withMessages([
                    'order' => 'Finish your active delivery before accepting another order.',
                ]);
            }

            if ($lockedOrder->payment_method === 'cod' && ! $lockedRider->canAcceptCodOrders()) {
                throw ValidationException::withMessages([
                    'order' => 'You have reached your cash remit limit. Remit cash before accepting another COD order.',
                ]);
            }

            Gate::authorize('updateAsRider', $lockedOrder);

            $transition->handle(
                $lockedOrder,
                'rider_assigned',
                'rider',
                'Rider accepted the delivery.',
                [
                    'rider_id' => $lockedRider->id,
                    'rider_assigned_at' => now(),
                ],
            );
        });

        return to_route('rider.active')->with('success', 'Order accepted.');
    }

    /** @return list<array<string, mixed>> */
    private function poolOrders(
        Rider $rider,
        RiderPayCalculator $payCalculator,
        bool $hasActiveOrder,
    ): array {
        if ($rider->current_latitude === null || $rider->current_longitude === null) {
            return [];
        }

        $query = Order::query()
            ->with([
                'restaurant:id,name,address,latitude,longitude',
                'deliveryAddress:id,address_line,latitude,longitude',
                'poolOffer:id,order_id,search_radius_km,incentive_amount',
            ])
            ->join('restaurants', 'restaurants.id', '=', 'orders.restaurant_id')
            ->join('customer_addresses', 'customer_addresses.id', '=', 'orders.customer_address_id')
            ->join('rider_pool_offers', 'rider_pool_offers.order_id', '=', 'orders.id')
            ->whereNull('orders.rider_id')
            ->where('orders.status', 'finding_rider')
            ->select('orders.*');

        if (in_array(DB::connection()->getDriverName(), ['mysql', 'mariadb'], true)) {
            $pickupDistanceSql = <<<'SQL'
                6371 * 2 * ASIN(LEAST(1, SQRT(
                    POWER(SIN(RADIANS(restaurants.latitude - ?) / 2), 2) +
                    COS(RADIANS(?)) * COS(RADIANS(restaurants.latitude)) *
                    POWER(SIN(RADIANS(restaurants.longitude - ?) / 2), 2)
                )))
                SQL;
            $deliveryDistanceSql = <<<'SQL'
                6371 * 2 * ASIN(LEAST(1, SQRT(
                    POWER(SIN(RADIANS(customer_addresses.latitude - restaurants.latitude) / 2), 2) +
                    COS(RADIANS(restaurants.latitude)) * COS(RADIANS(customer_addresses.latitude)) *
                    POWER(SIN(RADIANS(customer_addresses.longitude - restaurants.longitude) / 2), 2)
                )))
                SQL;

            $orders = $query
                ->selectRaw("{$pickupDistanceSql} AS pickup_distance_km", [
                    (float) $rider->current_latitude,
                    (float) $rider->current_latitude,
                    (float) $rider->current_longitude,
                ])
                ->selectRaw("{$deliveryDistanceSql} AS delivery_distance_km")
                ->selectRaw('rider_pool_offers.search_radius_km AS offer_search_radius_km')
                ->havingRaw('pickup_distance_km <= offer_search_radius_km')
                ->orderBy('pickup_distance_km')
                ->get();
        } else {
            $orders = $query->get()
                ->filter(function (Order $order) use ($rider, $payCalculator): bool {
                    $pickupDistance = $payCalculator->distanceInKilometres(
                        (float) $rider->current_latitude,
                        (float) $rider->current_longitude,
                        (float) $order->restaurant->latitude,
                        (float) $order->restaurant->longitude,
                    );
                    $order->setAttribute('pickup_distance_km', $pickupDistance);

                    return $pickupDistance <= (float) $order->poolOffer->search_radius_km;
                })
                ->each(fn (Order $order) => $order->setAttribute(
                    'delivery_distance_km',
                    $payCalculator->distanceInKilometres(
                        (float) $order->restaurant->latitude,
                        (float) $order->restaurant->longitude,
                        (float) $order->deliveryAddress->latitude,
                        (float) $order->deliveryAddress->longitude,
                    ),
                ))
                ->sortBy('pickup_distance_km')
                ->values();
        }

        $serializedOrders = [];

        foreach ($orders as $order) {
            $pickupDistance = round((float) $order->getAttribute('pickup_distance_km'), 2);
            $deliveryDistance = round((float) $order->getAttribute('delivery_distance_km'), 2);
            $pay = $payCalculator->estimate($order, $deliveryDistance);
            $blockReason = null;

            if ($hasActiveOrder) {
                $blockReason = 'Finish your active delivery before accepting another order.';
            } elseif ($order->payment_method === 'cod' && ! $rider->canAcceptCodOrders()) {
                $blockReason = 'Cash remit limit reached. Remit cash before accepting this COD order.';
            }

            $serializedOrders[] = [
                'id' => $order->id,
                'order_number' => $order->order_number,
                'payment_method' => $order->payment_method,
                'restaurant' => [
                    'name' => $order->restaurant->name,
                    'address' => $order->restaurant->address,
                    'latitude' => (float) $order->restaurant->latitude,
                    'longitude' => (float) $order->restaurant->longitude,
                ],
                'delivery_address' => [
                    'address_line' => $order->deliveryAddress->address_line,
                    'latitude' => (float) $order->deliveryAddress->latitude,
                    'longitude' => (float) $order->deliveryAddress->longitude,
                ],
                'pickup_distance_km' => $pickupDistance,
                'delivery_distance_km' => $deliveryDistance,
                'search_radius_km' => (float) $order->poolOffer->search_radius_km,
                ...$pay,
                'estimated_ready_at' => $order->estimated_ready_at === null
                    ? null
                    : Carbon::parse($order->estimated_ready_at)->toIso8601String(),
                'accept_block_reason' => $blockReason,
            ];
        }

        return $serializedOrders;
    }
}
