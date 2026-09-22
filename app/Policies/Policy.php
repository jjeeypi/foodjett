<?php

namespace App\Policies;

use App\Models\Order;
use App\Models\User;

abstract class Policy
{
    public function before(User $user): ?bool
    {
        return $user->isAdmin() ? true : null;
    }

    public function viewAny(User $user): bool
    {
        return false;
    }

    public function create(User $user): bool
    {
        return false;
    }

    public function restore(User $user, mixed $model): bool
    {
        return false;
    }

    public function forceDelete(User $user, mixed $model): bool
    {
        return false;
    }

    protected function ownsRestaurant(User $user, int $restaurantId): bool
    {
        return $user->isRestaurant() && $user->restaurant?->id === $restaurantId;
    }

    protected function ownsRider(User $user, int $riderId): bool
    {
        return $user->isRider() && $user->rider?->id === $riderId;
    }

    protected function ownsCustomer(User $user, int $customerId): bool
    {
        return $user->isCustomer() && $user->customer?->id === $customerId;
    }

    protected function isApprovedRider(User $user): bool
    {
        return $user->isRider() && $user->rider?->approval_status === 'approved';
    }

    protected function canAccessOrder(User $user, Order $order): bool
    {
        if ($user->isCustomer()) {
            return $user->customer?->id === $order->customer_id;
        }

        if ($user->isRestaurant()) {
            return $user->restaurant?->id === $order->restaurant_id;
        }

        if (! $this->isApprovedRider($user)) {
            return false;
        }

        return $order->rider_id === $user->rider?->id
            || ($order->rider_id === null && $order->status === 'finding_rider');
    }
}
