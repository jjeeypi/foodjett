<?php

namespace Database\Factories;

use App\Models\Restaurant;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<Restaurant>
 */
class RestaurantFactory extends Factory
{
    private static array $names = [
        "Gabby's Bistro", 'Sans Rival Cakes & Pastries', "Lab-as Seafood Grill",
        'El Amigo Restaurant', 'Why Not Restaurant', 'Chin Loong Restaurant',
        "Shawarma Snack Center", "Hayahay Treehouse", 'Paypay Restaurant',
        "Brocolight Healthy Eats", "Kapehan sa Boulevard", "RD Pawnshop Canteen",
        "Silliman Eats", "Rizal Blvd Grill", "Pepita's Kitchen",
    ];

    private static array $cuisines = [
        'Filipino', 'Seafood', 'Chinese', 'Fast Food', 'Healthy', 'Cafe', 'Grill & BBQ',
    ];

    private static array $streets = [
        'Perdices St', 'Locsin St', 'Real St', 'Rizal Blvd', 'Flores Ave',
        'Cervantes St', 'Sta. Catalina St', 'Dr. V. Locsin St', 'Campanario St',
        'EJ Blanco Dr', 'Hibbard Ave', 'Colon Extension',
    ];

    private static array $barangays = [
        'Bantayan', 'Piapi', 'Looc', 'Taclobo', 'Bagacay', 'Daro', 'Calindagan',
        'Junob', 'Tinago', 'Cadawinonan', 'Poblacion', 'Camanjac',
    ];

    public function definition(): array
    {
        $name = $this->faker->unique()->randomElement(self::$names);

        return [
            'user_id' => User::factory()->restaurantOwner(),
            'name' => $name,
            'slug' => Str::slug($name) . '-' . $this->faker->numberBetween(1, 999),
            'description' => $this->faker->sentence(10),
            'logo_path' => null,
            'cover_photo_path' => null,
            'cuisine_type' => $this->faker->randomElement(self::$cuisines),
            'address' => $this->faker->randomElement(self::$streets)
                . ', Brgy. ' . $this->faker->randomElement(self::$barangays)
                . ', Dumaguete City, Negros Oriental',
            'latitude' => $this->faker->randomFloat(7, 9.3000, 9.3200),
            'longitude' => $this->faker->randomFloat(7, 123.2900, 123.3100),
            'default_prep_time_minutes' => $this->faker->randomElement([10, 15, 20, 25, 30]),
            'min_order_amount' => $this->faker->randomElement([50, 80, 100, 150, 200]),
            'commission_rate' => 15.00,
            'approval_status' => $this->faker->randomElement([
                'approved', 'approved', 'approved', 'approved',
                'pending', 'rejected',
            ]),
            'rejection_reason' => null,
            'operating_status' => $this->faker->randomElement(['open', 'closed']),
            'payout_method' => $this->faker->randomElement(['bank', 'ewallet']),
            'payout_account_details' => ['account_name' => $name, 'account_number' => $this->faker->numerify('###########')],
        ];
    }

    public function approved(): static
    {
        return $this->state(fn () => [
            'approval_status' => 'approved',
            'operating_status' => 'open',
        ]);
    }
}
