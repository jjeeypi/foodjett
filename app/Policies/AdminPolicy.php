<?php

namespace App\Policies;

use App\Models\Admin;
use App\Models\User;

class AdminPolicy extends Policy
{
    public function view(User $user, Admin $admin): bool
    {
        return $admin->user_id === $user->id;
    }

    public function update(User $user, Admin $admin): bool
    {
        return $admin->user_id === $user->id;
    }

    public function delete(User $user, Admin $admin): bool
    {
        return false;
    }
}
