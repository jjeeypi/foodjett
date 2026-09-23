<?php

namespace App\Policies;

use App\Models\DeliveryZone;
use App\Models\User;

class DeliveryZonePolicy extends Policy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, DeliveryZone $deliveryZone): bool
    {
        return true;
    }

    public function create(User $user): bool
    {
        return $user->isAdmin();
    }

    public function update(User $user, DeliveryZone $deliveryZone): bool
    {
        return $user->isAdmin();
    }

    public function toggle(User $user, DeliveryZone $deliveryZone): bool
    {
        return $user->isAdmin();
    }

    public function delete(User $user, DeliveryZone $deliveryZone): bool
    {
        return $user->isAdmin();
    }
}
