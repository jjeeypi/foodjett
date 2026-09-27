<?php

namespace App\Services;

use App\Models\Order;

class RiderPayCalculator
{
    public const BASE_PAY = 40.00;

    public const DISTANCE_RATE_PER_KM = 10.00;

    /** @return array{base_pay: float, distance_pay: float, incentive_amount: float, estimated_pay: float} */
    public function estimate(Order $order, ?float $deliveryDistanceKm = null): array
    {
        $order->loadMissing([
            'restaurant:id,latitude,longitude',
            'deliveryAddress:id,latitude,longitude',
            'poolOffer:id,order_id,incentive_amount',
        ]);

        $deliveryDistanceKm ??= $this->distanceInKilometres(
            (float) $order->restaurant->latitude,
            (float) $order->restaurant->longitude,
            (float) $order->deliveryAddress->latitude,
            (float) $order->deliveryAddress->longitude,
        );

        $basePay = self::BASE_PAY;
        $distancePay = round($deliveryDistanceKm * self::DISTANCE_RATE_PER_KM, 2);
        $incentiveAmount = round((float) $order->poolOffer->incentive_amount, 2);

        return [
            'base_pay' => $basePay,
            'distance_pay' => $distancePay,
            'incentive_amount' => $incentiveAmount,
            'estimated_pay' => round($basePay + $distancePay + $incentiveAmount, 2),
        ];
    }

    public function distanceInKilometres(
        float $fromLatitude,
        float $fromLongitude,
        float $toLatitude,
        float $toLongitude,
    ): float {
        $latitudeDelta = deg2rad($toLatitude - $fromLatitude);
        $longitudeDelta = deg2rad($toLongitude - $fromLongitude);
        $a = sin($latitudeDelta / 2) ** 2
            + cos(deg2rad($fromLatitude)) * cos(deg2rad($toLatitude))
            * sin($longitudeDelta / 2) ** 2;

        return round(6371 * 2 * asin(min(1, sqrt($a))), 2);
    }
}
