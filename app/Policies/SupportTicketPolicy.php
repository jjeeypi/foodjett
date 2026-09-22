<?php

namespace App\Policies;

use App\Models\SupportTicket;
use App\Models\User;

class SupportTicketPolicy extends Policy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, SupportTicket $ticket): bool
    {
        return $ticket->user_id === $user->id;
    }

    public function create(User $user): bool
    {
        return true;
    }

    public function update(User $user, SupportTicket $ticket): bool
    {
        return $ticket->user_id === $user->id && $ticket->status !== 'closed';
    }

    public function delete(User $user, SupportTicket $ticket): bool
    {
        return $ticket->user_id === $user->id && $ticket->status === 'open';
    }
}
