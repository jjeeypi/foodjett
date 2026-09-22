<?php

namespace Database\Factories;

use App\Models\MenuCategory;
use App\Models\Restaurant;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<MenuCategory>
 */
class MenuCategoryFactory extends Factory
{
    /** @var list<string> */
    private static array $categories = [
        'Rice Meals', 'Silog Meals', 'Soups & Stews', 'Grilled & BBQ',
        'Seafood', 'Snacks & Merienda', 'Drinks', 'Desserts',
        'Vegetable Dishes', 'Noodles & Pasta', 'Sandwiches & Burgers', 'Combos',
    ];

    public function definition(): array
    {
        return [
            'restaurant_id' => Restaurant::factory(),
            'name' => $this->faker->unique()->randomElement(self::$categories),
            'sort_order' => $this->faker->numberBetween(0, 10),
        ];
    }
}
