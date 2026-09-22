<?php

namespace Database\Factories;

use App\Models\MenuItem;
use App\Models\MenuItemAddon;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<MenuItemAddon>
 */
class MenuItemAddonFactory extends Factory
{
    /** @var list<array{string, int}> */
    private static array $addons = [
        ['Extra Rice',       25],
        ['Extra Sauce',      15],
        ['Extra Gravy',      15],
        ['Extra Egg',        20],
        ['Add Cheese',       20],
        ['Extra Chili',      10],
        ['Extra Veggie',     20],
        ['Add Lumpiang Sariwa', 35],
        ['Buko Juice Add-on',   50],
        ['Add Softdrinks',      40],
    ];

    public function definition(): array
    {
        [$name, $price] = $this->faker->randomElement(self::$addons);

        return [
            'menu_item_id' => MenuItem::factory(),
            'name' => $name,
            'price' => $price,
            'is_available' => true,
        ];
    }
}
