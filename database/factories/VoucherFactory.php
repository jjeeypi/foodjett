<?php

namespace Database\Factories;

use App\Models\Voucher;
use App\Models\Restaurant;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<Voucher>
 */
class VoucherFactory extends Factory
{
    public function definition(): array
    {
        $scope = $this->faker->randomElement(['platform', 'restaurant']);
        $type = $this->faker->randomElement(['percentage', 'fixed', 'free_delivery']);
        $startsAt = now()->subDays(rand(1, 30));

        return [
            'code' => strtoupper(Str::random(8)),
            'scope' => $scope,
            'restaurant_id' => $scope === 'restaurant' ? Restaurant::factory()->approved() : null,
            'type' => $type,
            'value' => match ($type) {
                'percentage' => $this->faker->randomElement([5, 10, 15, 20]),
                'fixed' => $this->faker->randomElement([30, 50, 80, 100]),
                'free_delivery' => null,
            },
            'min_order_amount' => $this->faker->randomElement([0, 100, 150, 200]),
            'usage_limit_total' => $this->faker->optional(0.7)->randomElement([50, 100, 200, 500]),
            'usage_limit_per_customer' => $this->faker->randomElement([1, 2, 3]),
            'starts_at' => $startsAt,
            'ends_at' => $startsAt->copy()->addDays(rand(7, 60)),
            'is_active' => true,
        ];
    }
}
