<?php

namespace App\Policies;

use App\Models\PlatformSetting;
use App\Models\User;

class PlatformSettingPolicy extends Policy
{
    public function view(User $user, PlatformSetting $setting): bool
    {
        return false;
    }

    public function update(User $user, PlatformSetting $setting): bool
    {
        return false;
    }

    public function delete(User $user, PlatformSetting $setting): bool
    {
        return false;
    }
}
