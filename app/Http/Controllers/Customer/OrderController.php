<?php

namespace App\Http\Controllers\Customer;

use App\Actions\Orders\TransitionOrderStatus;
use App\Actions\Payments\RecordPaymentStatus;
use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\OrderStatusHistory;
use App\Models\Payment;
use App\Models\RiderPoolOffer;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class OrderController extends Controller
{
    public function show(Order $order): Response
    {
        Gate::authorize('view', $order);

        $order->load([
            'restaurant:id,name',
            'rider.user:id,name,avatar_path',
            'poolOffer:id,order_id,escalation_stage',
            'statusHistory' => fn ($query) => $query->oldest('created_at'),
        ]);

        return Inertia::render('customer/orders/track', [
            'order' => [
                'id' => $order->id,
                'order_number' => $order->order_number,
                'restaurant_name' => $order->restaurant->name,
                'status' => $order->status,
                'payment_method' => $order->payment_method,
                'placed_at' => Carbon::parse($order->placed_at)->toIso8601String(),
                'estimated_ready_at' => $order->estimated_ready_at === null
                    ? null
                    : Carbon::parse($order->estimated_ready_at)->toIso8601String(),
                'prep_extended_minutes' => $order->prep_extended_minutes,
                'rider' => $order->rider === null ? null : [
                    'name' => $order->rider->user->name,
                    'photo_url' => $order->rider->user->avatar_path === null
                        ? null
                        : Storage::disk('public')->url($order->rider->user->avatar_path),
                    'vehicle_type' => $order->rider->vehicle_type,
                ],
                'escalation_stage' => $order->poolOffer?->escalation_stage,
                'cancellation_reason' => $order->cancellation_reason,
                'rejection_reason' => $order->rejection_reason,
            ],
            'history' => $order->statusHistory->map(fn (OrderStatusHistory $entry): array => [
                'status' => $entry->status,
                'note' => $entry->note,
                'created_at' => Carbon::parse($entry->created_at)->toIso8601String(),
            ])->values(),
        ]);
    }

    public function cancel(
        Order $order,
        TransitionOrderStatus $transition,
        RecordPaymentStatus $paymentStatus,
    ): RedirectResponse {
        Gate::authorize('cancel', $order);

        DB::transaction(function () use ($order, $transition, $paymentStatus): void {
            $lockedOrder = Order::query()->lockForUpdate()->findOrFail($order->id);
            $offer = RiderPoolOffer::query()
                ->where('order_id', $lockedOrder->id)
                ->lockForUpdate()
                ->first();

            if (
                $lockedOrder->status !== 'finding_rider'
                || $offer?->escalation_stage !== 'customer_notified'
            ) {
                throw ValidationException::withMessages([
                    'order' => 'This order is not currently eligible for customer cancellation.',
                ]);
            }

            $transition->handle(
                $lockedOrder,
                'cancelled_by_customer',
                'customer',
                'Customer cancelled after the delayed rider search notification.',
                [
                    'cancellation_reason' => 'Customer cancelled because a rider could not be found in time.',
                    'cancelled_by' => 'customer',
                ],
            );

            $payment = Payment::query()
                ->where('order_id', $lockedOrder->id)
                ->lockForUpdate()
                ->first();

            if ($payment === null) {
                return;
            }

            if (in_array($payment->status, ['paid', 'partially_refunded'], true)) {
                $payment->forceFill([
                    'refunded_amount' => $payment->amount,
                    'refunded_at' => now(),
                ])->save();
                $paymentStatus->transition(
                    $payment,
                    'refunded',
                    'customer',
                    'Full refund recorded after cancellation during delayed rider search.',
                );
            } elseif ($payment->status === 'pending' && $payment->method === 'cod') {
                $paymentStatus->transition(
                    $payment,
                    'failed',
                    'customer',
                    'COD order cancelled before cash collection.',
                );
            }
        });

        return to_route('customer.orders.track', $order)
            ->with('success', 'Order cancelled. Any captured payment has been marked for a full refund.');
    }
}
