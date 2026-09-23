<?php

namespace App\Http\Controllers\Admin;

use App\Actions\Payments\RecordPaymentStatus;
use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Order;
use App\Models\OrderReport;
use App\Models\OrderStatusHistory;
use App\Models\Payment;
use App\Models\Restaurant;
use App\Models\Rider;
use App\Models\RiderPoolOffer;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class OrderController extends Controller
{
    /** @var list<string> */
    private const ORDER_STATUSES = [
        'placed', 'accepted', 'preparing', 'ready',
        'finding_rider', 'rider_assigned', 'at_restaurant',
        'picked_up', 'on_the_way', 'arrived', 'delivered',
        'rejected_by_restaurant', 'cancelled_by_customer',
        'cancelled_by_restaurant', 'cancelled_no_rider',
        'cancelled_by_admin', 'failed_delivery',
    ];

    /** @var list<string> */
    private const ESCALATED_STAGES = ['admin_alerted', 'customer_notified', 'auto_cancelled'];

    public function index(Request $request): Response
    {
        Gate::authorize('viewAny', Order::class);

        $filters = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'status' => ['nullable', Rule::in(self::ORDER_STATUSES)],
            'restaurant_id' => ['nullable', 'integer', 'exists:restaurants,id'],
            'date_from' => ['nullable', 'date_format:Y-m-d'],
            'date_to' => ['nullable', 'date_format:Y-m-d'],
        ]);

        if (isset($filters['date_from'], $filters['date_to']) && $filters['date_to'] < $filters['date_from']) {
            throw ValidationException::withMessages([
                'date_to' => 'The end date must be on or after the start date.',
            ]);
        }

        return Inertia::render('admin/orders/index', [
            'orders' => Order::query()
                ->with([
                    'restaurant:id,name',
                    'customer.user:id,name',
                    'rider.user:id,name',
                ])
                ->when(
                    $filters['search'] ?? null,
                    fn (Builder $query, string $search) => $query
                        ->where('order_number', 'like', "%{$search}%")
                )
                ->when(
                    $filters['status'] ?? null,
                    fn (Builder $query, string $status) => $query->where('status', $status)
                )
                ->when(
                    $filters['restaurant_id'] ?? null,
                    fn (Builder $query, int $restaurantId) => $query->where('restaurant_id', $restaurantId)
                )
                ->when(
                    $filters['date_from'] ?? null,
                    fn (Builder $query, string $date) => $query->whereDate('placed_at', '>=', $date)
                )
                ->when(
                    $filters['date_to'] ?? null,
                    fn (Builder $query, string $date) => $query->whereDate('placed_at', '<=', $date)
                )
                ->latest('placed_at')
                ->paginate(20)
                ->withQueryString(),
            'filters' => [
                'search' => $filters['search'] ?? '',
                'status' => $filters['status'] ?? '',
                'restaurant_id' => isset($filters['restaurant_id'])
                    ? (string) $filters['restaurant_id']
                    : '',
                'date_from' => $filters['date_from'] ?? '',
                'date_to' => $filters['date_to'] ?? '',
            ],
            'restaurants' => Restaurant::query()
                ->orderBy('name')
                ->get(['id', 'name']),
            'statuses' => self::ORDER_STATUSES,
        ]);
    }

    public function show(Order $order): Response
    {
        Gate::authorize('view', $order);

        $order->load([
            'restaurant:id,name,address,latitude,longitude',
            'customer.user:id,name,email,phone',
            'rider.user:id,name,email,phone',
            'deliveryAddress',
            'items.menuItem:id,name',
            'items.variant:id,name,price_delta',
            'items.addons.addon:id,name,price',
            'statusHistory' => fn ($query) => $query->oldest('created_at'),
            'payment.statusHistory' => fn ($query) => $query->oldest('created_at'),
            'poolOffer',
        ]);

        return Inertia::render('admin/orders/show', ['order' => $order]);
    }

    public function unassigned(): Response
    {
        Gate::authorize('viewAny', Order::class);

        return Inertia::render('admin/orders/unassigned', [
            'orders' => Order::query()
                ->with([
                    'restaurant:id,name,address,latitude,longitude',
                    'customer.user:id,name',
                    'poolOffer',
                ])
                ->where('status', 'finding_rider')
                ->whereNull('rider_id')
                ->whereHas('poolOffer', fn (Builder $query) => $query
                    ->whereIn('escalation_stage', self::ESCALATED_STAGES))
                ->oldest('rider_search_started_at')
                ->paginate(15),
        ]);
    }

    public function nearbyRiders(Order $order): JsonResponse
    {
        Gate::authorize('assignRider', $order);

        abort_unless($order->status === 'finding_rider' && $order->rider_id === null, 409);
        $order->loadMissing('restaurant:id,latitude,longitude');

        $query = Rider::query()
            ->with('user:id,name,status')
            ->where('approval_status', 'approved')
            ->where('availability_status', 'available')
            ->whereNotNull('current_latitude')
            ->whereNotNull('current_longitude')
            ->whereHas('user', fn (Builder $query) => $query->where('status', 'active'));

        if ($order->payment_method === 'cod') {
            $query->whereColumn('cash_on_hand', '<', 'cash_remit_limit');
        }

        $latitude = (float) $order->restaurant->latitude;
        $longitude = (float) $order->restaurant->longitude;

        if (DB::connection()->getDriverName() === 'mysql') {
            $distanceSql = <<<'SQL'
                6371 * 2 * ASIN(SQRT(
                    POWER(SIN(RADIANS(riders.current_latitude - ?) / 2), 2) +
                    COS(RADIANS(?)) * COS(RADIANS(riders.current_latitude)) *
                    POWER(SIN(RADIANS(riders.current_longitude - ?) / 2), 2)
                ))
                SQL;

            $riders = $query
                ->select('riders.*')
                ->selectRaw("{$distanceSql} AS distance_km", [$latitude, $latitude, $longitude])
                ->orderBy('distance_km')
                ->limit(25)
                ->get();
        } else {
            $riders = $query
                ->get()
                ->each(fn (Rider $rider) => $rider->setAttribute(
                    'distance_km',
                    $this->distanceInKilometres(
                        $latitude,
                        $longitude,
                        (float) $rider->current_latitude,
                        (float) $rider->current_longitude
                    )
                ))
                ->sortBy('distance_km')
                ->take(25)
                ->values();
        }

        return response()->json([
            'riders' => $riders->map(fn (Rider $rider): array => [
                'id' => $rider->id,
                'name' => $rider->user->name,
                'vehicle_type' => $rider->vehicle_type,
                'plate_number' => $rider->plate_number,
                'distance_km' => round((float) $rider->getAttribute('distance_km'), 2),
                'cash_on_hand' => $rider->cash_on_hand,
                'cash_remit_limit' => $rider->cash_remit_limit,
            ])->values(),
        ]);
    }

    public function assignRider(Request $request, Order $order): RedirectResponse
    {
        Gate::authorize('assignRider', $order);

        $validated = $request->validate([
            'rider_id' => ['required', 'integer', 'exists:riders,id'],
        ]);

        DB::transaction(function () use ($order, $validated): void {
            $lockedOrder = Order::query()->lockForUpdate()->findOrFail($order->id);
            $rider = Rider::query()
                ->whereKey((int) $validated['rider_id'])
                ->lockForUpdate()
                ->firstOrFail();
            $rider->load('user');
            $offer = RiderPoolOffer::query()
                ->where('order_id', $lockedOrder->id)
                ->lockForUpdate()
                ->firstOrFail();

            if ($lockedOrder->status !== 'finding_rider' || $lockedOrder->rider_id !== null) {
                throw ValidationException::withMessages([
                    'rider_id' => 'This order is no longer waiting for a rider.',
                ]);
            }

            if (! in_array($offer->escalation_stage, self::ESCALATED_STAGES, true)) {
                throw ValidationException::withMessages([
                    'rider_id' => 'This order has not reached the admin-assignment stage.',
                ]);
            }

            if (
                $rider->approval_status !== 'approved'
                || $rider->availability_status !== 'available'
                || ! $rider->user->isActive()
            ) {
                throw ValidationException::withMessages([
                    'rider_id' => 'The selected rider is no longer available.',
                ]);
            }

            if ($lockedOrder->payment_method === 'cod' && ! $rider->canAcceptCodOrders()) {
                throw ValidationException::withMessages([
                    'rider_id' => 'The selected rider has reached their cash remit limit.',
                ]);
            }

            $before = $lockedOrder->only(['rider_id', 'status', 'rider_assigned_at']);
            $lockedOrder->update([
                'rider_id' => $rider->id,
                'status' => 'rider_assigned',
                'rider_assigned_at' => now(),
            ]);
            $offer->update(['admin_assigned' => true]);

            OrderStatusHistory::query()->create([
                'order_id' => $lockedOrder->id,
                'status' => 'rider_assigned',
                'changed_by' => 'admin',
                'note' => "Manually assigned to {$rider->user->name}.",
            ]);

            $this->audit($lockedOrder, 'order.rider_assigned', $before, $lockedOrder->only([
                'rider_id',
                'status',
                'rider_assigned_at',
            ]));
        });

        return back()->with('success', 'Rider assigned successfully.');
    }

    public function cancel(Request $request, Order $order): RedirectResponse
    {
        Gate::authorize('cancelAsAdmin', $order);

        $validated = $request->validate([
            'reason' => ['required', 'string', 'max:2000'],
        ]);

        DB::transaction(function () use ($order, $validated): void {
            $lockedOrder = Order::query()->lockForUpdate()->findOrFail($order->id);

            if ($lockedOrder->isTerminal()) {
                throw ValidationException::withMessages([
                    'reason' => 'A terminal order cannot be cancelled again.',
                ]);
            }

            $before = $lockedOrder->only(['status', 'cancellation_reason', 'cancelled_by']);
            $lockedOrder->update([
                'status' => 'cancelled_by_admin',
                'cancellation_reason' => $validated['reason'],
                'cancelled_by' => 'admin',
            ]);
            OrderStatusHistory::query()->create([
                'order_id' => $lockedOrder->id,
                'status' => 'cancelled_by_admin',
                'changed_by' => 'admin',
                'note' => $validated['reason'],
            ]);
            $this->audit($lockedOrder, 'order.cancelled', $before, $lockedOrder->only([
                'status',
                'cancellation_reason',
                'cancelled_by',
            ]));
        });

        return back()->with('success', 'Order cancelled by administrator.');
    }

    public function refund(
        Request $request,
        Order $order,
        RecordPaymentStatus $paymentStatus
    ): RedirectResponse {
        Gate::authorize('refund', $order);

        $validated = $request->validate([
            'reason' => ['required', 'string', 'max:2000'],
        ]);

        DB::transaction(function () use ($order, $validated, $paymentStatus): void {
            $payment = Payment::query()
                ->where('order_id', $order->id)
                ->lockForUpdate()
                ->firstOrFail();

            if (! in_array($payment->status, ['paid', 'partially_refunded'], true)) {
                throw ValidationException::withMessages([
                    'reason' => 'Only a paid payment can be refunded.',
                ]);
            }

            $before = $payment->only(['status', 'refunded_amount', 'refunded_at']);
            $payment->forceFill([
                'refunded_amount' => $payment->amount,
                'refunded_at' => now(),
            ])->save();
            $paymentStatus->transition(
                $payment,
                'refunded',
                'admin',
                'Admin recorded a full refund: '.$validated['reason']
            );
            $this->audit($payment, 'payment.refunded', $before, $payment->fresh()->only([
                'status',
                'refunded_amount',
                'refunded_at',
            ]));
        });

        return back()->with('success', 'Payment marked as fully refunded.');
    }

    public function reports(Request $request): Response
    {
        Gate::authorize('viewAny', OrderReport::class);

        $filters = $request->validate([
            'status' => ['nullable', Rule::in(['open', 'under_review', 'resolved', 'rejected'])],
            'type' => ['nullable', Rule::in([
                'missing_item', 'wrong_item', 'late_delivery', 'no_show_rider',
                'rude_behavior', 'customer_unreachable', 'accident', 'other',
            ])],
            'against' => ['nullable', Rule::in(['restaurant', 'rider', 'customer', 'platform'])],
        ]);

        return Inertia::render('admin/orders/reports', [
            'reports' => OrderReport::query()
                ->with(['order:id,order_number', 'reportedBy:id,name'])
                ->when(
                    $filters['status'] ?? null,
                    fn (Builder $query, string $status) => $query->where('status', $status)
                )
                ->when(
                    $filters['type'] ?? null,
                    fn (Builder $query, string $type) => $query->where('type', $type)
                )
                ->when(
                    $filters['against'] ?? null,
                    fn (Builder $query, string $against) => $query->where('against', $against)
                )
                ->latest()
                ->paginate(20)
                ->withQueryString(),
            'filters' => [
                'status' => $filters['status'] ?? '',
                'type' => $filters['type'] ?? '',
                'against' => $filters['against'] ?? '',
            ],
        ]);
    }

    public function showReport(OrderReport $report): Response
    {
        Gate::authorize('view', $report);

        $report->load([
            'order.restaurant:id,name',
            'order.customer.user:id,name',
            'order.rider.user:id,name',
            'reportedBy:id,name,email,role',
            'resolvedByAdmin.user:id,name',
        ]);

        return Inertia::render('admin/orders/report-show', ['report' => $report]);
    }

    public function resolveReport(Request $request, OrderReport $report): RedirectResponse
    {
        Gate::authorize('resolve', $report);

        $validated = $request->validate([
            'resolution' => ['required', 'string', 'max:2000'],
        ]);

        return $this->closeReport($report, 'resolved', $validated['resolution']);
    }

    public function rejectReport(Request $request, OrderReport $report): RedirectResponse
    {
        Gate::authorize('reject', $report);

        $validated = $request->validate([
            'resolution' => ['required', 'string', 'max:2000'],
        ]);

        return $this->closeReport($report, 'rejected', $validated['resolution']);
    }

    private function closeReport(OrderReport $report, string $status, string $resolution): RedirectResponse
    {
        $adminId = request()->user()?->admin?->id;
        abort_unless($adminId !== null, 403);

        DB::transaction(function () use ($report, $status, $resolution, $adminId): void {
            $lockedReport = OrderReport::query()
                ->whereKey($report->id)
                ->lockForUpdate()
                ->firstOrFail();

            if (in_array($lockedReport->status, ['resolved', 'rejected'], true)) {
                throw ValidationException::withMessages([
                    'resolution' => 'This report has already been closed.',
                ]);
            }

            $before = $lockedReport->only(['status', 'resolution', 'resolved_by_admin_id', 'resolved_at']);
            $lockedReport->update([
                'status' => $status,
                'resolution' => $resolution,
                'resolved_by_admin_id' => $adminId,
                'resolved_at' => now(),
            ]);
            $this->audit($lockedReport, "order_report.{$status}", $before, $lockedReport->only([
                'status',
                'resolution',
                'resolved_by_admin_id',
                'resolved_at',
            ]));
        });

        return back()->with('success', $status === 'resolved'
            ? 'Order report resolved.'
            : 'Order report rejected.');
    }

    private function distanceInKilometres(float $fromLat, float $fromLng, float $toLat, float $toLng): float
    {
        $latitudeDelta = deg2rad($toLat - $fromLat);
        $longitudeDelta = deg2rad($toLng - $fromLng);
        $a = sin($latitudeDelta / 2) ** 2
            + cos(deg2rad($fromLat)) * cos(deg2rad($toLat))
            * sin($longitudeDelta / 2) ** 2;

        return round(6371 * 2 * asin(sqrt($a)), 2);
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
