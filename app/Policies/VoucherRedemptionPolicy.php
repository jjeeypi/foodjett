<?php

namespace App\Policies;

use App\Models\User;
use App\Models\VoucherRedemption;

class VoucherRedemptionPolicy extends Policy
{
    public function viewAny(User $user): bool
    {
        return $user->isCustomer() || $user->isRestaurant();
    }

    public function view(User $user, VoucherRedemption $redemption): bool
    {
        if ($this->ownsCustomer($user, $redemption->customer_id)) {
            return true;
        }

        return $redemption->voucher->restaurant_id !== null
            && $this->ownsRestaurant($user, $redemption->voucher->restaurant_id);
    }

    public function update(User $user, VoucherRedemption $redemption): bool
    {
        return false;
    }

    public function delete(User $user, VoucherRedemption $redemption): bool
    {
        return false;
    }
}
