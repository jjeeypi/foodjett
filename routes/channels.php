<?php

use App\Models\Conversation;
use App\Models\Order;
use App\Models\User;
use Illuminate\Support\Facades\Broadcast;
use Illuminate\Support\Facades\Gate;

Broadcast::channel('restaurant.{restaurantId}.orders', function (User $user, int $restaurantId): bool {
    return $user->isAdmin()
        || ($user->isRestaurant() && $user->restaurant?->id === $restaurantId);
});

Broadcast::channel('order.{orderId}.status', function (User $user, int $orderId): bool {
    if ($user->isAdmin()) {
        return true;
    }

    if ($user->isCustomer() && $user->customer !== null) {
        return Order::query()
            ->whereKey($orderId)
            ->where('customer_id', $user->customer->id)
            ->exists();
    }

    if ($user->isRider() && $user->rider !== null) {
        return Order::query()
            ->whereKey($orderId)
            ->where('rider_id', $user->rider->id)
            ->exists();
    }

    return false;
});

Broadcast::channel('conversation.{conversationId}', function (User $user, int $conversationId): bool {
    $conversation = Conversation::query()->find($conversationId);

    return $conversation !== null
        && Gate::forUser($user)->allows('view', $conversation);
});

Broadcast::channel('user.{userId}.notifications', function (User $user, int $userId): bool {
    return $user->id === $userId;
});
