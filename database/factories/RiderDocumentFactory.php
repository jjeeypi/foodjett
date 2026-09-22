<?php

namespace Database\Factories;

use App\Models\Rider;
use App\Models\RiderDocument;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<RiderDocument>
 */
class RiderDocumentFactory extends Factory
{
    private static array $types = ['drivers_license', 'vehicle_registration', 'valid_id', 'police_clearance'];

    public function definition(): array
    {
        $type = $this->faker->randomElement(self::$types);
        return [
            'rider_id' => Rider::factory(),
            'type' => $type,
            'file_path' => 'documents/riders/' . $type . '_' . $this->faker->uuid() . '.jpg',
            'status' => $this->faker->randomElement(['pending', 'approved', 'approved']),
        ];
    }
}
