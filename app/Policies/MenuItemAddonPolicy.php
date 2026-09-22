<?php

namespace App\Policies;

use App\Models\MenuItemAddon;
use App\Models\User;

class MenuItemAddonPolicy extends Policy
{
    public function viewAny(User $user): bool
    {
        return $user->isRestaurant();
    }

    public function view(User $user, MenuItemAddon $addon): bool
    {
        return $this->ownsRestaurant($user, $addon->menuItem->category->restaurant_id);
    }

    public function create(User $user): bool
    {
        return $user->isRestaurant() && $user->restaurant !== null;
    }

    public function update(User $user, MenuItemAddon $addon): bool
    {
        return $this->ownsRestaurant($user, $addon->menuItem->category->restaurant_id);
    }

    public function delete(User $user, MenuItemAddon $addon): bool
    {
        return $this->ownsRestaurant($user, $addon->menuItem->category->restaurant_id);
    }
}
