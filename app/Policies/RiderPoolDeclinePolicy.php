<?php

namespace App\Policies;

use App\Models\RiderPoolDecline;
use App\Models\User;

class RiderPoolDeclinePolicy extends Policy
{
    public function viewAny(User $user): bool
    {
        return $user->isRider();
    }

    public function view(User $user, RiderPoolDecline $decline): bool
    {
        return $this->ownsRider($user, $decline->rider_id);
    }

    public function create(User $user): bool
    {
        return $this->isApprovedRider($user);
    }

    public function update(User $user, RiderPoolDecline $decline): bool
    {
        return false;
    }

    public function delete(User $user, RiderPoolDecline $decline): bool
    {
        return false;
    }
}
