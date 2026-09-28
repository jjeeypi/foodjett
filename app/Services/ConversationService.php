<?php

namespace App\Services;

use App\Events\UserUnreadMessagesUpdated;
use App\Models\Conversation;
use App\Models\Message;
use App\Models\Order;
use App\Models\PlatformSetting;
use App\Models\User;
use Illuminate\Support\Carbon;
use InvalidArgumentException;

class ConversationService
{
    /** @var list<string> */
    private const RESTAURANT_CONVERSATION_STATUSES = [
        'accepted',
        'preparing',
        'ready',
        'finding_rider',
        'rider_assigned',
        'at_restaurant',
        'picked_up',
        'on_the_way',
        'arrived',
        'delivered',
        'cancelled_by_restaurant',
        'cancelled_no_rider',
        'failed_delivery',
    ];

    public function forOrder(Order $order, string $type): Conversation
    {
        if (! in_array($type, Conversation::TYPES, true)) {
            throw new InvalidArgumentException("Unsupported conversation type [{$type}].");
        }

        return Conversation::query()->firstOrCreate([
            'order_id' => $order->id,
            'type' => $type,
        ]);
    }

    public function handleStatusChange(Order $order, string $previousStatus): void
    {
        if ($order->status === 'accepted' && $previousStatus !== 'accepted') {
            $this->forOrder($order, Conversation::CUSTOMER_RESTAURANT);
        }

        if ($order->status === 'rider_assigned' && $previousStatus !== 'rider_assigned') {
            $this->forOrder($order, Conversation::CUSTOMER_RIDER);
        }

        if ($order->isTerminal()) {
            $this->scheduleClosure($order);
        }
    }

    /** Backfill or synchronize conversations for orders created before chat was added. */
    public function syncForOrder(Order $order): void
    {
        $hasAcceptedHistory = $order->statusHistory()
            ->where('status', 'accepted')
            ->exists();

        if (
            $order->accepted_at !== null
            || $hasAcceptedHistory
            || in_array($order->status, self::RESTAURANT_CONVERSATION_STATUSES, true)
        ) {
            $this->forOrder($order, Conversation::CUSTOMER_RESTAURANT);
        }

        if ($order->rider_id !== null) {
            $this->forOrder($order, Conversation::CUSTOMER_RIDER);
        }

        if ($order->isTerminal()) {
            $this->scheduleClosure($order);
        }
    }

    public function scheduleClosure(Order $order): void
    {
        $finishedAt = $order->delivered_at ?? $order->updated_at ?? now();
        $closeAt = Carbon::parse($finishedAt)->addMinutes(
            PlatformSetting::getInt('chat_close_after_minutes', 30),
        );

        $order->conversations()
            ->whereNull('closed_at')
            ->update(['closed_at' => $closeAt]);
    }

    public function unreadCountFor(User $user): int
    {
        $query = Message::query()
            ->whereNull('read_at')
            ->where('sender_user_id', '!=', $user->id);

        if ($user->isCustomer() && $user->customer !== null) {
            $query->whereHas(
                'conversation.order',
                fn ($orders) => $orders->where('customer_id', $user->customer->id),
            );
        } elseif ($user->isRestaurant() && $user->restaurant !== null) {
            $query->whereHas('conversation', function ($conversations) use ($user): void {
                $conversations
                    ->where('type', Conversation::CUSTOMER_RESTAURANT)
                    ->whereHas(
                        'order',
                        fn ($orders) => $orders->where('restaurant_id', $user->restaurant->id),
                    );
            });
        } elseif ($user->isRider() && $user->rider !== null) {
            $query->whereHas('conversation', function ($conversations) use ($user): void {
                $conversations
                    ->where('type', Conversation::CUSTOMER_RIDER)
                    ->whereHas(
                        'order',
                        fn ($orders) => $orders->where('rider_id', $user->rider->id),
                    );
            });
        } else {
            return 0;
        }

        return $query->count();
    }

    public function unreadCountForConversation(Conversation $conversation, User $user): int
    {
        return $conversation->messages()
            ->whereNull('read_at')
            ->where('sender_user_id', '!=', $user->id)
            ->count();
    }

    public function markRead(Conversation $conversation, User $user): int
    {
        $updated = $conversation->messages()
            ->whereNull('read_at')
            ->where('sender_user_id', '!=', $user->id)
            ->update(['read_at' => now()]);

        UserUnreadMessagesUpdated::dispatch(
            $user,
            $conversation,
            $this->unreadCountFor($user),
            0,
        );

        return $updated;
    }

    public function notifyCounterpart(Conversation $conversation, Message $message): void
    {
        $counterpart = $this->counterpartUser($conversation, $message->sender_user_id);

        if ($counterpart === null) {
            return;
        }

        UserUnreadMessagesUpdated::dispatch(
            $counterpart,
            $conversation,
            $this->unreadCountFor($counterpart),
            $this->unreadCountForConversation($conversation, $counterpart),
            $message,
        );
    }

    /** @return list<int> */
    public function participantUserIds(Conversation $conversation): array
    {
        $conversation->loadMissing([
            'order.customer:id,user_id',
            'order.restaurant:id,user_id',
            'order.rider:id,user_id',
        ]);

        $ids = [$conversation->order->customer->user_id];

        if ($conversation->type === Conversation::CUSTOMER_RESTAURANT) {
            $ids[] = $conversation->order->restaurant->user_id;
        } elseif ($conversation->order->rider !== null) {
            $ids[] = $conversation->order->rider->user_id;
        }

        return array_values(array_unique($ids));
    }

    public function counterpartUser(Conversation $conversation, int $senderUserId): ?User
    {
        $counterpartId = collect($this->participantUserIds($conversation))
            ->first(fn (int $userId): bool => $userId !== $senderUserId);

        return $counterpartId === null ? null : User::query()->find($counterpartId);
    }
}
