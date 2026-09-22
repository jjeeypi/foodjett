<?php

namespace App\Policies;

use App\Models\OrderItemAddon;
use App\Models\User;

class OrderItemAddonPolicy extends Policy
{
    public function viewAny(User $user): bool
    {
        return $user->hasRole('restaurant', 'rider', 'customer');
    }

    public function view(User $user, OrderItemAddon $addon): bool
    {
        return $this->canAccessOrder($user, $addon->orderItem->order);
    }

    public function update(User $user, OrderItemAddon $addon): bool
    {
        return false;
    }

    public function delete(User $user, OrderItemAddon $addon): bool
    {
        return false;
    }
}
