<?php

namespace Database\Factories;

use App\Models\Customer;
use App\Models\Order;
use App\Models\Restaurant;
use App\Models\RestaurantReview;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<RestaurantReview>
 */
class RestaurantReviewFactory extends Factory
{
    /** @var list<string> */
    private static array $positiveComments = [
        'Masarap! Babalik kami ulit.', 'Sulit na sulit ang presyo!', 'Palagi kaming nagorder dito.',
        'Fresh ang pagkain at mabilis ang delivery!', 'Lutong Pinoy talaga, sarap!',
        'Sobrang bilis ng pagluto, masarap pa!', 'Worth it ang bayad. Highly recommended!',
        'Yummy! Perfect para sa almusal.', 'Dami ng portion, masustansya pa.',
        'Favorite namin to sa Dumaguete!',
    ];

    /** @var list<string> */
    private static array $negativeComments = [
        'Okay lang, pero matagal dumating.', 'Medyo maalat para sa amin.',
        'Sana mas mainit pag dating.', 'Mababa ang portions kumpara sa presyo.',
    ];

    public function definition(): array
    {
        // Weighted toward 4–5 stars
        $rating = $this->faker->randomElement([5, 5, 5, 4, 4, 4, 3, 2, 1]);
        $comment = $rating >= 4
            ? $this->faker->randomElement(self::$positiveComments)
            : $this->faker->randomElement(self::$negativeComments);

        return [
            'order_id' => Order::factory(),
            'customer_id' => Customer::factory(),
            'restaurant_id' => Restaurant::factory()->approved(),
            'rating' => $rating,
            'comment' => $comment,
            'photo_path' => null,
            'restaurant_reply' => null,
            'replied_at' => null,
        ];
    }
}
