<?php

namespace App\Http\Controllers\Admin;

use App\Actions\Payments\RecordPaymentStatus;
use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Order;
use App\Models\Payment;
use App\Models\Restaurant;
use App\Models\RestaurantPayout;
use App\Models\Rider;
use App\Models\RiderEarning;
use App\Models\RiderPayout;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class FinanceController extends Controller
{
    public function transactions(Request $request): Response
    {
        Gate::authorize('viewAny', Payment::class);

        $filters = $request->validate([
            'method' => ['nullable', Rule::in(['cod', 'gcash', 'card'])],
            'status' => ['nullable', Rule::in(['pending', 'paid', 'refunded', 'partially_refunded', 'failed'])],
            'date_from' => ['nullable', 'date_format:Y-m-d'],
            'date_to' => ['nullable', 'date_format:Y-m-d'],
        ]);
        $this->ensureValidDateRange($filters['date_from'] ?? null, $filters['date_to'] ?? null);

        return Inertia::render('admin/finance/transactions', [
            'payments' => Payment::query()
                ->with([
                    'order:id,order_number,restaurant_id,customer_id',
                    'order.restaurant:id,name',
                    'order.customer.user:id,name',
                ])
                ->when(
                    $filters['method'] ?? null,
                    fn (Builder $query, string $method) => $query->where('method', $method)
                )
                ->when(
                    $filters['status'] ?? null,
                    fn (Builder $query, string $status) => $query->where('status', $status)
                )
                ->when(
                    $filters['date_from'] ?? null,
                    fn (Builder $query, string $date) => $query->whereDate('paid_at', '>=', $date)
                )
                ->when(
                    $filters['date_to'] ?? null,
                    fn (Builder $query, string $date) => $query->whereDate('paid_at', '<=', $date)
                )
                ->latest()
                ->paginate(20)
                ->withQueryString(),
            'filters' => [
                'method' => $filters['method'] ?? '',
                'status' => $filters['status'] ?? '',
                'date_from' => $filters['date_from'] ?? '',
                'date_to' => $filters['date_to'] ?? '',
            ],
        ]);
    }

    public function refundPayment(
        Request $request,
        Payment $payment,
        RecordPaymentStatus $paymentStatus
    ): RedirectResponse {
        Gate::authorize('refund', $payment);

        $validated = $request->validate([
            'amount' => ['required', 'numeric', 'decimal:0,2', 'gt:0'],
            'reason' => ['nullable', 'string', 'max:1000'],
        ]);

        DB::transaction(function () use ($payment, $validated, $paymentStatus): void {
            $lockedPayment = Payment::query()
                ->whereKey($payment->id)
                ->lockForUpdate()
                ->firstOrFail();

            if (! in_array($lockedPayment->status, ['paid', 'partially_refunded'], true)) {
                throw ValidationException::withMessages([
                    'amount' => 'Only paid or partially refunded payments can be refunded.',
                ]);
            }

            $amount = round((float) $validated['amount'], 2);
            $remaining = round(
                (float) $lockedPayment->amount - (float) $lockedPayment->refunded_amount,
                2
            );

            if ($amount > $remaining) {
                throw ValidationException::withMessages([
                    'amount' => 'The refund amount cannot exceed the remaining refundable balance.',
                ]);
            }

            $before = $lockedPayment->only([
                'status',
                'refunded_amount',
                'refunded_at',
            ]);
            $newRefundedAmount = round((float) $lockedPayment->refunded_amount + $amount, 2);
            $newStatus = $newRefundedAmount >= (float) $lockedPayment->amount
                ? 'refunded'
                : 'partially_refunded';
            $reason = trim((string) ($validated['reason'] ?? ''));
            $note = 'Admin recorded a '.($newStatus === 'refunded' ? 'full' : 'partial')
                .' refund of PHP '.number_format($amount, 2)
                .($reason !== '' ? ': '.$reason : '.');

            $lockedPayment->forceFill([
                'refunded_amount' => $newRefundedAmount,
                'refunded_at' => now(),
            ])->save();
            $paymentStatus->transition($lockedPayment, $newStatus, 'admin', $note);

            $this->audit(
                $lockedPayment,
                'payment.refunded',
                $before,
                $lockedPayment->fresh()->only(['status', 'refunded_amount', 'refunded_at'])
            );
        });

        return back()->with('success', 'Refund recorded successfully.');
    }

    public function restaurantPayouts(Request $request): Response
    {
        Gate::authorize('viewAny', RestaurantPayout::class);

        $filters = $request->validate([
            'status' => ['nullable', Rule::in(['pending', 'paid'])],
            'restaurant_id' => ['nullable', 'integer', 'exists:restaurants,id'],
        ]);

        return Inertia::render('admin/finance/restaurant-payouts', [
            'payouts' => RestaurantPayout::query()
                ->with('restaurant:id,name')
                ->when(
                    $filters['status'] ?? null,
                    fn (Builder $query, string $status) => $query->where('status', $status)
                )
                ->when(
                    $filters['restaurant_id'] ?? null,
                    fn (Builder $query, int $restaurantId) => $query->where('restaurant_id', $restaurantId)
                )
                ->latest('period_end')
                ->latest('id')
                ->paginate(20)
                ->withQueryString(),
            'filters' => [
                'status' => $filters['status'] ?? '',
                'restaurant_id' => isset($filters['restaurant_id'])
                    ? (string) $filters['restaurant_id']
                    : '',
            ],
            'restaurants' => Restaurant::query()->orderBy('name')->get(['id', 'name']),
        ]);
    }

    public function generateRestaurantPayouts(Request $request): RedirectResponse
    {
        Gate::authorize('generate', RestaurantPayout::class);
        [$periodStart, $periodEnd, $startAt, $endAt] = $this->validatedPayoutPeriod($request);

        $result = DB::transaction(function () use ($periodStart, $periodEnd, $startAt, $endAt): array {
            $totals = Order::query()
                ->where('status', 'delivered')
                ->whereBetween('delivered_at', [$startAt, $endAt])
                ->select('restaurant_id')
                ->selectRaw('SUM(subtotal) AS gross_sales')
                ->selectRaw('SUM(COALESCE(commission_amount, 0)) AS commission_deducted')
                ->groupBy('restaurant_id')
                ->get();

            $created = 0;
            $skipped = 0;

            foreach ($totals as $total) {
                $restaurantId = (int) $total->restaurant_id;

                if ($this->restaurantHasOverlappingPayout($restaurantId, $periodStart, $periodEnd)) {
                    $skipped++;

                    continue;
                }

                $grossSales = round((float) $total->getAttribute('gross_sales'), 2);
                $commission = round((float) $total->getAttribute('commission_deducted'), 2);
                $payout = RestaurantPayout::query()->create([
                    'restaurant_id' => $restaurantId,
                    'period_start' => $periodStart,
                    'period_end' => $periodEnd,
                    'gross_sales' => $grossSales,
                    'commission_deducted' => $commission,
                    'net_amount' => round($grossSales - $commission, 2),
                    'status' => 'pending',
                ]);
                $this->audit($payout, 'restaurant_payout.generated', [], $payout->toArray());
                $created++;
            }

            return compact('created', 'skipped');
        });

        if ($result['created'] === 0) {
            throw ValidationException::withMessages([
                'period_start' => $result['skipped'] > 0
                    ? 'All qualifying restaurants already have an overlapping payout period.'
                    : 'No delivered restaurant orders were found in this period.',
            ]);
        }

        $message = "Generated {$result['created']} restaurant payout(s).";
        if ($result['skipped'] > 0) {
            $message .= " Skipped {$result['skipped']} overlapping payout(s).";
        }

        return back()->with('success', $message);
    }

    public function markRestaurantPayoutPaid(RestaurantPayout $payout): RedirectResponse
    {
        Gate::authorize('markPaid', $payout);

        DB::transaction(function () use ($payout): void {
            $lockedPayout = RestaurantPayout::query()
                ->whereKey($payout->id)
                ->lockForUpdate()
                ->firstOrFail();

            if ($lockedPayout->status === 'paid') {
                return;
            }

            $before = $lockedPayout->only(['status', 'paid_at']);
            $lockedPayout->update(['status' => 'paid', 'paid_at' => now()]);
            $this->audit(
                $lockedPayout,
                'restaurant_payout.paid',
                $before,
                $lockedPayout->only(['status', 'paid_at'])
            );
        });

        return back()->with('success', 'Restaurant payout marked as paid.');
    }

    public function riderPayouts(Request $request): Response
    {
        Gate::authorize('viewAny', RiderPayout::class);

        $filters = $request->validate([
            'status' => ['nullable', Rule::in(['pending', 'paid'])],
            'rider_id' => ['nullable', 'integer', 'exists:riders,id'],
        ]);

        return Inertia::render('admin/finance/rider-payouts', [
            'payouts' => RiderPayout::query()
                ->with('rider.user:id,name')
                ->when(
                    $filters['status'] ?? null,
                    fn (Builder $query, string $status) => $query->where('status', $status)
                )
                ->when(
                    $filters['rider_id'] ?? null,
                    fn (Builder $query, int $riderId) => $query->where('rider_id', $riderId)
                )
                ->latest('period_end')
                ->latest('id')
                ->paginate(20)
                ->withQueryString(),
            'filters' => [
                'status' => $filters['status'] ?? '',
                'rider_id' => isset($filters['rider_id'])
                    ? (string) $filters['rider_id']
                    : '',
            ],
            'riders' => Rider::query()
                ->with('user:id,name')
                ->get(['id', 'user_id'])
                ->sortBy('user.name')
                ->values(),
        ]);
    }

    public function generateRiderPayouts(Request $request): RedirectResponse
    {
        Gate::authorize('generate', RiderPayout::class);
        [$periodStart, $periodEnd, $startAt, $endAt] = $this->validatedPayoutPeriod($request);

        $result = DB::transaction(function () use ($periodStart, $periodEnd, $startAt, $endAt): array {
            $totals = RiderEarning::query()
                ->join('orders', 'orders.id', '=', 'rider_earnings.order_id')
                ->where('orders.status', 'delivered')
                ->whereBetween('orders.delivered_at', [$startAt, $endAt])
                ->select('rider_earnings.rider_id')
                ->selectRaw('SUM(rider_earnings.total_earned) AS payout_total')
                ->groupBy('rider_earnings.rider_id')
                ->get();

            $created = 0;
            $skipped = 0;

            foreach ($totals as $total) {
                $riderId = (int) $total->rider_id;

                if ($this->riderHasOverlappingPayout($riderId, $periodStart, $periodEnd)) {
                    $skipped++;

                    continue;
                }

                $payout = RiderPayout::query()->create([
                    'rider_id' => $riderId,
                    'period_start' => $periodStart,
                    'period_end' => $periodEnd,
                    'total_amount' => round((float) $total->getAttribute('payout_total'), 2),
                    'status' => 'pending',
                ]);
                $this->audit($payout, 'rider_payout.generated', [], $payout->toArray());
                $created++;
            }

            return compact('created', 'skipped');
        });

        if ($result['created'] === 0) {
            throw ValidationException::withMessages([
                'period_start' => $result['skipped'] > 0
                    ? 'All qualifying riders already have an overlapping payout period.'
                    : 'No delivered rider earnings were found in this period.',
            ]);
        }

        $message = "Generated {$result['created']} rider payout(s).";
        if ($result['skipped'] > 0) {
            $message .= " Skipped {$result['skipped']} overlapping payout(s).";
        }

        return back()->with('success', $message);
    }

    public function markRiderPayoutPaid(RiderPayout $payout): RedirectResponse
    {
        Gate::authorize('markPaid', $payout);

        DB::transaction(function () use ($payout): void {
            $lockedPayout = RiderPayout::query()
                ->whereKey($payout->id)
                ->lockForUpdate()
                ->firstOrFail();

            if ($lockedPayout->status === 'paid') {
                return;
            }

            $before = $lockedPayout->only(['status', 'paid_at']);
            $lockedPayout->update(['status' => 'paid', 'paid_at' => now()]);
            $this->audit(
                $lockedPayout,
                'rider_payout.paid',
                $before,
                $lockedPayout->only(['status', 'paid_at'])
            );
        });

        return back()->with('success', 'Rider payout marked as paid.');
    }

    private function ensureValidDateRange(?string $dateFrom, ?string $dateTo): void
    {
        if ($dateFrom !== null && $dateTo !== null && $dateTo < $dateFrom) {
            throw ValidationException::withMessages([
                'date_to' => 'The end date must be on or after the start date.',
            ]);
        }
    }

    /**
     * @return array{0: string, 1: string, 2: Carbon, 3: Carbon}
     */
    private function validatedPayoutPeriod(Request $request): array
    {
        $validated = $request->validate([
            'period_start' => ['required', 'date_format:Y-m-d'],
            'period_end' => ['required', 'date_format:Y-m-d', 'after_or_equal:period_start', 'before_or_equal:today'],
        ]);
        $periodStart = $validated['period_start'];
        $periodEnd = $validated['period_end'];

        return [
            $periodStart,
            $periodEnd,
            Carbon::createFromFormat('Y-m-d', $periodStart)->startOfDay(),
            Carbon::createFromFormat('Y-m-d', $periodEnd)->endOfDay(),
        ];
    }

    private function restaurantHasOverlappingPayout(int $restaurantId, string $periodStart, string $periodEnd): bool
    {
        return RestaurantPayout::query()
            ->where('restaurant_id', $restaurantId)
            ->whereDate('period_start', '<=', $periodEnd)
            ->whereDate('period_end', '>=', $periodStart)
            ->exists();
    }

    private function riderHasOverlappingPayout(int $riderId, string $periodStart, string $periodEnd): bool
    {
        return RiderPayout::query()
            ->where('rider_id', $riderId)
            ->whereDate('period_start', '<=', $periodEnd)
            ->whereDate('period_end', '>=', $periodStart)
            ->exists();
    }

    /**
     * @param  array<string, mixed>  $before
     * @param  array<string, mixed>  $after
     */
    private function audit(Model $subject, string $action, array $before, array $after): void
    {
        AuditLog::query()->create([
            'user_id' => request()->user()?->id,
            'action' => $action,
            'subject_type' => $subject::class,
            'subject_id' => (int) $subject->getKey(),
            'changes' => ['before' => $before, 'after' => $after],
            'created_at' => now(),
        ]);
    }
}
