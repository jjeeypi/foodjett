<?php

namespace App\Policies;

use App\Models\MenuItemVariant;
use App\Models\User;

class MenuItemVariantPolicy extends Policy
{
    public function viewAny(User $user): bool
    {
        return $user->isRestaurant();
    }

    public function view(User $user, MenuItemVariant $variant): bool
    {
        return $this->ownsRestaurant($user, $variant->menuItem->category->restaurant_id);
    }

    public function create(User $user): bool
    {
        return $user->isRestaurant() && $user->restaurant !== null;
    }

    public function update(User $user, MenuItemVariant $variant): bool
    {
        return $this->ownsRestaurant($user, $variant->menuItem->category->restaurant_id);
    }

    public function delete(User $user, MenuItemVariant $variant): bool
    {
        return $this->ownsRestaurant($user, $variant->menuItem->category->restaurant_id);
    }
}
