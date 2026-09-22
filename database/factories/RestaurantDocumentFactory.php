<?php

namespace Database\Factories;

use App\Models\Restaurant;
use App\Models\RestaurantDocument;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<RestaurantDocument>
 */
class RestaurantDocumentFactory extends Factory
{
    /** @var list<string> */
    private static array $types = ['business_permit', 'food_safety_permit', 'owner_id'];

    public function definition(): array
    {
        $type = $this->faker->randomElement(self::$types);

        return [
            'restaurant_id' => Restaurant::factory(),
            'type' => $type,
            'file_path' => 'documents/restaurants/'.$type.'_'.$this->faker->uuid().'.jpg',
            'status' => $this->faker->randomElement(['pending', 'approved', 'approved']),
        ];
    }
}
