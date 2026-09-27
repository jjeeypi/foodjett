<?php

use App\Models\Order;
use App\Models\User;
use Illuminate\Support\Facades\Broadcast;

Broadcast::channel('restaurant.{restaurantId}.orders', function (User $user, int $restaurantId): bool {
    return $user->isAdmin()
        || ($user->isRestaurant() && $user->restaurant?->id === $restaurantId);
});

Broadcast::channel('order.{orderId}.status', function (User $user, int $orderId): bool {
    if ($user->isAdmin()) {
        return true;
    }

    $customerId = $user->customer?->id;

    return $user->isCustomer()
        && $customerId !== null
        && Order::query()
            ->whereKey($orderId)
            ->where('customer_id', $customerId)
            ->exists();
});
