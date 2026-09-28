<?php

namespace App\Http\Controllers\Customer;

use App\Events\MessageSent;
use App\Http\Controllers\Controller;
use App\Models\Conversation;
use App\Models\Message;
use App\Models\Order;
use App\Models\User;
use App\Services\ConversationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class MessageController extends Controller
{
    public function index(Request $request, ConversationService $conversationService): Response
    {
        return $this->renderInbox($request, $conversationService);
    }

    public function show(
        Request $request,
        Conversation $conversation,
        ConversationService $conversationService,
    ): Response|JsonResponse {
        Gate::authorize('view', $conversation);
        $conversation->loadMissing('order');
        $conversationService->syncForOrder($conversation->order);
        $conversation->refresh();

        $messages = $this->messagePage($conversation);

        if ($request->expectsJson()) {
            return response()->json(['messages' => $messages]);
        }

        return $this->renderInbox($request, $conversationService, $conversation, $messages);
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

        $updated = $conversationService->markRead($conversation, $user);

        return response()->json([
            'marked_read' => $updated,
            'unread_count' => $conversationService->unreadCountFor($user),
        ]);
    }

    /** @param array{data: mixed, next_page_url: string|null}|null $messages */
    private function renderInbox(
        Request $request,
        ConversationService $conversationService,
        ?Conversation $selectedConversation = null,
        ?array $messages = null,
    ): Response {
        $user = $request->user();
        abort_unless($user instanceof User && $user->customer !== null, 403);

        Order::query()
            ->where('customer_id', $user->customer->id)
            ->select([
                'id', 'customer_id', 'restaurant_id', 'rider_id', 'status',
                'accepted_at', 'delivered_at', 'updated_at',
            ])
            ->each(fn (Order $order) => $conversationService->syncForOrder($order));

        $conversations = Conversation::query()
            ->whereHas(
                'order',
                fn ($orders) => $orders->where('customer_id', $user->customer->id),
            )
            ->with([
                'latestMessage.sender:id,name',
                'order:id,order_number,restaurant_id,rider_id',
                'order.restaurant:id,name,logo_path',
                'order.rider:id,user_id',
                'order.rider.user:id,name,avatar_path',
            ])
            ->withCount([
                'messages as unread_count' => fn ($query) => $query
                    ->whereNull('read_at')
                    ->where('sender_user_id', '!=', $user->id),
            ])
            ->withMax('messages', 'created_at')
            ->orderByDesc('messages_max_created_at')
            ->orderByDesc('created_at')
            ->get()
            ->map(fn (Conversation $conversation): array => $this->serializeConversation($conversation))
            ->values();

        return Inertia::render('customer/messages/index', [
            'conversations' => $conversations,
            'selectedConversation' => $selectedConversation === null
                ? null
                : $this->serializeConversation(
                    $selectedConversation->load([
                        'order:id,order_number,restaurant_id,rider_id',
                        'order.restaurant:id,name,logo_path',
                        'order.rider:id,user_id',
                        'order.rider.user:id,name,avatar_path',
                    ]),
                ),
            'messages' => $messages,
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

        $data = $paginator->getCollection()
            ->reverse()
            ->values()
            ->map(fn (Message $message): array => $this->serializeMessage($message));

        return [
            'data' => $data,
            'next_page_url' => $paginator->nextPageUrl(),
        ];
    }

    /** @return array<string, mixed> */
    private function serializeConversation(Conversation $conversation): array
    {
        $counterpart = $conversation->type === Conversation::CUSTOMER_RESTAURANT
            ? [
                'name' => $conversation->order->restaurant->name,
                'avatar_url' => $this->publicUrl($conversation->order->restaurant->logo_path),
            ]
            : [
                'name' => $conversation->order->rider?->user->name ?? 'Rider unavailable',
                'avatar_url' => $this->publicUrl($conversation->order->rider?->user->avatar_path),
            ];

        return [
            'id' => $conversation->id,
            'type' => $conversation->type,
            'order' => [
                'id' => $conversation->order->id,
                'order_number' => $conversation->order->order_number,
                'restaurant_name' => $conversation->order->restaurant->name,
            ],
            'counterpart' => $counterpart,
            'last_message' => $conversation->latestMessage === null ? null : [
                'body' => $conversation->latestMessage->body,
                'sender_name' => $conversation->latestMessage->sender->name,
                'created_at' => Carbon::parse($conversation->latestMessage->created_at)->toIso8601String(),
            ],
            'unread_count' => (int) $conversation->getAttribute('unread_count'),
            'is_closed' => $conversation->isClosed(),
            'closed_at' => $conversation->closed_at?->toIso8601String(),
            'show_url' => route('customer.messages.show', $conversation, absolute: false),
            'send_url' => route('customer.messages.store', $conversation, absolute: false),
            'mark_read_url' => route('customer.messages.read', $conversation, absolute: false),
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

    private function publicUrl(?string $path): ?string
    {
        return $path === null ? null : asset('storage/'.$path);
    }
}
