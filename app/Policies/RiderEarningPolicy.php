<?php

namespace App\Policies;

use App\Models\RiderEarning;
use App\Models\User;

class RiderEarningPolicy extends Policy
{
    public function viewAny(User $user): bool
    {
        return $user->isRider();
    }

    public function view(User $user, RiderEarning $earning): bool
    {
        return $this->ownsRider($user, $earning->rider_id);
    }

    public function update(User $user, RiderEarning $earning): bool
    {
        return false;
    }

    public function delete(User $user, RiderEarning $earning): bool
    {
        return false;
    }
}
