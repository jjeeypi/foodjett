<?php

namespace App\Actions\Orders;

use App\Models\Order;
use App\Models\PlatformSetting;
use App\Models\RiderEarning;
use App\Services\RiderPayCalculator;

class RecordRiderEarning
{
    public function __construct(private readonly RiderPayCalculator $payCalculator) {}

    public function handle(Order $order): RiderEarning
    {
        $order->loadMissing(['restaurant', 'deliveryAddress', 'poolOffer']);
        $pay = $this->payCalculator->estimate($order);
        $thresholdMinutes = PlatformSetting::getInt(
            'rider_waiting_compensation_threshold_minutes',
            5,
        );
        $waitingMinutes = $order->rider_arrived_restaurant_at !== null
            && $order->picked_up_at !== null
                ? (int) floor($order->rider_arrived_restaurant_at->diffInMinutes($order->picked_up_at))
                : 0;
        $waitingPay = $waitingMinutes >= $thresholdMinutes
            ? PlatformSetting::getFloat('rider_waiting_compensation_amount', 10)
            : 0;
        $tipAmount = round((float) $order->tip_amount, 2);

        return RiderEarning::query()->firstOrCreate(
            ['order_id' => $order->id],
            [
                'rider_id' => $order->rider_id,
                'base_pay' => $pay['base_pay'],
                'distance_pay' => $pay['distance_pay'],
                'waiting_pay' => $waitingPay,
                'incentive_pay' => $pay['incentive_amount'],
                'tip_amount' => $tipAmount,
                'total_earned' => round(
                    $pay['base_pay']
                    + $pay['distance_pay']
                    + $waitingPay
                    + $pay['incentive_amount']
                    + $tipAmount,
                    2,
                ),
            ],
        );
    }
}
