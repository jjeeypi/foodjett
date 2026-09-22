<?php

namespace App\Policies;

use App\Models\Restaurant;
use App\Models\User;

class RestaurantPolicy extends Policy
{
    public function viewAny(User $user): bool
    {
        return $user->isRestaurant();
    }

    public function view(User $user, Restaurant $restaurant): bool
    {
        return $restaurant->user_id === $user->id;
    }

    public function create(User $user): bool
    {
        return $user->isRestaurant() && $user->restaurant === null;
    }

    public function update(User $user, Restaurant $restaurant): bool
    {
        return $restaurant->user_id === $user->id;
    }

    public function delete(User $user, Restaurant $restaurant): bool
    {
        return $restaurant->user_id === $user->id;
    }
}
