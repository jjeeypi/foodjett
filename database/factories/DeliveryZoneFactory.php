<?php

namespace Database\Factories;

use App\Models\DeliveryZone;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<DeliveryZone>
 */
class DeliveryZoneFactory extends Factory
{
    // Dumaguete City zones with approximate center coordinates
    /** @var list<array{name: string, center: array{float, float}, radius: float}> */
    private static array $zones = [
        [
            'name' => 'Bantayan / Downtown',
            'center' => [9.3076, 123.3080],
            'radius' => 0.015, // ~1.5 km
        ],
        [
            'name' => 'Piapi / Boulevard',
            'center' => [9.2990, 123.3085],
            'radius' => 0.012,
        ],
        [
            'name' => 'Looc / Silliman Area',
            'center' => [9.3110, 123.3060],
            'radius' => 0.013,
        ],
        [
            'name' => 'Taclobo / Market Area',
            'center' => [9.3155, 123.3075],
            'radius' => 0.014,
        ],
        [
            'name' => 'Bagacay / Daro',
            'center' => [9.3200, 123.3000],
            'radius' => 0.016,
        ],
    ];

    /**
     * Build a simple square bounding-box polygon from center + radius.
     *
     * @param  array{float, float}  $center
     * @return array{type: string, coordinates: list<list<array{float, float}>>}
     */
    private static function makePolygon(array $center, float $r): array
    {
        [$lat, $lng] = $center;

        return [
            'type' => 'Polygon',
            'coordinates' => [[
                [$lng - $r, $lat - $r],
                [$lng + $r, $lat - $r],
                [$lng + $r, $lat + $r],
                [$lng - $r, $lat + $r],
                [$lng - $r, $lat - $r],
            ]],
        ];
    }

    public function definition(): array
    {
        $zone = $this->faker->randomElement(self::$zones);

        return [
            'name' => $zone['name'],
            'polygon' => self::makePolygon($zone['center'], $zone['radius']),
            'is_active' => true,
        ];
    }

    /**
     * Create all 5 Dumaguete zones from the static list.
     *
     * @return list<array<string, mixed>>
     */
    public static function allZones(): array
    {
        return array_map(fn ($zone) => [
            'name' => $zone['name'],
            'polygon' => json_encode(self::makePolygon($zone['center'], $zone['radius'])),
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ], self::$zones);
    }
}
