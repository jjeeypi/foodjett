<?php

namespace App\Events;

use App\Models\Order;
use App\Services\RiderPayCalculator;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

class OrderAvailableInPool implements ShouldBroadcast, ShouldDispatchAfterCommit
{
    use Dispatchable, InteractsWithSockets;

    /** @var array<string, mixed> */
    private readonly array $payload;

    public function __construct(Order $order)
    {
        $order->loadMissing([
            'restaurant:id,name,address,latitude,longitude',
            'deliveryAddress:id,address_line,latitude,longitude',
            'poolOffer:id,order_id,search_radius_km,incentive_amount',
        ]);

        $calculator = app(RiderPayCalculator::class);
        $deliveryDistance = $calculator->distanceInKilometres(
            (float) $order->restaurant->latitude,
            (float) $order->restaurant->longitude,
            (float) $order->deliveryAddress->latitude,
            (float) $order->deliveryAddress->longitude,
        );
        $pay = $calculator->estimate($order, $deliveryDistance);

        $this->payload = [
            'event_id' => Str::uuid()->toString(),
            'id' => $order->id,
            'order_number' => $order->order_number,
            'payment_method' => $order->payment_method,
            'restaurant' => [
                'name' => $order->restaurant->name,
                'address' => $order->restaurant->address,
                'latitude' => (float) $order->restaurant->latitude,
                'longitude' => (float) $order->restaurant->longitude,
            ],
            'delivery_distance_km' => $deliveryDistance,
            'search_radius_km' => (float) $order->poolOffer->search_radius_km,
            ...$pay,
            'estimated_ready_at' => $order->estimated_ready_at === null
                ? null
                : Carbon::parse($order->estimated_ready_at)->toIso8601String(),
        ];
    }

    /** @return array<int, Channel> */
    public function broadcastOn(): array
    {
        return [new Channel('orders.pool')];
    }

    public function broadcastAs(): string
    {
        return 'order.pool.available';
    }

    /** @return array<string, mixed> */
    public function broadcastWith(): array
    {
        return $this->payload;
    }
}
