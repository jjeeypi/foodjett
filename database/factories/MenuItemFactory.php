<?php

namespace Database\Factories;

use App\Models\MenuCategory;
use App\Models\MenuItem;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<MenuItem>
 */
class MenuItemFactory extends Factory
{
    // Filipino dishes grouped loosely by category
    /** @var list<array{string, int}> */
    private static array $items = [
        // Rice Meals
        ['Adobong Manok', 130], ['Sinigang na Baboy', 180], ['Tinolang Manok', 150],
        ['Lechon Kawali', 160], ['Chicken Inasal', 120], ['Bistek Tagalog', 150],
        ['Kare-Kare', 200], ['Pinakbet', 120], ['Bicol Express', 140],
        // Silog
        ['Tapsilog', 120], ['Longsilog', 110], ['Tocilog', 110],
        ['Bangsilog', 130], ['Chicksilog', 115],
        // Soups
        ['Bulalo', 280], ['Batchoy', 90], ['Lomi', 95], ['Arroz Caldo', 90],
        ['La Paz Batchoy', 95], ['Sinigang na Hipon', 220],
        // Grilled & BBQ
        ['Pork BBQ', 85], ['Chicken BBQ', 95], ['Liempo', 160],
        ['Inihaw na Bangus', 180], ['Pork Chops', 155],
        // Seafood
        ['Sinuglaw', 200], ['Kinilaw na Isda', 180], ['Inihaw na Pusit', 220],
        ['Luto-ang Hipon', 250], ['Crispy Tilapia', 165],
        // Snacks
        ['Lumpia Shanghai', 120], ['Pork Chicharon', 80],
        ['Kwek-Kwek', 80], ['Dynamite Lumpia', 90], ['Calamares', 130],
        // Drinks
        ['Buko Juice', 60], ['Gulaman', 45], ['Sago\'t Gulaman', 55],
        ['Softdrinks (Bote)', 45], ['Bottled Water', 35], ['Mango Shake', 85],
        ['Cucumber Lemon Juice', 75],
        // Desserts
        ['Halo-halo', 85], ['Leche Flan', 80], ['Mais Con Hielo', 75],
        ['Sans Rival Slice', 120], ['Buko Pandan', 80],
    ];

    public function definition(): array
    {
        [$name, $price] = $this->faker->randomElement(self::$items);

        return [
            'menu_category_id' => MenuCategory::factory(),
            'name' => $name,
            'description' => $this->faker->optional(0.6)->sentence(8),
            'photo_path' => null,
            'base_price' => $price,
            'is_available' => $this->faker->boolean(85),
            'available_from' => null,
            'available_until' => null,
            'is_featured' => $this->faker->boolean(20),
        ];
    }

    public function available(): static
    {
        return $this->state(fn () => ['is_available' => true]);
    }
}
