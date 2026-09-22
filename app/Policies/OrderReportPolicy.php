<?php

namespace App\Policies;

use App\Models\OrderReport;
use App\Models\User;

class OrderReportPolicy extends Policy
{
    public function viewAny(User $user): bool
    {
        return $user->hasRole('restaurant', 'rider', 'customer');
    }

    public function view(User $user, OrderReport $report): bool
    {
        return $report->reported_by_user_id === $user->id
            || $this->canAccessOrder($user, $report->order);
    }

    public function create(User $user): bool
    {
        return $user->hasRole('restaurant', 'rider', 'customer');
    }

    public function update(User $user, OrderReport $report): bool
    {
        return false;
    }

    public function delete(User $user, OrderReport $report): bool
    {
        return $report->reported_by_user_id === $user->id && $report->status === 'open';
    }
}
