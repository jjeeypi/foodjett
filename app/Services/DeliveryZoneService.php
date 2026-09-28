<?php

namespace App\Services;

use App\Models\DeliveryZone;

class DeliveryZoneService
{
    public function containing(float $latitude, float $longitude): ?DeliveryZone
    {
        return DeliveryZone::query()
            ->where('is_active', true)
            ->get()
            ->first(function (DeliveryZone $zone) use ($latitude, $longitude): bool {
                $geometry = $zone->getAttribute('polygon');

                if (is_string($geometry)) {
                    $geometry = json_decode($geometry, true);
                }

                return is_array($geometry)
                    && $this->contains($geometry, $latitude, $longitude);
            });
    }

    /** @param array<string, mixed> $geometry */
    private function contains(array $geometry, float $latitude, float $longitude): bool
    {
        if (($geometry['type'] ?? null) === 'circle') {
            $center = $geometry['center'] ?? null;
            $radius = $geometry['radius_km'] ?? null;

            return is_array($center)
                && isset($center[0], $center[1])
                && is_numeric($center[0])
                && is_numeric($center[1])
                && is_numeric($radius)
                && $this->distance(
                    $latitude,
                    $longitude,
                    (float) $center[0],
                    (float) $center[1],
                ) <= (float) $radius;
        }

        $coordinates = $geometry['coordinates'] ?? null;

        if (($geometry['type'] ?? null) === 'Polygon' && is_array($coordinates)) {
            return $this->insidePolygon($coordinates, $latitude, $longitude);
        }

        if (($geometry['type'] ?? null) === 'MultiPolygon' && is_array($coordinates)) {
            foreach ($coordinates as $polygon) {
                if (is_array($polygon) && $this->insidePolygon($polygon, $latitude, $longitude)) {
                    return true;
                }
            }
        }

        return false;
    }

    /** @param array<int, mixed> $rings */
    private function insidePolygon(array $rings, float $latitude, float $longitude): bool
    {
        $outer = $rings[0] ?? null;
        if (! is_array($outer) || ! $this->insideRing($outer, $latitude, $longitude)) {
            return false;
        }

        foreach (array_slice($rings, 1) as $hole) {
            if (is_array($hole) && $this->insideRing($hole, $latitude, $longitude)) {
                return false;
            }
        }

        return true;
    }

    /** @param array<int, mixed> $points */
    private function insideRing(array $points, float $latitude, float $longitude): bool
    {
        $inside = false;
        $count = count($points);

        for ($index = 0, $previous = $count - 1; $index < $count; $previous = $index++) {
            $currentPoint = $points[$index] ?? null;
            $previousPoint = $points[$previous] ?? null;

            if (! is_array($currentPoint) || ! is_array($previousPoint)
                || ! isset($currentPoint[0], $currentPoint[1], $previousPoint[0], $previousPoint[1])) {
                continue;
            }

            $currentLongitude = (float) $currentPoint[0];
            $currentLatitude = (float) $currentPoint[1];
            $previousLongitude = (float) $previousPoint[0];
            $previousLatitude = (float) $previousPoint[1];
            $crosses = ($currentLatitude > $latitude) !== ($previousLatitude > $latitude)
                && $longitude < ($previousLongitude - $currentLongitude)
                    * ($latitude - $currentLatitude)
                    / (($previousLatitude - $currentLatitude) ?: PHP_FLOAT_EPSILON)
                    + $currentLongitude;

            if ($crosses) {
                $inside = ! $inside;
            }
        }

        return $inside;
    }

    private function distance(float $fromLat, float $fromLng, float $toLat, float $toLng): float
    {
        $latitudeDelta = deg2rad($toLat - $fromLat);
        $longitudeDelta = deg2rad($toLng - $fromLng);
        $a = sin($latitudeDelta / 2) ** 2
            + cos(deg2rad($fromLat)) * cos(deg2rad($toLat))
            * sin($longitudeDelta / 2) ** 2;

        return 6371 * 2 * asin(min(1, sqrt($a)));
    }
}
