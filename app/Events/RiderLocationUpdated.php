<?php

namespace App\Events;

use App\Models\Order;
use App\Models\Rider;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Support\Carbon;

class RiderLocationUpdated implements ShouldBroadcast, ShouldDispatchAfterCommit
{
    use Dispatchable, InteractsWithSockets;

    public readonly int $order_id;

    public readonly float $latitude;

    public readonly float $longitude;

    public readonly string $timestamp;

    public function __construct(Order $order, Rider $rider)
    {
        $this->order_id = $order->id;
        $this->latitude = (float) $rider->current_latitude;
        $this->longitude = (float) $rider->current_longitude;
        $this->timestamp = Carbon::parse($rider->last_location_at)->toIso8601String();
    }

    /** @return array<int, PrivateChannel> */
    public function broadcastOn(): array
    {
        return [new PrivateChannel("order.{$this->order_id}.status")];
    }

    public function broadcastAs(): string
    {
        return 'rider.location.updated';
    }

    /** @return array{order_id: int, latitude: float, longitude: float, timestamp: string} */
    public function broadcastWith(): array
    {
        return [
            'order_id' => $this->order_id,
            'latitude' => $this->latitude,
            'longitude' => $this->longitude,
            'timestamp' => $this->timestamp,
        ];
    }
}
