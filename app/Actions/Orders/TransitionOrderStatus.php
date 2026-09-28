<?php

namespace App\Actions\Orders;

use App\Events\OrderAvailableInPool;
use App\Events\OrderStatusUpdated;
use App\Events\OrderTakenFromPool;
use App\Models\Order;
use App\Models\OrderStatusHistory;
use App\Models\PlatformSetting;
use App\Models\RiderPoolOffer;
use App\Services\ConversationService;
use Illuminate\Support\Facades\DB;

class TransitionOrderStatus
{
    public function __construct(private readonly ConversationService $conversations) {}

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
            $previousStatus = $order->status;

            if ($status === 'finding_rider' && $previousStatus !== 'finding_rider') {
                $attributes['rider_search_started_at'] ??= now();
            }

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

            if ($status === 'finding_rider' && $previousStatus !== 'finding_rider') {
                RiderPoolOffer::query()->firstOrCreate(
                    ['order_id' => $order->id],
                    [
                        'search_radius_km' => PlatformSetting::getFloat(
                            'rider_search_initial_radius_km',
                            3,
                        ),
                        'incentive_amount' => 0,
                        'escalation_stage' => 'initial',
                        'admin_assigned' => false,
                    ],
                );
            }

            if (
                $notice === null
                && array_key_exists('prep_extended_minutes', $attributes)
                && (int) $attributes['prep_extended_minutes'] > 0
            ) {
                $notice = 'prep_extended';
            }

            $order->refresh();
            $this->conversations->handleStatusChange($order, $previousStatus);
            OrderStatusUpdated::dispatch($order, $notice);

            if ($status === 'finding_rider' && $previousStatus !== 'finding_rider') {
                OrderAvailableInPool::dispatch($order);
            } elseif ($previousStatus === 'finding_rider' && $status !== 'finding_rider') {
                OrderTakenFromPool::dispatch($order);
            }

            return $order;
        });
    }
}
