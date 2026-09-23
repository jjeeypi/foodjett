<?php

namespace App\Policies;

use App\Models\PaymentStatusHistory;
use App\Models\User;

class PaymentStatusHistoryPolicy extends Policy
{
    public function view(User $user, PaymentStatusHistory $history): bool
    {
        return $this->canAccessOrder($user, $history->payment->order);
    }

    public function create(User $user): bool
    {
        return false;
    }

    public function update(User $user, PaymentStatusHistory $history): bool
    {
        return false;
    }

    public function delete(User $user, PaymentStatusHistory $history): bool
    {
        return false;
    }
}
