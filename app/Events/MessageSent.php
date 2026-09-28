<?php

namespace App\Events;

use App\Models\Message;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Support\Carbon;

class MessageSent implements ShouldBroadcast, ShouldDispatchAfterCommit
{
    use Dispatchable, InteractsWithSockets;

    public readonly int $id;

    public readonly int $conversation_id;

    public readonly int $sender_id;

    public readonly string $sender_name;

    public readonly string $body;

    public readonly string $created_at;

    public function __construct(Message $message)
    {
        $message->loadMissing('sender:id,name');

        $this->id = $message->id;
        $this->conversation_id = $message->conversation_id;
        $this->sender_id = $message->sender_user_id;
        $this->sender_name = $message->sender->name;
        $this->body = $message->body;
        $this->created_at = Carbon::parse($message->created_at)->toIso8601String();
    }

    /** @return array<int, PrivateChannel> */
    public function broadcastOn(): array
    {
        return [new PrivateChannel("conversation.{$this->conversation_id}")];
    }

    public function broadcastAs(): string
    {
        return 'message.sent';
    }

    /** @return array<string, int|string> */
    public function broadcastWith(): array
    {
        return [
            'id' => $this->id,
            'conversation_id' => $this->conversation_id,
            'sender_id' => $this->sender_id,
            'sender_name' => $this->sender_name,
            'body' => $this->body,
            'created_at' => $this->created_at,
        ];
    }
}
