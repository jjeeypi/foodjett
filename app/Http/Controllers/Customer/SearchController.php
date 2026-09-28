<?php

namespace App\Http\Controllers\Customer;

use App\Http\Controllers\Controller;
use App\Models\MenuItem;
use App\Models\Restaurant;
use App\Services\CustomerCatalog;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class SearchController extends Controller
{
    public function index(Request $request, CustomerCatalog $catalog): Response
    {
        $customer = $request->user()?->customer;
        abort_unless($customer !== null, 403);

        $filters = $request->validate([
            'q' => ['nullable', 'string', 'max:100'],
            'tab' => ['nullable', Rule::in(['restaurants', 'dishes'])],
            'rating' => ['nullable', Rule::in(['3', '4', '4.5'])],
            'min_price' => ['nullable', 'numeric', 'min:0', 'max:999999'],
            'max_price' => ['nullable', 'numeric', 'min:0', 'max:999999', 'gte:min_price'],
            'open_now' => ['nullable', Rule::in(['0', '1', 'false', 'true', 0, 1, false, true])],
            'cuisine' => ['nullable', 'string', 'max:100'],
        ]);
        $filters['open_now'] = $request->boolean('open_now');
        $queryText = trim((string) ($filters['q'] ?? ''));
        $tab = $filters['tab'] ?? 'restaurants';
        $address = $catalog->defaultAddress($customer);
        $restaurantQuery = $this->restaurantQuery($filters, $queryText, $catalog);
        $dishQuery = $this->dishQuery($filters, $queryText, $catalog);
        $counts = [
            'restaurants' => (clone $restaurantQuery)->count(),
            'dishes' => (clone $dishQuery)->count(),
        ];

        if ($tab === 'dishes') {
            $results = $dishQuery
                ->orderBy('menu_items.name')
                ->paginate(12)
                ->withQueryString()
                ->through(fn (MenuItem $item): array => $catalog->foodCard($item, $address));
        } else {
            $results = $restaurantQuery
                ->orderByDesc('restaurants.operating_status')
                ->orderBy('restaurants.name')
                ->paginate(12)
                ->withQueryString()
                ->through(fn (Restaurant $restaurant): array => $catalog->restaurantCard($restaurant, $address));
        }

        return Inertia::render('customer/search/index', [
            'results' => $results,
            'counts' => $counts,
            'filters' => [
                'q' => $queryText,
                'tab' => $tab,
                'rating' => (string) ($filters['rating'] ?? ''),
                'min_price' => isset($filters['min_price']) ? (string) $filters['min_price'] : '',
                'max_price' => isset($filters['max_price']) ? (string) $filters['max_price'] : '',
                'open_now' => (bool) ($filters['open_now'] ?? false),
                'cuisine' => $filters['cuisine'] ?? '',
            ],
            'cuisines' => Restaurant::query()
                ->where('approval_status', 'approved')
                ->orderBy('cuisine_type')
                ->distinct()
                ->pluck('cuisine_type')
                ->filter()
                ->values(),
            'popularCuisines' => Restaurant::query()
                ->where('approval_status', 'approved')
                ->selectRaw('cuisine_type, COUNT(*) AS restaurant_count')
                ->whereNotNull('cuisine_type')
                ->groupBy('cuisine_type')
                ->orderByDesc('restaurant_count')
                ->limit(6)
                ->pluck('cuisine_type')
                ->values(),
        ]);
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return Builder<Restaurant>
     */
    private function restaurantQuery(array $filters, string $queryText, CustomerCatalog $catalog): Builder
    {
        $query = Restaurant::query()
            ->with('operatingHours')
            ->withAvg('reviews', 'rating')
            ->withCount('reviews')
            ->where('restaurants.approval_status', 'approved')
            ->when($queryText !== '', fn (Builder $query) => $query
                ->where(function (Builder $query) use ($queryText): void {
                    $query->where('restaurants.name', 'like', "%{$queryText}%")
                        ->orWhere('restaurants.cuisine_type', 'like', "%{$queryText}%");
                }))
            ->when($filters['cuisine'] ?? null, fn (Builder $query, string $cuisine) => $query
                ->where('restaurants.cuisine_type', $cuisine))
            ->when($filters['rating'] ?? null, fn (Builder $query, string $rating) => $query
                ->whereRaw(
                    '(SELECT AVG(restaurant_reviews.rating) FROM restaurant_reviews WHERE restaurant_reviews.restaurant_id = restaurants.id) >= ?',
                    [(float) $rating],
                ));

        if ($filters['open_now'] ?? false) {
            $catalog->constrainOpenRestaurants($query);
        }

        return $query;
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return Builder<MenuItem>
     */
    private function dishQuery(array $filters, string $queryText, CustomerCatalog $catalog): Builder
    {
        $query = $catalog->availableFoodQuery((bool) ($filters['open_now'] ?? false))
            ->when($queryText !== '', fn (Builder $query) => $query
                ->where(function (Builder $query) use ($queryText): void {
                    $query->where('menu_items.name', 'like', "%{$queryText}%")
                        ->orWhere('menu_items.description', 'like', "%{$queryText}%");
                }))
            ->when($filters['cuisine'] ?? null, fn (Builder $query, string $cuisine) => $query
                ->where('restaurants.cuisine_type', $cuisine))
            ->when(isset($filters['min_price']), fn (Builder $query) => $query
                ->where('menu_items.base_price', '>=', $filters['min_price']))
            ->when(isset($filters['max_price']), fn (Builder $query) => $query
                ->where('menu_items.base_price', '<=', $filters['max_price']))
            ->when($filters['rating'] ?? null, fn (Builder $query, string $rating) => $query
                ->whereRaw(
                    '(SELECT AVG(restaurant_reviews.rating) FROM restaurant_reviews WHERE restaurant_reviews.restaurant_id = restaurants.id) >= ?',
                    [(float) $rating],
                ));

        return $query;
    }
}
