<?php

namespace App\Http\Controllers\Rider;

use App\Actions\Orders\RecordRiderEarning;
use App\Actions\Orders\TransitionOrderStatus;
use App\Actions\Payments\RecordPaymentStatus;
use App\Http\Controllers\Controller;
use App\Models\Conversation;
use App\Models\Message;
use App\Models\Order;
use App\Models\OrderReport;
use App\Models\Payment;
use App\Models\PlatformSetting;
use App\Models\Rider;
use App\Services\ConversationService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;
use RuntimeException;
use Throwable;

class ActiveOrderController extends Controller
{
    /** @var array<string, string> */
    private const NEXT_STATUS = [
        'rider_assigned' => 'at_restaurant',
        'at_restaurant' => 'picked_up',
        'picked_up' => 'on_the_way',
        'on_the_way' => 'arrived',
        'arrived' => 'delivered',
    ];

    /** @var array<string, array{against: string, type: string, label: string}> */
    private const ISSUE_TYPES = [
        'restaurant_delay' => ['against' => 'restaurant', 'type' => 'late_delivery', 'label' => 'Restaurant delay'],
        'missing_item' => ['against' => 'restaurant', 'type' => 'missing_item', 'label' => 'Missing item'],
        'wrong_item' => ['against' => 'restaurant', 'type' => 'wrong_item', 'label' => 'Wrong item'],
        'spilled_food' => ['against' => 'restaurant', 'type' => 'other', 'label' => 'Spilled food'],
        'accident' => ['against' => 'platform', 'type' => 'accident', 'label' => 'Accident'],
        'unsafe_location' => ['against' => 'customer', 'type' => 'other', 'label' => 'Unsafe location'],
        'customer_unreachable' => ['against' => 'customer', 'type' => 'customer_unreachable', 'label' => 'Customer unreachable'],
    ];

    public function show(Request $request, ConversationService $conversationService): Response
    {
        $rider = $request->user()?->rider;
        abort_unless($rider !== null, 403);

        $order = $this->activeOrderQuery($rider)
            ->with([
                'restaurant:id,name,address,latitude,longitude',
                'customer.user:id,name,phone,avatar_path',
                'deliveryAddress:id,label,address_line,landmark,delivery_instructions,latitude,longitude',
                'items.menuItem:id,name',
                'items.variant:id,name',
                'items.addons.addon:id,name',
                'payment:id,order_id,status,amount',
                'poolOffer:id,order_id,incentive_amount',
            ])
            ->oldest('rider_assigned_at')
            ->first();

        if ($order === null) {
            return Inertia::render('rider/active', [
                'order' => null,
                'conversation' => null,
                'messages' => null,
                'waitingCompensationThresholdMinutes' => PlatformSetting::getInt(
                    'rider_waiting_compensation_threshold_minutes',
                    5,
                ),
            ]);
        }

        $conversationService->syncForOrder($order);
        $conversation = $order->conversations()
            ->where('type', Conversation::CUSTOMER_RIDER)
            ->first();

        return Inertia::render('rider/active', [
            'order' => $this->serializeOrder($order, $rider),
            'conversation' => $conversation === null
                ? null
                : $this->serializeConversation($conversation, $order),
            'messages' => $conversation === null ? null : $this->messagePage($conversation),
            'waitingCompensationThresholdMinutes' => PlatformSetting::getInt(
                'rider_waiting_compensation_threshold_minutes',
                5,
            ),
        ]);
    }

