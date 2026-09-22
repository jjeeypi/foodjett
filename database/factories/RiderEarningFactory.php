<?php

namespace Database\Factories;

use App\Models\Order;
use App\Models\Rider;
use App\Models\RiderEarning;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<RiderEarning>
 */
class RiderEarningFactory extends Factory
{
    public function definition(): array
    {
        $basePay = 40.00;
        $distancePay = round($this->faker->randomFloat(2, 10, 60), 2);
        $waitingPay = $this->faker->boolean(30) ? round($this->faker->randomFloat(2, 5, 25), 2) : 0;
        $incentivePay = 0;
        $tipAmount = $this->faker->boolean(20) ? $this->faker->randomElement([10, 20, 30, 50]) : 0;
        $totalEarned = $basePay + $distancePay + $waitingPay + $incentivePay + $tipAmount;

        return [
            'rider_id' => Rider::factory()->approved(),
            'order_id' => Order::factory(),
            'base_pay' => $basePay,
            'distance_pay' => $distancePay,
            'waiting_pay' => $waitingPay,
            'incentive_pay' => $incentivePay,
            'tip_amount' => $tipAmount,
            'total_earned' => $totalEarned,
        ];
    }
}
