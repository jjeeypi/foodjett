<?php

namespace App\Events;

use App\Models\Conversation;
use App\Models\Message;
use App\Models\User;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Support\Carbon;

class UserUnreadMessagesUpdated implements ShouldBroadcast, ShouldDispatchAfterCommit
{
    use Dispatchable, InteractsWithSockets;

    public readonly int $user_id;

    public readonly int $conversation_id;

    public readonly int $unread_count;

    public readonly int $conversation_unread_count;

    /** @var array{id: int, conversation_id: int, sender_id: int, sender_name: string, body: string, created_at: string}|null */
    public readonly ?array $message;

    public function __construct(
        User $user,
        Conversation $conversation,
        int $unreadCount,
        int $conversationUnreadCount,
        ?Message $message = null,
    ) {
        $message?->loadMissing('sender:id,name');

        $this->user_id = $user->id;
        $this->conversation_id = $conversation->id;
        $this->unread_count = $unreadCount;
        $this->conversation_unread_count = $conversationUnreadCount;
        $this->message = $message === null ? null : [
            'id' => $message->id,
            'conversation_id' => $message->conversation_id,
            'sender_id' => $message->sender_user_id,
            'sender_name' => $message->sender->name,
            'body' => $message->body,
            'created_at' => Carbon::parse($message->created_at)->toIso8601String(),
        ];
    }

    /** @return array<int, PrivateChannel> */
    public function broadcastOn(): array
    {
        return [new PrivateChannel("user.{$this->user_id}.notifications")];
    }

    public function broadcastAs(): string
    {
        return 'messages.unread.updated';
    }

    /** @return array<string, mixed> */
    public function broadcastWith(): array
    {
        return [
            'user_id' => $this->user_id,
            'conversation_id' => $this->conversation_id,
            'unread_count' => $this->unread_count,
            'conversation_unread_count' => $this->conversation_unread_count,
            'message' => $this->message,
        ];
    }
}
