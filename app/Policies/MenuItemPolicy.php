<?php

namespace App\Policies;

use App\Models\MenuItem;
use App\Models\User;

class MenuItemPolicy extends Policy
{
    public function viewAny(User $user): bool
    {
        return $user->isRestaurant();
    }

    public function view(User $user, MenuItem $item): bool
    {
        return $this->ownsRestaurant($user, $item->category->restaurant_id);
    }

    public function create(User $user): bool
    {
        return $user->isRestaurant() && $user->restaurant !== null;
    }

    public function update(User $user, MenuItem $item): bool
    {
        return $this->ownsRestaurant($user, $item->category->restaurant_id);
    }

    public function delete(User $user, MenuItem $item): bool
    {
        return $this->ownsRestaurant($user, $item->category->restaurant_id);
    }
}
