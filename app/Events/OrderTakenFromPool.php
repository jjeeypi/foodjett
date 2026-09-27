<?php

namespace App\Events;

use App\Models\Order;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;

class OrderTakenFromPool implements ShouldBroadcast, ShouldDispatchAfterCommit
{
    use Dispatchable, InteractsWithSockets;

    public readonly int $id;

    public function __construct(Order $order)
    {
        $this->id = $order->id;
    }

    /** @return array<int, Channel> */
    public function broadcastOn(): array
    {
        return [new Channel('orders.pool')];
    }

    public function broadcastAs(): string
    {
        return 'order.pool.taken';
    }

    /** @return array{id: int} */
    public function broadcastWith(): array
    {
        return ['id' => $this->id];
    }
}