    public function advanceStatus(
        Request $request,
        TransitionOrderStatus $transition,
        RecordPaymentStatus $paymentStatus,
        RecordRiderEarning $recordEarning,
    ): RedirectResponse {
        $validated = $request->validate([
            'next_status' => ['required', Rule::in(array_values(self::NEXT_STATUS))],
            'pickup_code' => ['nullable', 'string', 'max:20'],
            'proof_of_delivery' => ['nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:10240'],
            'cash_collected' => ['nullable', 'boolean'],
        ]);
        $rider = $request->user()?->rider;
        abort_unless($rider !== null, 403);
        $proofPath = null;

        try {
            DB::transaction(function () use (
                $request,
                $validated,
                $rider,
                $transition,
                $paymentStatus,
                $recordEarning,
                &$proofPath,
            ): void {
                $order = $this->lockedActiveOrder($rider);
                Gate::authorize('updateAsRider', $order);
                $expected = self::NEXT_STATUS[$order->status] ?? null;

                if ($expected !== $validated['next_status']) {
                    throw ValidationException::withMessages([
                        'next_status' => 'Complete the current delivery step before moving forward.',
                    ]);
                }

                $attributes = [];
                $note = null;

                if ($expected === 'at_restaurant') {
                    $attributes['rider_arrived_restaurant_at'] = now();
                    $note = 'Rider arrived at the restaurant.';
                } elseif ($expected === 'picked_up') {
                    $pickupCode = strtoupper(trim((string) ($validated['pickup_code'] ?? '')));
                    if ($pickupCode === '' || $order->pickup_code === null
                        || ! hash_equals(strtoupper($order->pickup_code), $pickupCode)) {
                        throw ValidationException::withMessages([
                            'pickup_code' => 'The pickup code is incorrect.',
                        ]);
                    }
                    $attributes['picked_up_at'] = now();
                    $note = 'Restaurant pickup code confirmed.';
                } elseif ($expected === 'on_the_way') {
                    $note = 'Rider started the delivery.';
                } elseif ($expected === 'arrived') {
                    $note = 'Rider arrived at the customer address.';
                } elseif ($expected === 'delivered') {
                    $proof = $request->file('proof_of_delivery');
                    if ($proof === null) {
                        throw ValidationException::withMessages([
                            'proof_of_delivery' => 'Add a delivery photo before confirming receipt.',
                        ]);
                    }

                    $stored = $proof->store("proofs/orders/{$order->id}", 'public');
                    if (! is_string($stored)) {
                        throw new RuntimeException('The proof of delivery photo could not be stored.');
                    }
                    $proofPath = $stored;

                    $lockedRider = Rider::query()->lockForUpdate()->findOrFail($rider->id);
                    if ($order->payment_method === 'cod') {
                        if (! filter_var($validated['cash_collected'] ?? false, FILTER_VALIDATE_BOOL)) {
                            throw ValidationException::withMessages([
                                'cash_collected' => 'Confirm that cash was collected before completing this COD order.',
                            ]);
                        }

                        $payment = Payment::query()
                            ->where('order_id', $order->id)
                            ->lockForUpdate()
                            ->firstOrFail();
                        $paymentStatus->transition(
                            $payment,
                            'paid',
                            'rider',
                            'Rider confirmed cash collection on delivery.',
                        );
                        $lockedRider->increment('cash_on_hand', (float) $order->total_amount);
                    }

                    $attributes = [
                        'delivered_at' => now(),
                        'proof_of_delivery_path' => $proofPath,
                    ];
                    $recordEarning->handle($order);
                    $note = $order->payment_method === 'cod'
                        ? 'Delivery photo saved and cash collected.'
                        : 'Delivery photo saved and customer receipt confirmed.';
                }

                $transition->handle($order, $expected, 'rider', $note, $attributes);
            });
        } catch (Throwable $exception) {
            if ($proofPath !== null) {
                Storage::disk('public')->delete($proofPath);
            }

            throw $exception;
        }

        return back()->with('success', 'Delivery status updated.');
    }

