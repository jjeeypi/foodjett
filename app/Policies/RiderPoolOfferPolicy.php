<?php

namespace App\Policies;

use App\Models\RiderPoolOffer;
use App\Models\User;

class RiderPoolOfferPolicy extends Policy
{
    public function viewAny(User $user): bool
    {
        return $this->isApprovedRider($user);
    }

    public function view(User $user, RiderPoolOffer $offer): bool
    {
        return $this->canAccessOrder($user, $offer->order);
    }

    public function update(User $user, RiderPoolOffer $offer): bool
    {
        return app(OrderPolicy::class)->updateAsRider($user, $offer->order);
    }

    public function delete(User $user, RiderPoolOffer $offer): bool
    {
        return false;
    }
}
