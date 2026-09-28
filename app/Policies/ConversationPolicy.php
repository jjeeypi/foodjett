<?php

namespace App\Policies;

use App\Models\Conversation;
use App\Models\User;

class ConversationPolicy
{
    public function view(User $user, Conversation $conversation): bool
    {
        if ($user->isAdmin()) {
            return true;
        }

        $conversation->loadMissing('order');
        $order = $conversation->order;

        if ($user->isCustomer()) {
            return $user->customer?->id === $order->customer_id;
        }

        if ($conversation->type === Conversation::CUSTOMER_RESTAURANT && $user->isRestaurant()) {
            return $user->restaurant?->id === $order->restaurant_id;
        }

        if ($conversation->type === Conversation::CUSTOMER_RIDER && $user->isRider()) {
            return $user->rider?->id === $order->rider_id;
        }

        return false;
    }

    public function send(User $user, Conversation $conversation): bool
    {
        return ! $user->isAdmin()
            && $this->view($user, $conversation)
            && ! $conversation->isClosed();
    }
}
