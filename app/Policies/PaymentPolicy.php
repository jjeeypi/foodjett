<?php

namespace App\Policies;

use App\Models\Payment;
use App\Models\User;

class PaymentPolicy extends Policy
{
    public function viewAny(User $user): bool
    {
        return $user->isCustomer() || $user->isRestaurant();
    }

    public function view(User $user, Payment $payment): bool
    {
        return $this->canAccessOrder($user, $payment->order);
    }

    public function update(User $user, Payment $payment): bool
    {
        return false;
    }

    public function delete(User $user, Payment $payment): bool
    {
        return false;
    }
}