    public function reportIssue(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'issue_type' => ['required', Rule::in(array_keys(self::ISSUE_TYPES))],
            'description' => ['required', 'string', 'max:2000'],
        ]);
        $rider = $request->user()?->rider;
        abort_unless($rider !== null, 403);

        DB::transaction(function () use ($request, $validated, $rider): void {
            $order = $this->lockedActiveOrder($rider);
            Gate::authorize('updateAsRider', $order);
            Gate::authorize('create', OrderReport::class);
            $issue = self::ISSUE_TYPES[$validated['issue_type']];

            OrderReport::query()->create([
                'order_id' => $order->id,
                'reported_by_user_id' => $request->user()->id,
                'against' => $issue['against'],
                'type' => $issue['type'],
                'description' => "{$issue['label']}: ".trim((string) $validated['description']),
                'status' => 'open',
            ]);
        });

        return back()->with('success', 'Issue reported to the admin team.');
    }

    public function failDelivery(
        Request $request,
        TransitionOrderStatus $transition,
    ): RedirectResponse {
        $validated = $request->validate([
            'reason' => ['required', 'string', 'max:1000'],
        ]);
        $rider = $request->user()?->rider;
        abort_unless($rider !== null, 403);

        DB::transaction(function () use ($request, $validated, $rider, $transition): void {
            $order = $this->lockedActiveOrder($rider);
            Gate::authorize('updateAsRider', $order);
            Gate::authorize('create', OrderReport::class);

            if ($order->status !== 'arrived') {
                throw ValidationException::withMessages([
                    'reason' => 'You can only report an unreachable customer after arriving.',
                ]);
            }

            $waitMinutes = PlatformSetting::getInt('rider_customer_unreachable_wait_minutes', 5);
            if ($order->updated_at?->copy()->addMinutes($waitMinutes)->isFuture()) {
                throw ValidationException::withMessages([
                    'reason' => "Wait {$waitMinutes} minutes after arrival before marking this delivery failed.",
                ]);
            }

            OrderReport::query()->create([
                'order_id' => $order->id,
                'reported_by_user_id' => $request->user()->id,
                'against' => 'customer',
                'type' => 'customer_unreachable',
                'description' => trim((string) $validated['reason']),
                'status' => 'open',
            ]);
            $transition->handle(
                $order,
                'failed_delivery',
                'rider',
                'Customer unreachable after the required wait.',
                [
                    'cancellation_reason' => trim((string) $validated['reason']),
                    'cancelled_by' => 'rider',
                ],
            );
        });

        return to_route('rider.active')->with('success', 'Failed delivery recorded for admin follow-up.');
    }

    public function cancel(
        Request $request,
        TransitionOrderStatus $transition,
    ): RedirectResponse {
        $validated = $request->validate([
            'reason' => ['required', 'string', 'max:1000'],
        ]);
        $rider = $request->user()?->rider;
        abort_unless($rider !== null, 403);

        DB::transaction(function () use ($validated, $rider, $transition): void {
            $order = $this->lockedActiveOrder($rider);
            Gate::authorize('updateAsRider', $order);

            if (! in_array($order->status, ['rider_assigned', 'at_restaurant'], true)) {
                throw ValidationException::withMessages([
                    'reason' => 'A rider can only cancel before confirming pickup.',
                ]);
            }

            // TODO: Apply rider cancellation cooldowns or penalties when those rules are defined.
            $transition->handle(
                $order,
                'failed_delivery',
                'rider',
                'Rider cancelled before pickup: '.trim((string) $validated['reason']),
                [
                    'cancellation_reason' => trim((string) $validated['reason']),
                    'cancelled_by' => 'rider',
                ],
            );
        });

        return to_route('rider.active')->with('success', 'Rider cancellation recorded.');
    }

    /** @return Builder<Order> */
    private function activeOrderQuery(Rider $rider): Builder
    {
        return Order::query()
            ->where('rider_id', $rider->id)
            ->whereNotIn('status', Order::TERMINAL_STATUSES);
    }

    private function lockedActiveOrder(Rider $rider): Order
    {
        $order = $this->activeOrderQuery($rider)
            ->lockForUpdate()
            ->oldest('rider_assigned_at')
            ->first();

        if ($order === null) {
            throw ValidationException::withMessages([
                'order' => 'You do not have an active delivery.',
            ]);
        }

        return $order;
    }

    /** @return array<string, mixed> */
    private function serializeOrder(Order $order, Rider $rider): array
    {
        $unreachableWaitMinutes = PlatformSetting::getInt(
            'rider_customer_unreachable_wait_minutes',
            5,
        );

        return [
            'id' => $order->id,
            'order_number' => $order->order_number,
            'status' => $order->status,
            'restaurant' => [
                'name' => $order->restaurant->name,
                'address' => $order->restaurant->address,
                'latitude' => (float) $order->restaurant->latitude,
                'longitude' => (float) $order->restaurant->longitude,
            ],
            'customer' => [
                'name' => $order->customer->user->name,
                'phone' => $order->customer->user->phone,
            ],
            'delivery_address' => [
                'label' => $order->deliveryAddress->label,
                'address_line' => $order->deliveryAddress->address_line,
                'landmark' => $order->deliveryAddress->landmark,
                'delivery_instructions' => $order->deliveryAddress->delivery_instructions,
                'latitude' => (float) $order->deliveryAddress->latitude,
                'longitude' => (float) $order->deliveryAddress->longitude,
            ],
            'items' => $order->items->map(fn ($item): array => [
                'id' => $item->id,
                'name' => $item->menuItem->name,
                'variant' => $item->variant?->name,
                'quantity' => $item->quantity,
                'special_instructions' => $item->special_instructions,
                'addons' => $item->addons->map(fn ($addon): array => [
                    'name' => $addon->addon->name,
                ])->values(),
            ])->values(),
            'customer_notes' => $order->customer_notes,
            'payment_method' => $order->payment_method,
            'cash_to_collect' => $order->payment_method === 'cod'
                ? (float) $order->total_amount
                : null,
            'estimated_ready_at' => $order->estimated_ready_at?->toIso8601String(),
            'rider_arrived_restaurant_at' => $order->rider_arrived_restaurant_at?->toIso8601String(),
            'unreachable_available_at' => $order->status === 'arrived'
                ? $order->updated_at?->copy()->addMinutes($unreachableWaitMinutes)->toIso8601String()
                : null,
            'can_cancel' => in_array($order->status, ['rider_assigned', 'at_restaurant'], true),
            'rider_location' => $rider->current_latitude === null || $rider->current_longitude === null
                ? null
                : [
                    'latitude' => (float) $rider->current_latitude,
                    'longitude' => (float) $rider->current_longitude,
                    'timestamp' => $rider->last_location_at?->toIso8601String() ?? now()->toIso8601String(),
                ],
        ];
    }

    /** @return array<string, mixed> */
    private function serializeConversation(Conversation $conversation, Order $order): array
    {
        return [
            'id' => $conversation->id,
            'type' => $conversation->type,
            'order' => [
                'id' => $order->id,
                'order_number' => $order->order_number,
                'restaurant_name' => $order->restaurant->name,
            ],
            'counterpart' => [
                'name' => $order->customer->user->name,
                'avatar_url' => $order->customer->user->avatar,
            ],
            'unread_count' => 0,
            'is_closed' => $conversation->isClosed(),
            'closed_at' => $conversation->closed_at?->toIso8601String(),
            'show_url' => route('conversations.messages.index', $conversation, absolute: false),
            'send_url' => route('conversations.messages.store', $conversation, absolute: false),
            'mark_read_url' => route('conversations.messages.read', $conversation, absolute: false),
        ];
    }

    /** @return array{data: mixed, next_page_url: string|null} */
    private function messagePage(Conversation $conversation): array
    {
        $paginator = $conversation->messages()
            ->with('sender:id,name')
            ->latest('created_at')
            ->latest('id')
            ->paginate(30)
            ->withPath(route('conversations.messages.index', $conversation, absolute: false));

        return [
            'data' => $paginator->getCollection()
                ->reverse()
                ->values()
                ->map(fn (Message $message): array => [
                    'id' => $message->id,
                    'conversation_id' => $message->conversation_id,
                    'sender_id' => $message->sender_user_id,
                    'sender_name' => $message->sender->name,
                    'body' => $message->body,
                    'created_at' => Carbon::parse($message->created_at)->toIso8601String(),
                ]),
            'next_page_url' => $paginator->nextPageUrl(),
        ];
    }
}
