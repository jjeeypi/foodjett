<?php

namespace App\Policies;

use App\Models\RiderReview;
use App\Models\User;

class RiderReviewPolicy extends Policy
{
    public function viewAny(User $user): bool
    {
        return $user->isCustomer() || $user->isRider();
    }

    public function view(User $user, RiderReview $review): bool
    {
        return $this->ownsCustomer($user, $review->customer_id)
            || $this->ownsRider($user, $review->rider_id);
    }

    public function create(User $user): bool
    {
        return $user->isCustomer() && $user->customer !== null;
    }

    public function update(User $user, RiderReview $review): bool
    {
        return $this->ownsCustomer($user, $review->customer_id);
    }

    public function delete(User $user, RiderReview $review): bool
    {
        return $this->ownsCustomer($user, $review->customer_id);
    }
}
