<?php

namespace Database\Factories;

use App\Models\Customer;
use App\Models\CustomerAddress;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<CustomerAddress>
 */
class CustomerAddressFactory extends Factory
{
    /** @var list<string> */
    private static array $labels = ['Home', 'Work', 'School', 'Other'];

    /** @var list<string> */
    private static array $streets = [
        'Perdices St', 'Locsin St', 'Real St', 'Rizal Blvd', 'Flores Ave',
        'Cervantes St', 'Sta. Catalina St', 'Dr. V. Locsin St', 'Campanario St',
        'EJ Blanco Dr', 'Hibbard Ave', 'Colon Extension', 'San Jose St', 'Silliman Ave',
    ];

    /** @var list<string> */
    private static array $barangays = [
        'Bantayan', 'Piapi', 'Looc', 'Taclobo', 'Bagacay', 'Daro', 'Calindagan',
        'Junob', 'Tinago', 'Cadawinonan', 'Poblacion', 'Camanjac', 'Bagakay',
    ];

    /** @var list<string|null> */
    private static array $landmarks = [
        'Near Silliman University Gate', 'Across Lee Plaza', 'Near Robinson\'s Dumaguete',
        'Near Dumaguete Cathedral', 'Near Public Market', 'Near Quezon Park',
        'Near Colon St Terminal', 'Beside ACM Drugstore', 'Near Don Bosco School',
        'Near Negros Oriental Capitol', null, null,
    ];

    public function definition(): array
    {
        $barangay = $this->faker->randomElement(self::$barangays);
        $street = $this->faker->randomElement(self::$streets);

        return [
            'customer_id' => Customer::factory(),
            'label' => $this->faker->randomElement(self::$labels),
            'address_line' => $this->faker->buildingNumber().' '.$street.', Brgy. '.$barangay.', Dumaguete City',
            'landmark' => $this->faker->randomElement(self::$landmarks),
            'delivery_instructions' => $this->faker->optional(0.3)->sentence(),
            'latitude' => $this->faker->randomFloat(7, 9.3000, 9.3200),
            'longitude' => $this->faker->randomFloat(7, 123.2900, 123.3100),
            'is_default' => false,
        ];
    }

    public function default(): static
    {
        return $this->state(fn () => ['is_default' => true]);
    }
}
