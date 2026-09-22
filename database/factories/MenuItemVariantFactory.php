<?php

namespace Database\Factories;

use App\Models\MenuItem;
use App\Models\MenuItemVariant;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<MenuItemVariant>
 */
class MenuItemVariantFactory extends Factory
{
    private static array $sizes = [
        ['Small',  -20],
        ['Regular',  0],
        ['Large',   30],
        ['Solo',     0],
        ['Barkada', 80],
    ];

    public function definition(): array
    {
        [$name, $delta] = $this->faker->randomElement(self::$sizes);

        return [
            'menu_item_id' => MenuItem::factory(),
            'name' => $name,
            'price_delta' => $delta,
        ];
    }
}
