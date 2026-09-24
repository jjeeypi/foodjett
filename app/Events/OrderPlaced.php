<?php

namespace App\Events;

use App\Models\Order;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Support\Carbon;

class OrderPlaced implements ShouldBroadcast, ShouldDispatchAfterCommit
{
    use Dispatchable, InteractsWithSockets;

    public readonly int $id;

    public readonly string $order_number;

    public readonly int $restaurant_id;

    public readonly string $customer_name;

    public readonly string $total_amount;

    public readonly string $placed_at;

    public function __construct(Order $order)
    {
        $order->loadMissing('customer.user:id,name');

        $this->id = $order->id;
        $this->order_number = $order->order_number;
        $this->restaurant_id = $order->restaurant_id;
        $this->customer_name = $order->customer->user->name;
        $this->total_amount = (string) $order->total_amount;
        $this->placed_at = Carbon::parse($order->placed_at)->toIso8601String();
    }

    /** @return array<int, PrivateChannel> */
    public function broadcastOn(): array
    {
        return [new PrivateChannel("restaurant.{$this->restaurant_id}.orders")];
    }

    public function broadcastAs(): string
    {
        return 'order.placed';
    }

    /** @return array<string, int|string> */
    public function broadcastWith(): array
    {
        return [
            'id' => $this->id,
            'order_number' => $this->order_number,
            'restaurant_id' => $this->restaurant_id,
            'customer_name' => $this->customer_name,
            'total_amount' => $this->total_amount,
            'placed_at' => $this->placed_at,
        ];
    }
}
