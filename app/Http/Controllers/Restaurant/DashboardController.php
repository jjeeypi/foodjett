<?php

namespace App\Http\Controllers\Restaurant;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\Payment;
use App\Models\Restaurant;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    private const MINIMUM_PREP_HISTORY = 3;

    public function __invoke(Request $request): Response
    {
        $restaurant = $this->restaurant($request);
        Gate::authorize('view', $restaurant);

        $completedPrepOrders = $restaurant->orders()
            ->whereNotNull('accepted_at')
            ->whereNotNull('ready_at')
            ->get(['accepted_at', 'ready_at', 'estimated_prep_minutes']);
        $actualPrepMinutes = $completedPrepOrders->map(
            fn (Order $order): float => Carbon::parse($order->accepted_at)
                ->diffInMinutes(Carbon::parse($order->ready_at))
        );
        $estimatedPrepMinutes = $completedPrepOrders
            ->pluck('estimated_prep_minutes')
            ->filter(fn (mixed $minutes): bool => $minutes !== null);

        return Inertia::render('restaurant/dashboard', [
            'stats' => [
                'orders_today' => $restaurant->orders()
                    ->whereDate('placed_at', today())
                    ->count(),
                'revenue_today' => $this->revenueToday($restaurant),
                'pending_orders' => $restaurant->orders()
                    ->where('status', 'placed')
                    ->count(),
                'prep_time' => [
                    'sample_size' => $completedPrepOrders->count(),
                    'actual_minutes' => $completedPrepOrders->count() >= self::MINIMUM_PREP_HISTORY
                        ? round($actualPrepMinutes->average(), 1)
                        : null,
                    'estimated_minutes' => $estimatedPrepMinutes->isNotEmpty()
                        ? round($estimatedPrepMinutes->average(), 1)
                        : $restaurant->default_prep_time_minutes,
                ],
            ],
            'recentOrders' => $restaurant->orders()
                ->with('customer.user:id,name')
                ->withCount('items')
                ->latest('placed_at')
                ->limit(8)
                ->get([
                    'id',
                    'order_number',
                    'customer_id',
                    'status',
                    'total_amount',
                    'payment_method',
                    'placed_at',
                ]),
        ]);
    }

    private function restaurant(Request $request): Restaurant
    {
        $restaurant = $request->user()?->restaurant;

        if ($restaurant === null) {
            abort(404, 'Restaurant profile not found.');
        }

        return $restaurant;
    }

    private function revenueToday(Restaurant $restaurant): float
    {
        /** @var Collection<int, Payment> $payments */
        $payments = Payment::query()
            ->whereHas('order', fn ($query) => $query->where('restaurant_id', $restaurant->id))
            ->whereIn('status', ['paid', 'partially_refunded', 'refunded'])
            ->whereDate('paid_at', today())
            ->get(['amount', 'refunded_amount']);

        return round($payments->sum(
            fn (Payment $payment): float => (float) $payment->amount - (float) $payment->refunded_amount
        ), 2);
    }
}
