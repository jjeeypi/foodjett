<?php

namespace App\Http\Controllers\Customer;

use App\Http\Controllers\Controller;
use App\Models\CustomerAddress;
use App\Models\Restaurant;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;

class HomeController extends Controller
{
    public function __invoke(Request $request): Response
    {
        $customer = $request->user()?->customer;
        abort_unless($customer !== null, 403);

        $search = trim($request->string('search')->toString());
        $cuisine = trim($request->string('cuisine')->toString());
        $defaultAddress = $customer->addresses()
            ->orderByDesc('is_default')
            ->latest('id')
            ->first(['id', 'label', 'address_line', 'latitude', 'longitude', 'is_default']);

        $baseQuery = $this->restaurantQuery($search, $cuisine);
        $featured = (clone $baseQuery)
            ->whereHas('menuCategories.menuItems', fn (Builder $query) => $query
                ->where('is_featured', true)
                ->where('is_available', true))
            ->latest()
            ->limit(6)
            ->get();
        $featuredSource = 'featured_items';

        if ($featured->isEmpty()) {
            $featured = (clone $baseQuery)->latest()->limit(6)->get();
            $featuredSource = 'recent';
        }

        $nearby = $defaultAddress === null
            ? new Collection
            : $this->restaurantsByDistance(clone $baseQuery, $defaultAddress, 12);
        $browse = $defaultAddress === null
            ? (clone $baseQuery)->orderBy('name')->limit(24)->get()
            : $this->restaurantsByDistance(clone $baseQuery, $defaultAddress, 24);

        return Inertia::render('customer/home', [
            'featuredRestaurants' => $this->restaurantCards($featured, $defaultAddress),
            'nearbyRestaurants' => $this->restaurantCards($nearby, $defaultAddress),
            'browseRestaurants' => $this->restaurantCards($browse, $defaultAddress),
            'featuredSource' => $featuredSource,
            'defaultAddress' => $defaultAddress?->only([
                'id', 'label', 'address_line', 'latitude', 'longitude', 'is_default',
            ]),
            'cuisines' => Restaurant::query()
                ->where('approval_status', 'approved')
                ->where('operating_status', 'open')
                ->whereNotNull('cuisine_type')
                ->where('cuisine_type', '!=', '')
                ->orderBy('cuisine_type')
                ->distinct()
                ->pluck('cuisine_type')
                ->values(),
            'filters' => [
                'search' => $search,
                'cuisine' => $cuisine,
            ],
            'isBrowsing' => $request->routeIs('customer.foods.index'),
        ]);
    }

    /** @return Builder<Restaurant> */
    private function restaurantQuery(string $search, string $cuisine): Builder
    {
        return Restaurant::query()
            ->withAvg('reviews', 'rating')
            ->withCount('reviews')
            ->where('approval_status', 'approved')
            ->where('operating_status', 'open')
            ->when($cuisine !== '', fn (Builder $query) => $query->where('cuisine_type', $cuisine))
            ->when($search !== '', fn (Builder $query) => $query->where(function (Builder $query) use ($search): void {
                $query->where('name', 'like', "%{$search}%")
                    ->orWhere('cuisine_type', 'like', "%{$search}%");
            }));
    }

    /**
     * @param  Builder<Restaurant>  $query
     * @return Collection<int, Restaurant>
     */
    private function restaurantsByDistance(Builder $query, CustomerAddress $address, int $limit): Collection
    {
        $latitude = (float) $address->latitude;
        $longitude = (float) $address->longitude;

        if (in_array(DB::connection()->getDriverName(), ['mysql', 'mariadb'], true)) {
            $distanceSql = <<<'SQL'
                6371 * 2 * ASIN(LEAST(1, SQRT(
                    POWER(SIN(RADIANS(restaurants.latitude - ?) / 2), 2) +
                    COS(RADIANS(?)) * COS(RADIANS(restaurants.latitude)) *
                    POWER(SIN(RADIANS(restaurants.longitude - ?) / 2), 2)
                )))
                SQL;

            return $query
                ->select('restaurants.*')
                ->selectRaw("{$distanceSql} AS distance_km", [$latitude, $latitude, $longitude])
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
     * @param  Collection<int, Restaurant>  $restaurants
     * @return list<array<string, mixed>>
     */
    private function restaurantCards(Collection $restaurants, ?CustomerAddress $address): array
    {
        return array_values($restaurants->map(function (Restaurant $restaurant) use ($address): array {
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
            $prepMinutes = max(10, (int) ($restaurant->default_prep_time_minutes ?? 20));
            $travelMinutes = $distance === null ? 15 : max(10, (int) ceil($distance * 4));
            $etaMinimum = $prepMinutes + $travelMinutes;

            return [
                'id' => $restaurant->id,
                'name' => $restaurant->name,
                'cuisine_type' => (string) $restaurant->cuisine_type,
                'address' => $restaurant->address,
                'cover_photo_url' => $restaurant->cover_photo_path === null
                    ? null
                    : Storage::disk('public')->url($restaurant->cover_photo_path),
                'logo_url' => $restaurant->logo_path === null
                    ? null
                    : Storage::disk('public')->url($restaurant->logo_path),
                'rating' => $restaurant->reviews_count > 0
                    ? round((float) $restaurant->getAttribute('reviews_avg_rating'), 1)
                    : null,
                'review_count' => (int) $restaurant->reviews_count,
                'distance_km' => $distance,
                'estimated_delivery_minutes' => [
                    'minimum' => $etaMinimum,
                    'maximum' => $etaMinimum + 10,
                ],
                'menu_url' => route('customer.checkout.show', $restaurant, absolute: false),
            ];
        })->all());
    }

    private function distanceInKilometres(float $fromLat, float $fromLng, float $toLat, float $toLng): float
    {
        $latitudeDelta = deg2rad($toLat - $fromLat);
        $longitudeDelta = deg2rad($toLng - $fromLng);
        $a = sin($latitudeDelta / 2) ** 2
            + cos(deg2rad($fromLat)) * cos(deg2rad($toLat))
            * sin($longitudeDelta / 2) ** 2;

        return 6371 * 2 * asin(min(1, sqrt($a)));
    }
}
