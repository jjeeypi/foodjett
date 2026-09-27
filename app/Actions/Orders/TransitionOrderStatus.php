<?php

namespace App\Actions\Orders;

use App\Events\OrderStatusUpdated;
use App\Models\Order;
use App\Models\OrderStatusHistory;
use Illuminate\Support\Facades\DB;

class TransitionOrderStatus
{
    /**
     * @param  array<string, mixed>  $attributes
     */
    public function handle(
        Order $order,
        string $status,
        string $changedBy,
        ?string $note = null,
        array $attributes = [],
        ?string $notice = null,
    ): Order {
        return DB::transaction(function () use (
            $order,
            $status,
            $changedBy,
            $note,
            $attributes,
            $notice,
        ): Order {
            $order->forceFill([...$attributes, 'status' => $status]);

            if (! $order->isDirty()) {
                return $order;
            }

            $order->save();

            OrderStatusHistory::query()->create([
                'order_id' => $order->id,
                'status' => $status,
                'changed_by' => $changedBy,
                'note' => $note,
            ]);

            if (
                $notice === null
                && array_key_exists('prep_extended_minutes', $attributes)
                && (int) $attributes['prep_extended_minutes'] > 0
            ) {
                $notice = 'prep_extended';
            }

            $order->refresh();
            OrderStatusUpdated::dispatch($order, $notice);

            return $order;
        });
    }
}
