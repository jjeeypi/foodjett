<?php

namespace App\Policies;

use App\Models\MenuCategory;
use App\Models\User;

class MenuCategoryPolicy extends Policy
{
    public function viewAny(User $user): bool
    {
        return $user->isRestaurant();
    }

    public function view(User $user, MenuCategory $category): bool
    {
        return $this->ownsRestaurant($user, $category->restaurant_id);
    }

    public function create(User $user): bool
    {
        return $user->isRestaurant() && $user->restaurant !== null;
    }

    public function update(User $user, MenuCategory $category): bool
    {
        return $this->ownsRestaurant($user, $category->restaurant_id);
    }

    public function delete(User $user, MenuCategory $category): bool
    {
        return $this->ownsRestaurant($user, $category->restaurant_id);
    }
}
