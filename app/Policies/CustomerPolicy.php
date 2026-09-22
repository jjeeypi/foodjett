<?php

namespace App\Policies;

use App\Models\Customer;
use App\Models\User;

class CustomerPolicy extends Policy
{
    public function viewAny(User $user): bool
    {
        return $user->isCustomer();
    }

    public function view(User $user, Customer $customer): bool
    {
        return $customer->user_id === $user->id;
    }

    public function create(User $user): bool
    {
        return $user->isCustomer() && $user->customer === null;
    }

    public function update(User $user, Customer $customer): bool
    {
        return $customer->user_id === $user->id;
    }

    public function delete(User $user, Customer $customer): bool
    {
        return $customer->user_id === $user->id;
    }
}
