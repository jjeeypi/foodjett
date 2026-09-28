<?php

namespace App\Http\Controllers\Customer;

use App\Http\Controllers\Controller;
use App\Models\CustomerAddress;
use App\Models\MenuItem;
use App\Models\Restaurant;
use App\Models\RestaurantReview;
use App\Services\CustomerCatalog;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class FoodController extends Controller
{
    public function index(Request $request, CustomerCatalog $catalog): Response
    {
        $customer = $request->user()?->customer;
        abort_unless($customer !== null, 403);

        $filters = $request->validate([
            'cuisine' => ['nullable', 'string', 'max:100'],
            'category' => ['nullable', 'string', 'max:100'],
            'min_price' => ['nullable', 'numeric', 'min:0', 'max:999999'],
            'max_price' => ['nullable', 'numeric', 'min:0', 'max:999999', 'gte:min_price'],
            'sort' => ['nullable', Rule::in(['nearest', 'price_asc', 'rating'])],
        ]);
        $address = $catalog->defaultAddress($customer);
        $sort = $filters['sort'] ?? 'nearest';
        $query = $catalog->availableFoodQuery()
            ->when($filters['cuisine'] ?? null, fn (Builder $query, string $cuisine) => $query
                ->where('restaurants.cuisine_type', $cuisine))
            ->when($filters['category'] ?? null, fn (Builder $query, string $category) => $query
                ->where('menu_categories.name', $category))
            ->when(isset($filters['min_price']), fn (Builder $query) => $query
                ->where('menu_items.base_price', '>=', $filters['min_price']))
            ->when(isset($filters['max_price']), fn (Builder $query) => $query
                ->where('menu_items.base_price', '<=', $filters['max_price']));

        $items = $this->paginate($query, $sort, $address, $request, $catalog)
            ->withQueryString()
            ->through(fn (MenuItem $item): array => $catalog->foodCard($item, $address));

        return Inertia::render('customer/foods/index', [
            'items' => $items,
            'cuisines' => Restaurant::query()
                ->where('approval_status', 'approved')
                ->orderBy('cuisine_type')
                ->distinct()
                ->pluck('cuisine_type')
                ->filter()
                ->values(),
            'categories' => DB::table('menu_categories')
                ->join('restaurants', 'restaurants.id', '=', 'menu_categories.restaurant_id')
                ->where('restaurants.approval_status', 'approved')
                ->orderBy('menu_categories.name')
                ->distinct()
                ->pluck('menu_categories.name')
                ->values(),
            'filters' => [
                'cuisine' => $filters['cuisine'] ?? '',
                'category' => $filters['category'] ?? '',
                'min_price' => isset($filters['min_price']) ? (string) $filters['min_price'] : '',
                'max_price' => isset($filters['max_price']) ? (string) $filters['max_price'] : '',
                'sort' => $sort,
            ],
            'hasAddress' => $address !== null,
        ]);
    }

    /**
     * @param  Builder<MenuItem>  $query
     * @return LengthAwarePaginator<int, MenuItem>
     */
    private function paginate(
        Builder $query,
        string $sort,
        ?CustomerAddress $address,
        Request $request,
        CustomerCatalog $catalog,
    ): LengthAwarePaginator {
        if ($sort === 'price_asc') {
            return $query->orderBy('menu_items.base_price')->orderBy('menu_items.id')->paginate(18);
        }

        if ($sort === 'rating') {
            return $query
                ->orderByDesc(RestaurantReview::query()
                    ->selectRaw('AVG(restaurant_reviews.rating)')
                    ->whereColumn('restaurant_reviews.restaurant_id', 'restaurants.id'))
                ->orderBy('menu_items.name')
                ->paginate(18);
        }

        if ($address === null) {
            return $query->orderBy('menu_items.name')->paginate(18);
        }

        $latitude = (float) $address->latitude;
        $longitude = (float) $address->longitude;

        if (in_array(DB::connection()->getDriverName(), ['mysql', 'mariadb'], true)) {
            return $catalog->selectRestaurantDistance($query, $latitude, $longitude)
                ->orderBy('distance_km')
                ->orderBy('menu_items.name')
                ->paginate(18);
        }

        $items = $query->get()
            ->each(fn (MenuItem $item) => $item->setAttribute(
                'distance_km',
                $catalog->distanceInKilometres(
                    $latitude,
                    $longitude,
                    (float) $item->category->restaurant->latitude,
                    (float) $item->category->restaurant->longitude,
                ),
            ))
            ->sortBy('distance_km')
            ->values();
        $page = max(1, $request->integer('page', 1));

        return new LengthAwarePaginator(
            $items->forPage($page, 18)->values(),
            $items->count(),
            18,
            $page,
            ['path' => $request->url(), 'query' => $request->query()],
        );
    }
}
