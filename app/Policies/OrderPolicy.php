<?php

namespace App\Policies;

use App\Models\Order;
use App\Models\User;

class OrderPolicy extends Policy
{
    public function viewAny(User $user): bool
    {
        return $user->hasRole('restaurant', 'rider', 'customer');
    }

    public function view(User $user, Order $order): bool
    {
        return $this->canAccessOrder($user, $order);
    }

    public function create(User $user): bool
    {
        return $user->isCustomer() && $user->customer !== null;
    }

    public function update(User $user, Order $order): bool
    {
        return false;
    }

    public function updateAsRestaurant(User $user, Order $order): bool
    {
        return $this->ownsRestaurant($user, $order->restaurant_id);
    }

    public function updateAsRider(User $user, Order $order): bool
    {
        if (! $this->isApprovedRider($user)) {
            return false;
        }

        if ($order->rider_id === null) {
            return $order->status === 'finding_rider';
        }

        return $order->rider_id === $user->rider?->id;
    }

    public function cancel(User $user, Order $order): bool
    {
        return $this->ownsCustomer($user, $order->customer_id);
    }

    public function delete(User $user, Order $order): bool
    {
        return false;
    }
}
