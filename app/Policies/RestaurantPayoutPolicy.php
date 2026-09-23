<?php

namespace App\Policies;

use App\Models\RestaurantPayout;
use App\Models\User;

class RestaurantPayoutPolicy extends Policy
{
    public function viewAny(User $user): bool
    {
        return $user->isRestaurant();
    }

    public function view(User $user, RestaurantPayout $payout): bool
    {
        return $this->ownsRestaurant($user, $payout->restaurant_id);
    }

    public function update(User $user, RestaurantPayout $payout): bool
    {
        return false;
    }

    public function generate(User $user): bool
    {
        return $user->isAdmin();
    }

    public function markPaid(User $user, RestaurantPayout $payout): bool
    {
        return $user->isAdmin();
    }

    public function delete(User $user, RestaurantPayout $payout): bool
    {
        return false;
    }
}
