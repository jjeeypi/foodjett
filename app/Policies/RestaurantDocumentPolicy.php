<?php

namespace App\Policies;

use App\Models\RestaurantDocument;
use App\Models\User;

class RestaurantDocumentPolicy extends Policy
{
    public function viewAny(User $user): bool
    {
        return $user->isRestaurant();
    }

    public function view(User $user, RestaurantDocument $document): bool
    {
        return $this->ownsRestaurant($user, $document->restaurant_id);
    }

    public function create(User $user): bool
    {
        return $user->isRestaurant() && $user->restaurant !== null;
    }

    public function update(User $user, RestaurantDocument $document): bool
    {
        return $this->ownsRestaurant($user, $document->restaurant_id);
    }

    public function delete(User $user, RestaurantDocument $document): bool
    {
        return $this->ownsRestaurant($user, $document->restaurant_id);
    }
}
