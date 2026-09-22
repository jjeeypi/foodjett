<?php

namespace App\Policies;

use App\Models\User;

class UserPolicy extends Policy
{
    public function view(User $user, User $target): bool
    {
        return $user->is($target);
    }

    public function update(User $user, User $target): bool
    {
        return $user->is($target);
    }

    public function delete(User $user, User $target): bool
    {
        return $user->is($target);
    }
}
