<?php

namespace App\Http\Controllers\Customer;

use App\Http\Controllers\Controller;
use App\Models\MenuItem;
use App\Models\Restaurant;
use App\Models\RestaurantReview;
use App\Services\CustomerCatalog;
use Carbon\CarbonImmutable;
use Inertia\Inertia;
use Inertia\Response;

class RestaurantController extends Controller
{
    public function show(Restaurant $restaurant, CustomerCatalog $catalog): Response
    {
        abort_unless($restaurant->approval_status === 'approved', 404);

        $customer = request()->user()?->customer;
        abort_unless($customer !== null, 403);

        $restaurant->load([
            'operatingHours' => fn ($query) => $query
                ->orderBy('day_of_week')
                ->orderBy('opens_at'),
            'menuCategories' => fn ($query) => $query
                ->orderBy('sort_order')
                ->orderBy('name'),
            'menuCategories.menuItems' => fn ($query) => $query->orderBy('name'),
            'menuCategories.menuItems.variants',
            'menuCategories.menuItems.addons',
        ])->loadAvg('reviews', 'rating')->loadCount('reviews');

        $address = $catalog->defaultAddress($customer);
        $card = $catalog->restaurantCard($restaurant, $address);
        $reviews = RestaurantReview::query()
            ->where('restaurant_id', $restaurant->id)
            ->with('customer.user:id,name')
            ->latest()
            ->paginate(6, ['*'], 'reviews_page')
            ->withQueryString()
            ->through(fn (RestaurantReview $review): array => [
                'id' => $review->id,
                'rating' => $review->rating,
                'comment' => $review->comment,
                'customer_name' => $review->customer->user->name,
                'restaurant_reply' => $review->restaurant_reply,
                'created_at' => $review->created_at?->toIso8601String(),
            ]);

        return Inertia::render('customer/restaurants/show', [
            'restaurant' => [
                ...$card,
                'description' => $restaurant->description,
                'operating_status' => $restaurant->operating_status,
                'min_order_amount' => (float) $restaurant->min_order_amount,
                'closed_message' => $this->closedMessage($restaurant, (bool) $card['is_open']),
                'opening_hours' => $restaurant->operatingHours->map(fn ($hours): array => [
                    'id' => $hours->id,
                    'day' => CarbonImmutable::create()
                        ->startOfWeek(CarbonImmutable::SUNDAY)
                        ->addDays((int) $hours->day_of_week)
                        ->format('l'),
                    'day_of_week' => (int) $hours->day_of_week,
                    'opens_at' => CarbonImmutable::createFromFormat('H:i:s', (string) $hours->opens_at)
                        ->format('g:i A'),
                    'closes_at' => CarbonImmutable::createFromFormat('H:i:s', (string) $hours->closes_at)
                        ->format('g:i A'),
                ])->values(),
                'menu_categories' => $restaurant->menuCategories->map(fn ($category): array => [
                    'id' => $category->id,
                    'name' => $category->name,
                    'items' => $category->menuItems->map(fn (MenuItem $item): array => [
                        ...$catalog->item($item),
                        'restaurant' => [
                            'id' => $restaurant->id,
                            'name' => $restaurant->name,
                            'cuisine_type' => (string) $restaurant->cuisine_type,
                            'rating' => $card['rating'],
                            'review_count' => $card['review_count'],
                            'estimated_delivery_minutes' => $card['estimated_delivery_minutes'],
                            'is_open' => (bool) $card['is_open'],
                            'show_url' => route('customer.restaurants.show', $restaurant, absolute: false),
                        ],
                        'category' => [
                            'id' => $category->id,
                            'name' => $category->name,
                        ],
                        'distance_km' => $card['distance_km'],
                    ])->values(),
                ])->values(),
            ],
            'reviews' => $reviews,
        ]);
    }

    private function closedMessage(Restaurant $restaurant, bool $isOpen): ?string
    {
        if ($isOpen) {
            return null;
        }

        return match ($restaurant->operating_status) {
            'temporarily_closed' => 'This restaurant is temporarily closed.',
            'closed' => 'This restaurant is currently closed.',
            default => 'This restaurant is outside its opening hours.',
        };
    }
}
