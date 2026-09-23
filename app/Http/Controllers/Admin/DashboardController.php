<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\OrderReport;
use App\Models\Payment;
use App\Models\Restaurant;
use App\Models\Rider;
use App\Models\RiderPoolOffer;
use Illuminate\Support\Collection;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function __invoke(): Response
    {
        $pendingRestaurants = Restaurant::query()
            ->where('approval_status', 'pending')
            ->count();
        $pendingRiders = Rider::query()
            ->where('approval_status', 'pending')
            ->count();

        $unassignedOrders = RiderPoolOffer::query()
            ->whereIn('escalation_stage', ['admin_alerted', 'customer_notified', 'auto_cancelled'])
            ->whereHas('order', fn ($query) => $query
                ->whereNull('rider_id')
                ->where('status', 'finding_rider'))
            ->count();

        return Inertia::render('admin/dashboard', [
            'stats' => [
                'orders_today' => Order::query()
                    ->whereDate('placed_at', today())
                    ->count(),
                'revenue_today' => Payment::query()
                    ->where('status', 'paid')
                    ->whereDate('paid_at', today())
                    ->sum('amount'),
                'active_restaurants' => Restaurant::query()
                    ->where('approval_status', 'approved')
                    ->whereHas('user', fn ($query) => $query->where('status', 'active'))
                    ->count(),
                'active_riders' => Rider::query()
                    ->where('approval_status', 'approved')
                    ->whereHas('user', fn ($query) => $query->where('status', 'active'))
                    ->count(),
                'pending_approvals' => $pendingRestaurants + $pendingRiders,
            ],
            'unassignedOrdersCount' => $unassignedOrders,
            'recentActivity' => $this->recentActivity(),
        ]);
    }

    /**
     * @return Collection<int, array{
     *     id: int,
     *     type: string,
     *     title: string,
     *     detail: string,
     *     occurred_at: string|null,
     *     href: string
     * }>
     */
    private function recentActivity(): Collection
    {
        $restaurantApplications = Restaurant::query()
            ->with('user:id,name')
            ->latest()
            ->limit(5)
            ->get()
            ->map(fn (Restaurant $restaurant): array => [
                'id' => $restaurant->id,
                'type' => 'restaurant_application',
                'title' => $restaurant->name,
                'detail' => 'Restaurant application · '.$restaurant->approval_status,
                'occurred_at' => $restaurant->created_at?->toISOString(),
                'href' => route('admin.restaurants.show', $restaurant, absolute: false),
            ]);

        $riderApplications = Rider::query()
            ->with('user:id,name')
            ->latest()
            ->limit(5)
            ->get()
            ->map(fn (Rider $rider): array => [
                'id' => $rider->id,
                'type' => 'rider_application',
                'title' => $rider->user->name,
                'detail' => 'Rider application · '.$rider->approval_status,
                'occurred_at' => $rider->created_at?->toISOString(),
                'href' => route('admin.riders.index', absolute: false),
            ]);

        $reports = OrderReport::query()
            ->with(['order:id,order_number', 'reportedBy:id,name'])
            ->latest()
            ->limit(5)
            ->get()
            ->map(fn (OrderReport $report): array => [
                'id' => $report->id,
                'type' => 'order_report',
                'title' => 'Report for '.$report->order->order_number,
                'detail' => str_replace('_', ' ', $report->type).' · '.$report->status,
                'occurred_at' => $report->created_at?->toISOString(),
                'href' => route('admin.orders.reports', absolute: false),
            ]);

        return $restaurantApplications
            ->concat($riderApplications)
            ->concat($reports)
            ->sortByDesc('occurred_at')
            ->take(10)
            ->values();
    }
}
