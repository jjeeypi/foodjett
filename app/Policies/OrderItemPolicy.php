<?php

namespace App\Policies;

use App\Models\OrderItem;
use App\Models\User;

class OrderItemPolicy extends Policy
{
    public function viewAny(User $user): bool
    {
        return $user->hasRole('restaurant', 'rider', 'customer');
    }

    public function view(User $user, OrderItem $item): bool
    {
        return $this->canAccessOrder($user, $item->order);
    }

    public function update(User $user, OrderItem $item): bool
    {
        return false;
    }

    public function delete(User $user, OrderItem $item): bool
    {
        return false;
    }
}
