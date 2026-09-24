<?php

use App\Models\User;
use Illuminate\Support\Facades\Broadcast;

Broadcast::channel('restaurant.{restaurantId}.orders', function (User $user, int $restaurantId): bool {
    return $user->isAdmin()
        || ($user->isRestaurant() && $user->restaurant?->id === $restaurantId);
});
