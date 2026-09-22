<?php

namespace App\Policies;

use App\Models\RestaurantOperatingHour;
use App\Models\User;

class RestaurantOperatingHourPolicy extends Policy
{
    public function viewAny(User $user): bool
    {
        return $user->isRestaurant();
    }

    public function view(User $user, RestaurantOperatingHour $hours): bool
    {
        return $this->ownsRestaurant($user, $hours->restaurant_id);
    }

    public function create(User $user): bool
    {
        return $user->isRestaurant() && $user->restaurant !== null;
    }

    public function update(User $user, RestaurantOperatingHour $hours): bool
    {
        return $this->ownsRestaurant($user, $hours->restaurant_id);
    }

    public function delete(User $user, RestaurantOperatingHour $hours): bool
    {
        return $this->ownsRestaurant($user, $hours->restaurant_id);
    }
}
