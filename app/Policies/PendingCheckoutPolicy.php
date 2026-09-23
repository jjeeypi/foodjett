<?php

namespace App\Policies;

use App\Models\PendingCheckout;
use App\Models\User;

class PendingCheckoutPolicy extends Policy
{
    public function view(User $user, PendingCheckout $checkout): bool
    {
        return $this->ownsCustomer($user, $checkout->customer_id);
    }

    public function create(User $user): bool
    {
        return $user->isCustomer() && $user->customer !== null;
    }

    public function update(User $user, PendingCheckout $checkout): bool
    {
        return false;
    }

    public function delete(User $user, PendingCheckout $checkout): bool
    {
        return false;
    }
}
