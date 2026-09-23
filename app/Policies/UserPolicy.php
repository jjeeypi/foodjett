<?php

namespace App\Policies;

use App\Models\User;

class UserPolicy extends Policy
{
    public function viewAny(User $user): bool
    {
        return $user->isAdmin();
    }

    public function view(User $user, User $target): bool
    {
        return $user->is($target);
    }

    public function update(User $user, User $target): bool
    {
        return $user->is($target);
    }

    public function createAdmin(User $user): bool
    {
        return $user->isAdmin();
    }

    public function updateAdminStatus(User $user, User $target): bool
    {
        return $user->isAdmin() && $target->isAdmin();
    }

    public function delete(User $user, User $target): bool
    {
        return $user->is($target);
    }
}
