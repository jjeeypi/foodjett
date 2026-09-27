<?php

namespace App\Http\Controllers;

use App\Actions\Orders\TransitionOrderStatus;
use App\Actions\Payments\RecordPaymentStatus;
use App\Http\Requests\CompleteRiderOrderRequest;
use App\Models\Order;
use App\Models\Payment;
use App\Models\Rider;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class RiderOrderController extends Controller
{
    public function complete(
        CompleteRiderOrderRequest $request,
        Order $order,
        RecordPaymentStatus $paymentStatus,
        TransitionOrderStatus $transition,
    ): RedirectResponse {
        DB::transaction(function () use ($request, $order, $paymentStatus, $transition): void {
            $lockedOrder = Order::query()->lockForUpdate()->findOrFail($order->id);
            $rider = Rider::query()->lockForUpdate()->findOrFail((int) $lockedOrder->rider_id);

            if (! in_array($lockedOrder->status, [
                'rider_assigned', 'at_restaurant', 'picked_up', 'on_the_way', 'arrived',
            ], true)) {
                throw ValidationException::withMessages(['outcome' => 'This order can no longer be completed.']);
            }

            if ($request->outcome() === 'failed_delivery') {
                $transition->handle(
                    $lockedOrder,
                    'failed_delivery',
                    'rider',
                    $request->cancellationReason(),
                    [
                        'cancellation_reason' => $request->cancellationReason(),
                        'cancelled_by' => 'rider',
                    ],
                );

                return;
            }

            if ($lockedOrder->payment_method === 'cod' && ! $request->cashCollected()) {
                throw ValidationException::withMessages([
                    'cash_collected' => 'Confirm that cash was collected before marking this COD order delivered.',
                ]);
            }

            $transition->handle(
                $lockedOrder,
                'delivered',
                'rider',
                $lockedOrder->payment_method === 'cod' ? 'Cash collected on delivery.' : 'Order delivered.',
                ['delivered_at' => now()],
            );

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
