<?php

namespace App\Services;

use App\Models\Customer;
use App\Models\CustomerAddress;
use App\Models\MenuItem;
use App\Models\Restaurant;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class CustomerCatalog
{
    public const TIMEZONE = 'Asia/Manila';

    public function now(): CarbonImmutable
    {
        return CarbonImmutable::now(self::TIMEZONE);
    }

    public function defaultAddress(Customer $customer): ?CustomerAddress
    {
        return $customer->addresses()
            ->orderByDesc('is_default')
            ->latest('id')
            ->first(['id', 'label', 'address_line', 'latitude', 'longitude', 'is_default']);
    }

    /**
     * @template TModel of Model
     *
     * @param  Builder<TModel>  $query
     * @return Builder<TModel>
     */
    public function constrainOpenRestaurants(
        Builder $query,
        ?CarbonInterface $now = null,
        string $table = 'restaurants',
    ): Builder {
        $now ??= $this->now();
        $today = $now->dayOfWeek;
        $yesterday = ($today + 6) % 7;
        $time = $now->format('H:i:s');

        return $query
            ->where("{$table}.operating_status", 'open')
            ->where(function (Builder $query) use ($table, $today, $yesterday, $time): void {
                $query->whereNotExists(fn ($hours) => $hours
                    ->selectRaw('1')
                    ->from('restaurant_operating_hours')
                    ->whereColumn('restaurant_operating_hours.restaurant_id', "{$table}.id"))
                    ->orWhereExists(fn ($hours) => $hours
                        ->selectRaw('1')
                        ->from('restaurant_operating_hours')
                        ->whereColumn('restaurant_operating_hours.restaurant_id', "{$table}.id")
                        ->where(function ($hours) use ($today, $yesterday, $time): void {
                            $hours
                                ->where(function ($window) use ($today, $time): void {
                                    $window->where('day_of_week', $today)
                                        ->whereColumn('opens_at', '<=', 'closes_at')
                                        ->where('opens_at', '<=', $time)
                                        ->where('closes_at', '>=', $time);
                                })
                                ->orWhere(function ($window) use ($today, $time): void {
                                    $window->where('day_of_week', $today)
                                        ->whereColumn('opens_at', '>', 'closes_at')
                                        ->where('opens_at', '<=', $time);
                                })
                                ->orWhere(function ($window) use ($yesterday, $time): void {
                                    $window->where('day_of_week', $yesterday)
                                        ->whereColumn('opens_at', '>', 'closes_at')
                                        ->where('closes_at', '>=', $time);
                                });
                        }));
            });
    }

    /**
     * @template TModel of Model
     *
     * @param  Builder<TModel>  $query
     * @return Builder<TModel>
     */
    public function constrainAvailableItems(Builder $query, ?CarbonInterface $now = null): Builder
    {
        $time = ($now ?? $this->now())->format('H:i:s');

        return $query
            ->where('menu_items.is_available', true)
            ->where(function (Builder $query) use ($time): void {
                $query
                    ->where(function (Builder $window): void {
                        $window->whereNull('menu_items.available_from')
                            ->whereNull('menu_items.available_until');
                    })
                    ->orWhere(function (Builder $window) use ($time): void {
                        $window->whereNotNull('menu_items.available_from')
                            ->whereNull('menu_items.available_until')
                            ->where('menu_items.available_from', '<=', $time);
                    })
                    ->orWhere(function (Builder $window) use ($time): void {
                        $window->whereNull('menu_items.available_from')
                            ->whereNotNull('menu_items.available_until')
                            ->where('menu_items.available_until', '>=', $time);
                    })
                    ->orWhere(function (Builder $window) use ($time): void {
                        $window->whereNotNull('menu_items.available_from')
                            ->whereNotNull('menu_items.available_until')
                            ->whereColumn('menu_items.available_from', '<=', 'menu_items.available_until')
                            ->where('menu_items.available_from', '<=', $time)
                            ->where('menu_items.available_until', '>=', $time);
                    })
                    ->orWhere(function (Builder $window) use ($time): void {
                        $window->whereNotNull('menu_items.available_from')
                            ->whereNotNull('menu_items.available_until')
                            ->whereColumn('menu_items.available_from', '>', 'menu_items.available_until')
                            ->where(function (Builder $overnight) use ($time): void {
                                $overnight->where('menu_items.available_from', '<=', $time)
                                    ->orWhere('menu_items.available_until', '>=', $time);
                            });
                    });
            });
    }

    public function isRestaurantOpen(Restaurant $restaurant, ?CarbonInterface $now = null): bool
    {
        if ($restaurant->operating_status !== 'open') {
            return false;
        }

        $restaurant->loadMissing('operatingHours');
        if ($restaurant->operatingHours->isEmpty()) {
            return true;
        }

        $now ??= $this->now();
        $today = $now->dayOfWeek;
        $yesterday = ($today + 6) % 7;
        $time = $now->format('H:i:s');

        return $restaurant->operatingHours->contains(function ($hours) use ($today, $yesterday, $time): bool {
            $opensAt = (string) $hours->opens_at;
            $closesAt = (string) $hours->closes_at;
            $overnight = $opensAt > $closesAt;

            if ((int) $hours->day_of_week === $today) {
                return $overnight
                    ? $time >= $opensAt
                    : $time >= $opensAt && $time <= $closesAt;
            }

            return $overnight
                && (int) $hours->day_of_week === $yesterday
                && $time <= $closesAt;
        });
    }

    public function isItemAvailable(MenuItem $item, ?CarbonInterface $now = null): bool
    {
        if (! $item->is_available) {
            return false;
        }

        $from = $item->available_from;
        $until = $item->available_until;
        $time = ($now ?? $this->now())->format('H:i:s');

        if ($from === null && $until === null) {
            return true;
        }

        if ($from !== null && $until === null) {
            return $time >= $from;
        }

        if ($from === null) {
            return $time <= $until;
        }

        return $from <= $until
            ? $time >= $from && $time <= $until
            : $time >= $from || $time <= $until;
    }

    /** @return Builder<MenuItem> */
    public function availableFoodQuery(bool $onlyOpenRestaurants = true): Builder
    {
        $now = $this->now();
        $query = MenuItem::query()
            ->join('menu_categories', 'menu_categories.id', '=', 'menu_items.menu_category_id')
            ->join('restaurants', 'restaurants.id', '=', 'menu_categories.restaurant_id')
            ->select('menu_items.*')
            ->where('restaurants.approval_status', 'approved')
            ->with([
                'variants',
                'addons',
                'category:id,restaurant_id,name',
                'category.restaurant' => fn ($query) => $query
                    ->with('operatingHours')
                    ->withAvg('reviews', 'rating')
                    ->withCount('reviews'),
            ]);

        $this->constrainAvailableItems($query, $now);

        if ($onlyOpenRestaurants) {
            $this->constrainOpenRestaurants($query, $now);
        }

        return $query;
    }

    /**
     * @param  Builder<Restaurant>  $query
     * @return Collection<int, Restaurant>
     */
    public function restaurantsByDistance(Builder $query, CustomerAddress $address, int $limit): Collection
    {
        $latitude = (float) $address->latitude;
        $longitude = (float) $address->longitude;

        if (in_array(DB::connection()->getDriverName(), ['mysql', 'mariadb'], true)) {
            return $this->selectRestaurantDistance($query->select('restaurants.*'), $latitude, $longitude)
                ->orderBy('distance_km')
                ->limit($limit)
                ->get();
        }

        return $query
            ->get()
            ->each(fn (Restaurant $restaurant) => $restaurant->setAttribute(
                'distance_km',
                $this->distanceInKilometres(
                    $latitude,
                    $longitude,
                    (float) $restaurant->latitude,
                    (float) $restaurant->longitude,
                ),
            ))
            ->sortBy('distance_km')
            ->take($limit)
            ->values();
    }

    /**
     * @template TModel of Model
     *
     * @param  Builder<TModel>  $query
     * @return Builder<TModel>
     */
    public function selectRestaurantDistance(Builder $query, float $latitude, float $longitude): Builder
    {
        $distanceSql = <<<'SQL'
            6371 * 2 * ASIN(LEAST(1, SQRT(
                POWER(SIN(RADIANS(restaurants.latitude - ?) / 2), 2) +
                COS(RADIANS(?)) * COS(RADIANS(restaurants.latitude)) *
                POWER(SIN(RADIANS(restaurants.longitude - ?) / 2), 2)
            )))
            SQL;

        return $query->selectRaw("{$distanceSql} AS distance_km", [
            $latitude,
            $latitude,
            $longitude,
        ]);
    }

    public function distanceInKilometres(float $fromLat, float $fromLng, float $toLat, float $toLng): float
    {
        $latitudeDelta = deg2rad($toLat - $fromLat);
        $longitudeDelta = deg2rad($toLng - $fromLng);
        $a = sin($latitudeDelta / 2) ** 2
            + cos(deg2rad($fromLat)) * cos(deg2rad($toLat))
            * sin($longitudeDelta / 2) ** 2;

        return 6371 * 2 * asin(min(1, sqrt($a)));
    }

    /** @return array<string, mixed> */
    public function restaurantCard(Restaurant $restaurant, ?CustomerAddress $address): array
    {
        $distance = $restaurant->getAttribute('distance_km');

        if ($distance === null && $address !== null) {
            $distance = $this->distanceInKilometres(
                (float) $address->latitude,
                (float) $address->longitude,
                (float) $restaurant->latitude,
                (float) $restaurant->longitude,
            );
        }

        $distance = $distance === null ? null : round((float) $distance, 1);
        $eta = $this->estimatedDeliveryMinutes($restaurant, $distance);
        $reviewCount = (int) ($restaurant->getAttribute('reviews_count') ?? 0);

        return [
            'id' => $restaurant->id,
            'name' => $restaurant->name,
            'cuisine_type' => (string) $restaurant->cuisine_type,
            'address' => $restaurant->address,
            'cover_photo_url' => $this->publicUrl($restaurant->cover_photo_path),
            'logo_url' => $this->publicUrl($restaurant->logo_path),
            'rating' => $reviewCount > 0
                ? round((float) $restaurant->getAttribute('reviews_avg_rating'), 1)
                : null,
            'review_count' => $reviewCount,
            'distance_km' => $distance,
            'estimated_delivery_minutes' => $eta,
            'is_open' => $this->isRestaurantOpen($restaurant),
            'show_url' => route('customer.restaurants.show', $restaurant, absolute: false),
        ];
    }

    /** @return array<string, mixed> */
    public function foodCard(MenuItem $item, ?CustomerAddress $address): array
    {
        $item->loadMissing([
            'variants',
            'addons',
            'category.restaurant.operatingHours',
        ]);
        $restaurant = $item->category->restaurant;
        $distance = $item->getAttribute('distance_km');

        if ($distance === null && $address !== null) {
            $distance = $this->distanceInKilometres(
                (float) $address->latitude,
                (float) $address->longitude,
                (float) $restaurant->latitude,
                (float) $restaurant->longitude,
            );
        }

        $distance = $distance === null ? null : round((float) $distance, 1);
        $reviewCount = (int) ($restaurant->getAttribute('reviews_count') ?? 0);

        return [
            ...$this->item($item),
            'distance_km' => $distance,
            'category' => [
                'id' => $item->category->id,
                'name' => $item->category->name,
            ],
            'restaurant' => [
                'id' => $restaurant->id,
                'name' => $restaurant->name,
                'cuisine_type' => (string) $restaurant->cuisine_type,
                'rating' => $reviewCount > 0
                    ? round((float) $restaurant->getAttribute('reviews_avg_rating'), 1)
                    : null,
                'review_count' => $reviewCount,
                'estimated_delivery_minutes' => $this->estimatedDeliveryMinutes($restaurant, $distance),
                'is_open' => $this->isRestaurantOpen($restaurant),
                'show_url' => route('customer.restaurants.show', $restaurant, absolute: false),
            ],
        ];
    }

    /** @return array<string, mixed> */
    public function item(MenuItem $item): array
    {
        $item->loadMissing(['variants', 'addons']);
        $available = $this->isItemAvailable($item);

        return [
            'id' => $item->id,
            'name' => $item->name,
            'description' => $item->description,
            'photo_url' => $this->publicUrl($item->photo_path),
            'base_price' => (float) $item->base_price,
            'is_available' => $available,
            'availability_label' => $available ? 'Available' : $this->availabilityLabel($item),
            'available_from' => $item->available_from,
            'available_until' => $item->available_until,
            'variants' => $item->variants->map(fn ($variant): array => [
                'id' => $variant->id,
                'name' => $variant->name,
                'price_delta' => (float) $variant->price_delta,
            ])->values(),
            'addons' => $item->addons
                ->where('is_available', true)
                ->map(fn ($addon): array => [
                    'id' => $addon->id,
                    'name' => $addon->name,
                    'price' => (float) $addon->price,
                ])->values(),
        ];
    }

    /** @return array{minimum: int, maximum: int} */
    public function estimatedDeliveryMinutes(Restaurant $restaurant, ?float $distance): array
    {
        $prepMinutes = max(10, (int) ($restaurant->default_prep_time_minutes ?? 20));
        $travelMinutes = $distance === null ? 15 : max(10, (int) ceil($distance * 4));
        $minimum = $prepMinutes + $travelMinutes;

        return ['minimum' => $minimum, 'maximum' => $minimum + 10];
    }

    private function availabilityLabel(MenuItem $item): string
    {
        if (! $item->is_available) {
            return 'Sold out';
        }

        if ($item->available_from !== null && $item->available_until !== null) {
            return 'Available '.$this->formatTime($item->available_from).'–'.$this->formatTime($item->available_until);
        }

        if ($item->available_from !== null) {
            return 'Available after '.$this->formatTime($item->available_from);
        }

        return 'Available until '.$this->formatTime((string) $item->available_until);
    }

    private function formatTime(string $time): string
    {
        return CarbonImmutable::createFromFormat('H:i:s', $time, self::TIMEZONE)->format('g:i A');
    }

    private function publicUrl(?string $path): ?string
    {
        return $path === null ? null : Storage::disk('public')->url($path);
    }
}
