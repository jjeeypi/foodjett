<?php

namespace App\Http\Controllers;

use App\Actions\Payments\RecordPaymentStatus;
use App\Http\Requests\CompleteRiderOrderRequest;
use App\Models\Order;
use App\Models\OrderStatusHistory;
use App\Models\Payment;
use App\Models\Rider;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class RiderOrderController extends Controller
{
    public function index(): Response
    {
        $rider = request()->user()?->rider;
        abort_unless($rider !== null, 403);

        $poolQuery = Order::query()
            ->with(['restaurant:id,name,address', 'deliveryAddress:id,address_line'])
            ->whereNull('rider_id')
            ->where('status', 'finding_rider');

        $blockedCodOrders = 0;
        if (! $rider->canAcceptCodOrders()) {
            $blockedCodOrders = (clone $poolQuery)->where('payment_method', 'cod')->count();
            $poolQuery->where('payment_method', '!=', 'cod');
        }

        return Inertia::render('rider/orders', [
            'rider' => $rider->only(['cash_on_hand', 'cash_remit_limit']),
            'poolOrders' => $poolQuery->oldest('placed_at')->get(),
            'activeOrders' => Order::query()
                ->with(['restaurant:id,name,address', 'deliveryAddress:id,address_line', 'payment'])
                ->where('rider_id', $rider->id)
                ->whereNotIn('status', [
                    'delivered', 'failed_delivery', 'rejected_by_restaurant',
                    'cancelled_by_customer', 'cancelled_by_restaurant', 'cancelled_no_rider',
                ])
                ->oldest('rider_assigned_at')
                ->get(),
            'blockedCodOrders' => $blockedCodOrders,
        ]);
    }

    public function accept(Order $order): RedirectResponse
    {
        $rider = request()->user()?->rider;
        abort_unless($rider !== null, 403);

        if ($order->payment_method === 'cod' && ! $rider->canAcceptCodOrders()) {
            throw ValidationException::withMessages([
                'order' => 'You have reached your cash remit limit. Remit cash before accepting another COD order.',
            ]);
        }

        Gate::authorize('updateAsRider', $order);

        DB::transaction(function () use ($order, $rider): void {
            $lockedOrder = Order::query()->lockForUpdate()->findOrFail($order->id);
            $lockedRider = Rider::query()->lockForUpdate()->findOrFail($rider->id);

            if ($lockedOrder->rider_id !== null || $lockedOrder->status !== 'finding_rider') {
                throw ValidationException::withMessages(['order' => 'This order is no longer available.']);
            }

            if ($lockedOrder->payment_method === 'cod' && ! $lockedRider->canAcceptCodOrders()) {
                throw ValidationException::withMessages([
                    'order' => 'You have reached your cash remit limit. Remit cash before accepting another COD order.',
                ]);
            }

            $lockedOrder->update([
                'rider_id' => $lockedRider->id,
                'status' => 'rider_assigned',
                'rider_assigned_at' => now(),
            ]);

            OrderStatusHistory::create([
                'order_id' => $lockedOrder->id,
                'status' => 'rider_assigned',
                'changed_by' => 'rider',
                'note' => 'Rider accepted the delivery.',
            ]);
        });

        return back()->with('success', 'Order accepted.');
    }

    public function complete(
        CompleteRiderOrderRequest $request,
        Order $order,
        RecordPaymentStatus $paymentStatus,
    ): RedirectResponse {
        DB::transaction(function () use ($request, $order, $paymentStatus): void {
            $lockedOrder = Order::query()->lockForUpdate()->findOrFail($order->id);
            $rider = Rider::query()->lockForUpdate()->findOrFail((int) $lockedOrder->rider_id);

            if (! in_array($lockedOrder->status, [
                'rider_assigned', 'at_restaurant', 'picked_up', 'on_the_way', 'arrived',
            ], true)) {
                throw ValidationException::withMessages(['outcome' => 'This order can no longer be completed.']);
            }

            if ($request->outcome() === 'failed_delivery') {
                $lockedOrder->update([
                    'status' => 'failed_delivery',
                    'cancellation_reason' => $request->cancellationReason(),
                    'cancelled_by' => 'rider',
                ]);

                OrderStatusHistory::create([
                    'order_id' => $lockedOrder->id,
                    'status' => 'failed_delivery',
                    'changed_by' => 'rider',
                    'note' => $request->cancellationReason(),
                ]);

                return;
            }

            if ($lockedOrder->payment_method === 'cod' && ! $request->cashCollected()) {
                throw ValidationException::withMessages([
                    'cash_collected' => 'Confirm that cash was collected before marking this COD order delivered.',
                ]);
            }

            $lockedOrder->update([
                'status' => 'delivered',
                'delivered_at' => now(),
            ]);

            OrderStatusHistory::create([
                'order_id' => $lockedOrder->id,
                'status' => 'delivered',
                'changed_by' => 'rider',
                'note' => $lockedOrder->payment_method === 'cod' ? 'Cash collected on delivery.' : 'Order delivered.',
            ]);

            if ($lockedOrder->payment_method === 'cod') {
                $payment = Payment::query()
                    ->where('order_id', $lockedOrder->id)
                    ->lockForUpdate()
                    ->firstOrFail();

                $paymentStatus->transition($payment, 'paid', 'rider', 'Rider confirmed cash collection.');
                $rider->update([
                    'cash_on_hand' => round((float) $rider->cash_on_hand + (float) $lockedOrder->total_amount, 2),
                ]);
            }
        });

        return back()->with('success', $request->outcome() === 'delivered'
            ? 'Order marked delivered.'
            : 'Payment issue recorded for admin follow-up.');
    }
}
