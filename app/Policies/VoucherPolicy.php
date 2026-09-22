<?php

namespace App\Policies;

use App\Models\User;
use App\Models\Voucher;

class VoucherPolicy extends Policy
{
    public function viewAny(User $user): bool
    {
        return $user->isRestaurant();
    }

    public function view(User $user, Voucher $voucher): bool
    {
        return $voucher->restaurant_id !== null
            && $this->ownsRestaurant($user, $voucher->restaurant_id);
    }

    public function create(User $user): bool
    {
        return $user->isRestaurant() && $user->restaurant !== null;
    }

    public function update(User $user, Voucher $voucher): bool
    {
        return $voucher->restaurant_id !== null
            && $this->ownsRestaurant($user, $voucher->restaurant_id);
    }

    public function delete(User $user, Voucher $voucher): bool
    {
        return $voucher->restaurant_id !== null
            && $this->ownsRestaurant($user, $voucher->restaurant_id);
    }
}
