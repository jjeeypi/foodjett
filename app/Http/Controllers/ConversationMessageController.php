<?php

namespace App\Http\Controllers;

use App\Events\MessageSent;
use App\Models\Conversation;
use App\Models\Message;
use App\Models\User;
use App\Services\ConversationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;

class ConversationMessageController extends Controller
{
    public function index(Conversation $conversation): JsonResponse
    {
        Gate::authorize('view', $conversation);

        return response()->json([
            'messages' => $this->messagePage($conversation),
        ]);
    }

    public function store(
        Request $request,
        Conversation $conversation,
        ConversationService $conversationService,
    ): JsonResponse {
        Gate::authorize('view', $conversation);
        $validated = $request->validate([
            'body' => ['required', 'string', 'max:1000'],
        ]);
        $user = $request->user();
        abort_unless($user instanceof User, 401);

        $message = DB::transaction(function () use (
            $conversation,
            $conversationService,
            $user,
            $validated,
        ): Message {
            $lockedConversation = Conversation::query()
                ->with('order')
                ->lockForUpdate()
                ->findOrFail($conversation->id);
            $conversationService->syncForOrder($lockedConversation->order);
            $lockedConversation->refresh();
            Gate::forUser($user)->authorize('send', $lockedConversation);

            $message = $lockedConversation->messages()->create([
                'sender_user_id' => $user->id,
                'body' => trim((string) $validated['body']),
            ]);
            $message->load('sender:id,name');

            MessageSent::dispatch($message);
            $conversationService->notifyCounterpart($lockedConversation, $message);

            return $message;
        });

        return response()->json([
            'message' => $this->serializeMessage($message),
        ], 201);
    }

    public function markRead(
        Request $request,
        Conversation $conversation,
        ConversationService $conversationService,
    ): JsonResponse {
        Gate::authorize('view', $conversation);
        $user = $request->user();
        abort_unless($user instanceof User, 401);

        return response()->json([
            'marked_read' => $conversationService->markRead($conversation, $user),
            'unread_count' => $conversationService->unreadCountFor($user),
        ]);
    }

    /** @return array{data: mixed, next_page_url: string|null} */
    private function messagePage(Conversation $conversation): array
    {
        $paginator = $conversation->messages()
            ->with('sender:id,name')
            ->latest('created_at')
            ->latest('id')
            ->paginate(30)
            ->withQueryString();

        return [
            'data' => $paginator->getCollection()
                ->reverse()
                ->values()
                ->map(fn (Message $message): array => $this->serializeMessage($message)),
            'next_page_url' => $paginator->nextPageUrl(),
        ];
    }

    /** @return array{id: int, conversation_id: int, sender_id: int, sender_name: string, body: string, created_at: string} */
    private function serializeMessage(Message $message): array
    {
        $message->loadMissing('sender:id,name');

        return [
            'id' => $message->id,
            'conversation_id' => $message->conversation_id,
            'sender_id' => $message->sender_user_id,
            'sender_name' => $message->sender->name,
            'body' => $message->body,
            'created_at' => Carbon::parse($message->created_at)->toIso8601String(),
        ];
    }
}
