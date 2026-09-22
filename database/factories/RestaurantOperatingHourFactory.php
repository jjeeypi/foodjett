<?php

namespace Database\Factories;

use App\Models\Restaurant;
use App\Models\RestaurantOperatingHour;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<RestaurantOperatingHour>
 */
class RestaurantOperatingHourFactory extends Factory
{
    public function definition(): array
    {
        $opens = $this->faker->randomElement(['07:00:00', '08:00:00', '09:00:00', '10:00:00']);
        $closes = $this->faker->randomElement(['20:00:00', '21:00:00', '22:00:00', '23:00:00']);

        return [
            'restaurant_id' => Restaurant::factory(),
            'day_of_week' => $this->faker->numberBetween(0, 6),
            'opens_at' => $opens,
            'closes_at' => $closes,
        ];
    }
}
