<?php

namespace App\Policies;

use App\Models\RiderCashRemittance;
use App\Models\User;

class RiderCashRemittancePolicy extends Policy
{
    public function viewAny(User $user): bool
    {
        return $user->isRider();
    }

    public function view(User $user, RiderCashRemittance $remittance): bool
    {
        return $this->ownsRider($user, $remittance->rider_id);
    }

    public function create(User $user): bool
    {
        return $user->isRider() && $user->rider !== null;
    }

    public function update(User $user, RiderCashRemittance $remittance): bool
    {
        return false;
    }

    public function delete(User $user, RiderCashRemittance $remittance): bool
    {
        return false;
    }
}
