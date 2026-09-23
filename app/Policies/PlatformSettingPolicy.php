<?php

namespace App\Policies;

use App\Models\PlatformSetting;
use App\Models\User;

class PlatformSettingPolicy extends Policy
{
    public function viewAny(User $user): bool
    {
        return $user->isAdmin();
    }

    public function view(User $user, PlatformSetting $setting): bool
    {
        return $user->isAdmin();
    }

    public function update(User $user, PlatformSetting $setting): bool
    {
        return $user->isAdmin();
    }

    public function updateAny(User $user): bool
    {
        return $user->isAdmin();
    }

    public function delete(User $user, PlatformSetting $setting): bool
    {
        return false;
    }
}
