<?php

namespace App\Policies;

use App\Models\Rider;
use App\Models\User;

class RiderPolicy extends Policy
{
    public function viewAny(User $user): bool
    {
        return $user->isRider();
    }

    public function view(User $user, Rider $rider): bool
    {
        return $rider->user_id === $user->id;
    }

    public function create(User $user): bool
    {
        return $user->isRider() && $user->rider === null;
    }

    public function update(User $user, Rider $rider): bool
    {
        return $rider->user_id === $user->id;
    }

    public function delete(User $user, Rider $rider): bool
    {
        return $rider->user_id === $user->id;
    }
}
