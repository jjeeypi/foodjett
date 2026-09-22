<?php

namespace App\Policies;

use App\Models\CustomerAddress;
use App\Models\User;

class CustomerAddressPolicy extends Policy
{
    public function viewAny(User $user): bool
    {
        return $user->isCustomer();
    }

    public function view(User $user, CustomerAddress $address): bool
    {
        return $this->ownsCustomer($user, $address->customer_id);
    }

    public function create(User $user): bool
    {
        return $user->isCustomer() && $user->customer !== null;
    }

    public function update(User $user, CustomerAddress $address): bool
    {
        return $this->ownsCustomer($user, $address->customer_id);
    }

    public function delete(User $user, CustomerAddress $address): bool
    {
        return $this->ownsCustomer($user, $address->customer_id);
    }
}
