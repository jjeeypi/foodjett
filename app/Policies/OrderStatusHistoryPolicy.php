<?php

namespace App\Policies;

use App\Models\OrderStatusHistory;
use App\Models\User;

class OrderStatusHistoryPolicy extends Policy
{
    public function viewAny(User $user): bool
    {
        return $user->hasRole('restaurant', 'rider', 'customer');
    }

    public function view(User $user, OrderStatusHistory $history): bool
    {
        return $this->canAccessOrder($user, $history->order);
    }

    public function update(User $user, OrderStatusHistory $history): bool
    {
        return false;
    }

    public function delete(User $user, OrderStatusHistory $history): bool
    {
        return false;
    }
}
