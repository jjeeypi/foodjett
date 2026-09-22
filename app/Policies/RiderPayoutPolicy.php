<?php

namespace App\Policies;

use App\Models\RiderPayout;
use App\Models\User;

class RiderPayoutPolicy extends Policy
{
    public function viewAny(User $user): bool
    {
        return $user->isRider();
    }

    public function view(User $user, RiderPayout $payout): bool
    {
        return $this->ownsRider($user, $payout->rider_id);
    }

    public function update(User $user, RiderPayout $payout): bool
    {
        return false;
    }

    public function delete(User $user, RiderPayout $payout): bool
    {
        return false;
    }
}
