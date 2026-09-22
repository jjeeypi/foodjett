<?php

namespace App\Policies;

use App\Models\RestaurantReview;
use App\Models\User;

class RestaurantReviewPolicy extends Policy
{
    public function viewAny(User $user): bool
    {
        return $user->isCustomer() || $user->isRestaurant();
    }

    public function view(User $user, RestaurantReview $review): bool
    {
        return $this->ownsCustomer($user, $review->customer_id)
            || $this->ownsRestaurant($user, $review->restaurant_id);
    }

    public function create(User $user): bool
    {
        return $user->isCustomer() && $user->customer !== null;
    }

    public function update(User $user, RestaurantReview $review): bool
    {
        return $this->ownsCustomer($user, $review->customer_id);
    }

    public function reply(User $user, RestaurantReview $review): bool
    {
        return $this->ownsRestaurant($user, $review->restaurant_id);
    }

    public function delete(User $user, RestaurantReview $review): bool
    {
        return $this->ownsCustomer($user, $review->customer_id);
    }
}
