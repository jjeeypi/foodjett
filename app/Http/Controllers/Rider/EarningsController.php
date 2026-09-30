<?php

namespace App\Http\Controllers\Rider;

use App\Http\Controllers\Controller;
use App\Models\RiderEarning;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Inertia\Inertia;
use Inertia\Response;

class EarningsController extends Controller
{
    public function index(Request $request): Response
    {
        $rider = $request->user()?->rider;
        abort_unless($rider !== null, 403);

        $filters = $request->validate([
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:from'],
        ]);
        $from = isset($filters['from'])
            ? Carbon::createFromFormat('Y-m-d', $filters['from'])->startOfDay()
            : null;
        $to = isset($filters['to'])
            ? Carbon::createFromFormat('Y-m-d', $filters['to'])->endOfDay()
            : null;
        $now = now();

        $earnings = RiderEarning::query()
            ->where('rider_earnings.rider_id', $rider->id)
            ->join('orders', 'orders.id', '=', 'rider_earnings.order_id')
            ->when($from, fn (Builder $query, CarbonInterface $date) => $query->where('orders.delivered_at', '>=', $date))
            ->when($to, fn (Builder $query, CarbonInterface $date) => $query->where('orders.delivered_at', '<=', $date))
            ->with(['order:id,order_number,restaurant_id,delivered_at', 'order.restaurant:id,name'])
            ->select('rider_earnings.*')
            ->orderByDesc('orders.delivered_at')
            ->orderByDesc('rider_earnings.id')
            ->paginate(10)
            ->withQueryString()
            ->through(fn (RiderEarning $earning): array => [
                'id' => $earning->id,
                'order_number' => $earning->order?->order_number,
                'restaurant_name' => $earning->order?->restaurant?->name,
                'delivered_at' => $earning->order?->delivered_at?->toIso8601String(),
                'base_pay' => (float) $earning->base_pay,
                'distance_pay' => (float) $earning->distance_pay,
                'waiting_pay' => (float) $earning->waiting_pay,
                'incentive_pay' => (float) $earning->incentive_pay,
                'tip_amount' => (float) $earning->tip_amount,
                'total_earned' => (float) $earning->total_earned,
            ]);

        $pendingRemittanceTotal = (float) $rider->cashRemittances()
            ->where('status', 'pending')
            ->sum('amount');
        $cashOnHand = (float) $rider->cash_on_hand;

        return Inertia::render('rider/earnings/index', [
            'summary' => [
                'today' => $this->totalBetween($rider->id, $now->copy()->startOfDay(), $now),
                'week' => $this->totalBetween(
                    $rider->id,
                    $now->copy()->startOfWeek(Carbon::MONDAY),
                    $now,
                ),
                'month' => $this->totalBetween($rider->id, $now->copy()->startOfMonth(), $now),
            ],
            'filters' => [
                'from' => $filters['from'] ?? '',
                'to' => $filters['to'] ?? '',
            ],
            'earnings' => $earnings,
            'payouts' => $rider->payouts()
                ->latest('period_end')
                ->latest('id')
                ->get()
                ->map(fn ($payout): array => [
                    'id' => $payout->id,
                    'period_start' => $payout->period_start->toDateString(),
                    'period_end' => $payout->period_end->toDateString(),
                    'total_amount' => (float) $payout->total_amount,
                    'status' => $payout->status,
                    'paid_at' => $payout->paid_at?->toIso8601String(),
                ]),
            'cash' => [
                'cash_on_hand' => $cashOnHand,
                'cash_remit_limit' => (float) $rider->cash_remit_limit,
                'pending_remittance_total' => $pendingRemittanceTotal,
                'available_to_remit' => max(0, round($cashOnHand - $pendingRemittanceTotal, 2)),
            ],
            'remittances' => $rider->cashRemittances()
                ->latest()
                ->get()
                ->map(fn ($remittance): array => [
                    'id' => $remittance->id,
                    'amount' => (float) $remittance->amount,
                    'reference_note' => $remittance->reference_note,
                    'status' => $remittance->status,
                    'remitted_at' => $remittance->remitted_at?->toIso8601String(),
                    'created_at' => $remittance->created_at->toIso8601String(),
                ]),
        ]);
    }

    private function totalBetween(int $riderId, CarbonInterface $from, CarbonInterface $to): float
    {
        return round((float) RiderEarning::query()
            ->join('orders', 'orders.id', '=', 'rider_earnings.order_id')
            ->where('rider_earnings.rider_id', $riderId)
            ->whereBetween('orders.delivered_at', [$from, $to])
            ->sum('rider_earnings.total_earned'), 2);
    }
}
