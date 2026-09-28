<?php

namespace App\Http\Controllers\Customer;

use App\Http\Controllers\Controller;
use App\Models\Restaurant;
use App\Services\CustomerCatalog;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class HomeController extends Controller
{
    public function __invoke(Request $request, CustomerCatalog $catalog): Response
    {
        $customer = $request->user()?->customer;
        abort_unless($customer !== null, 403);

        $defaultAddress = $catalog->defaultAddress($customer);

        $baseQuery = $this->restaurantQuery($catalog);
        $featured = (clone $baseQuery)
            ->whereHas('menuCategories.menuItems', function (Builder $query) use ($catalog): void {
                $query->where('is_featured', true);
                $catalog->constrainAvailableItems($query);
            })
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
            : $catalog->restaurantsByDistance(clone $baseQuery, $defaultAddress, 12);

        return Inertia::render('customer/home', [
            'featuredRestaurants' => array_values($featured
                ->map(fn (Restaurant $restaurant): array => $catalog->restaurantCard($restaurant, $defaultAddress))
                ->all()),
            'nearbyRestaurants' => array_values($nearby
                ->map(fn (Restaurant $restaurant): array => $catalog->restaurantCard($restaurant, $defaultAddress))
                ->all()),
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
        ]);
    }

    /** @return Builder<Restaurant> */
    private function restaurantQuery(CustomerCatalog $catalog): Builder
    {
        $query = Restaurant::query()
            ->with('operatingHours')
            ->withAvg('reviews', 'rating')
            ->withCount('reviews')
            ->where('approval_status', 'approved');

        return $catalog->constrainOpenRestaurants($query);
    }
}
