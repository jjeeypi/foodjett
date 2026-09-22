<?php

namespace Database\Factories;

use App\Models\RiderReview;
use App\Models\Order;
use App\Models\Customer;
use App\Models\Rider;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<RiderReview>
 */
class RiderReviewFactory extends Factory
{
    private static array $positiveComments = [
        'Mabilis at maayos ang delivery!', 'Napaka-professional ng rider. Salamat!',
        'Buo at mainit ang pagkain nang dumating.', 'Palagi siyang on-time. 5 stars!',
        'Magalang at maingat sa paghahatid. Salamat!', 'Napakabilis! Ilang minuto lang.',
        'Maayos ang rider, laging nag-uupdate ng status.', 'Salamat sa maayos na delivery!',
    ];

    private static array $negativeComments = [
        'Matagal dumating ang order.', 'Hindi masyadong nag-uupdate ng location.',
        'Medyo basag ang pagkain nang dumating.', 'Sana mas maging maingat sa pagdadala.',
    ];

    public function definition(): array
    {
        $rating = $this->faker->randomElement([5, 5, 5, 4, 4, 4, 3, 2, 1]);
        $comment = $rating >= 4
            ? $this->faker->randomElement(self::$positiveComments)
            : $this->faker->randomElement(self::$negativeComments);

        return [
            'order_id' => Order::factory(),
            'customer_id' => Customer::factory(),
            'rider_id' => Rider::factory()->approved(),
            'rating' => $rating,
            'comment' => $comment,
        ];
    }
}
