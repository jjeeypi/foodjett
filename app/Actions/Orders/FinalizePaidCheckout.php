<?php

namespace App\Actions\Orders;

use App\Data\OrderCheckoutData;
use App\Models\Order;
use App\Models\PendingCheckout;
use Illuminate\Support\Facades\DB;

class FinalizePaidCheckout
{
    public function __construct(private CreateOrderFromCart $createOrder) {}

    public function handle(PendingCheckout $pendingCheckout, string $transactionReference): Order
    {
        return DB::transaction(function () use ($pendingCheckout, $transactionReference): Order {
            $lockedCheckout = PendingCheckout::query()->lockForUpdate()->findOrFail($pendingCheckout->id);

            if ($lockedCheckout->order_id !== null) {
                return Order::query()->findOrFail($lockedCheckout->order_id);
            }

            $order = $this->createOrder->handle(
                OrderCheckoutData::fromArray($lockedCheckout->checkoutPayload()),
                'paid',
                $transactionReference,
            );

            $lockedCheckout->forceFill([
                'status' => 'paid',
                'order_id' => $order->id,
            ])->save();

            return $order;
        });
    }
}
