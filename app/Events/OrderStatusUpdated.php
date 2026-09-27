<?php

namespace App\Events;

use App\Models\Order;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class OrderStatusUpdated implements ShouldBroadcast, ShouldDispatchAfterCommit
{
    use Dispatchable, InteractsWithSockets;

    public readonly string $event_id;

    public readonly int $id;

    public readonly string $order_number;

    public readonly string $status;

    public readonly ?string $estimated_ready_at;

    public readonly ?int $prep_extended_minutes;

    /** @var array{name: string, photo_url: string|null, vehicle_type: string}|null */
    public readonly ?array $rider;

    public readonly ?string $escalation_stage;

    public readonly ?string $notice;

    public readonly ?string $cancellation_reason;

    public readonly ?string $rejection_reason;

    public readonly string $updated_at;

    public function __construct(Order $order, ?string $notice = null)
    {
        $order->loadMissing([
            'rider.user:id,name,avatar_path',
            'poolOffer:id,order_id,escalation_stage',
        ]);

        $rider = $order->rider;

        $this->event_id = Str::uuid()->toString();
        $this->id = $order->id;
        $this->order_number = $order->order_number;
        $this->status = $order->status;
        $this->estimated_ready_at = $order->estimated_ready_at === null
            ? null
            : Carbon::parse($order->estimated_ready_at)->toIso8601String();
        $this->prep_extended_minutes = $order->prep_extended_minutes;
        $this->rider = $rider === null ? null : [
            'name' => $rider->user->name,
            'photo_url' => $rider->user->avatar_path === null
                ? null
                : Storage::disk('public')->url($rider->user->avatar_path),
            'vehicle_type' => $rider->vehicle_type,
        ];
        $this->escalation_stage = $order->poolOffer?->escalation_stage;
        $this->notice = $notice;
        $this->cancellation_reason = $order->cancellation_reason;
        $this->rejection_reason = $order->rejection_reason;
        $this->updated_at = Carbon::parse($order->updated_at)->toIso8601String();
    }

    /** @return array<int, PrivateChannel> */
    public function broadcastOn(): array
    {
        return [new PrivateChannel("order.{$this->id}.status")];
    }

    public function broadcastAs(): string
    {
        return 'order.status.updated';
    }

    /** @return array<string, mixed> */
    public function broadcastWith(): array
    {
        return [
            'event_id' => $this->event_id,
            'id' => $this->id,
            'order_number' => $this->order_number,
            'status' => $this->status,
            'estimated_ready_at' => $this->estimated_ready_at,
            'prep_extended_minutes' => $this->prep_extended_minutes,
            'rider' => $this->rider,
            'escalation_stage' => $this->escalation_stage,
            'notice' => $this->notice,
            'cancellation_reason' => $this->cancellation_reason,
            'rejection_reason' => $this->rejection_reason,
            'updated_at' => $this->updated_at,
        ];
    }
}
