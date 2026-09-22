<?php

namespace App\Policies;

use App\Models\RiderDocument;
use App\Models\User;

class RiderDocumentPolicy extends Policy
{
    public function viewAny(User $user): bool
    {
        return $user->isRider();
    }

    public function view(User $user, RiderDocument $document): bool
    {
        return $this->ownsRider($user, $document->rider_id);
    }

    public function create(User $user): bool
    {
        return $user->isRider() && $user->rider !== null;
    }

    public function update(User $user, RiderDocument $document): bool
    {
        return $this->ownsRider($user, $document->rider_id);
    }

    public function delete(User $user, RiderDocument $document): bool
    {
        return $this->ownsRider($user, $document->rider_id);
    }
}
