<?php

namespace App\Http\Controllers\Customer;

use App\Actions\Orders\TransitionOrderStatus;
use App\Actions\Payments\RecordPaymentStatus;
use App\Http\Controllers\Controller;
use App\Models\Conversation;
use App\Models\Order;
use App\Models\OrderReport;
use App\Models\OrderStatusHistory;
use App\Models\Payment;
use App\Models\RestaurantReview;
use App\Models\RiderReview;
use App\Services\ConversationService;
use App\Services\CustomerCatalog;
use Illuminate\Http\JsonResponse;
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

class OrderController extends Controller
{
    public function index(Request $request): Response
    {
        Gate::authorize('viewAny', Order::class);
        $customer = $request->user()?->customer;
        abort_unless($customer !== null, 403);

        $validated = $request->validate([
            'tab' => ['nullable', Rule::in(['active', 'past'])],
        ]);
        $tab = (string) ($validated['tab'] ?? 'active');

        $orders = Order::query()
            ->where('customer_id', $customer->id)
            ->with('restaurant:id,name,logo_path')
            ->withSum('items', 'quantity')
            ->when(
                $tab === 'active',
                fn ($query) => $query->whereNotIn('status', Order::TERMINAL_STATUSES),
                fn ($query) => $query->whereIn('status', Order::TERMINAL_STATUSES),
            )
            ->latest('placed_at')
            ->paginate(10)
            ->withQueryString()
            ->through(fn (Order $order): array => [
                'id' => $order->id,
                'order_number' => $order->order_number,
                'restaurant' => [
                    'name' => $order->restaurant->name,
                    'logo_url' => $this->publicUrl($order->restaurant->logo_path),
                ],
                'placed_at' => Carbon::parse($order->placed_at)->toIso8601String(),
                'item_count' => (int) $order->getAttribute('items_sum_quantity'),
                'total_amount' => (float) $order->total_amount,
                'status' => $order->status,
                'can_reorder' => $order->status === 'delivered',
                'show_url' => route('customer.orders.show', $order, absolute: false),
            ]);

        return Inertia::render('customer/orders/index', [
            'orders' => $orders,
            'tab' => $tab,
        ]);
    }

    public function show(Order $order, ConversationService $conversationService): Response
    {
        Gate::authorize('view', $order);
        $conversationService->syncForOrder($order);

        $order->load([
            'restaurant:id,name,logo_path,latitude,longitude',
            'deliveryAddress',
            'rider.user:id,name,avatar_path',
            'poolOffer:id,order_id,escalation_stage',
            'payment',
            'items.menuItem:id,menu_category_id,name,photo_path,base_price,is_available,available_from,available_until',
            'items.variant:id,menu_item_id,name,price_delta',
            'items.addons.addon:id,menu_item_id,name,price,is_available',
            'restaurantReview',
            'riderReview',
            'statusHistory' => fn ($query) => $query->oldest('created_at'),
            'conversations:id,order_id,type',
        ]);

        $isActive = ! $order->isTerminal();
        $isCustomerViewer = request()->user()?->isCustomer() === true;
        $hasAllReviews = $order->restaurantReview !== null
            && ($order->rider_id === null || $order->riderReview !== null);
        $restaurantConversation = $order->conversations
            ->firstWhere('type', Conversation::CUSTOMER_RESTAURANT);
        $riderConversation = $order->conversations
            ->firstWhere('type', Conversation::CUSTOMER_RIDER);

        return Inertia::render('customer/orders/show', [
            'order' => [
                'id' => $order->id,
                'order_number' => $order->order_number,
                'status' => $order->status,
                'is_active' => $isActive,
                'restaurant' => [
                    'id' => $order->restaurant->id,
                    'name' => $order->restaurant->name,
                    'logo_url' => $this->publicUrl($order->restaurant->logo_path),
                    'latitude' => (float) $order->restaurant->latitude,
                    'longitude' => (float) $order->restaurant->longitude,
                    'message_url' => ! $isCustomerViewer || $restaurantConversation === null ? null : route(
                        'customer.messages.show',
                        $restaurantConversation,
                        absolute: false,
                    ),
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
                    'photo_url' => $this->publicUrl($item->menuItem->photo_path),
                    'variant' => $item->variant?->name,
                    'quantity' => $item->quantity,
                    'unit_price' => (float) $item->unit_price,
                    'special_instructions' => $item->special_instructions,
                    'addons' => $item->addons->map(fn ($orderAddon): array => [
                        'name' => $orderAddon->addon->name,
                        'price' => (float) $orderAddon->price,
                    ])->values(),
                    'line_total' => round(
                        ((float) $item->unit_price
                            + $item->addons->sum(fn ($addon): float => (float) $addon->price))
                        * $item->quantity,
                        2,
                    ),
                ])->values(),
                'subtotal' => (float) $order->subtotal,
                'delivery_fee' => (float) $order->delivery_fee,
                'service_fee' => (float) $order->service_fee,
                'discount_amount' => (float) $order->discount_amount,
                'tip_amount' => (float) $order->tip_amount,
                'total_amount' => (float) $order->total_amount,
                'payment_method' => $order->payment_method,
                'payment' => $order->payment === null ? null : [
                    'status' => $order->payment->status,
                    'amount' => (float) $order->payment->amount,
                    'refunded_amount' => (float) $order->payment->refunded_amount,
                    'transaction_reference' => $order->payment->transaction_reference,
                ],
                'customer_notes' => $order->customer_notes,
                'placed_at' => $this->dateTime($order->placed_at),
                'delivered_at' => $this->dateTime($order->delivered_at),
                'estimated_ready_at' => $this->dateTime($order->estimated_ready_at),
                'prep_extended_minutes' => $order->prep_extended_minutes,
                'rider' => $order->rider === null ? null : [
                    'id' => $order->rider->id,
                    'name' => $order->rider->user->name,
                    'photo_url' => $this->publicUrl($order->rider->user->avatar_path),
                    'vehicle_type' => $order->rider->vehicle_type,
                    'current_latitude' => $order->rider->current_latitude,
                    'current_longitude' => $order->rider->current_longitude,
                    'location_updated_at' => $this->dateTime($order->rider->last_location_at),
                    'message_url' => ! $isCustomerViewer || $riderConversation === null ? null : route(
                        'customer.messages.show',
                        $riderConversation,
                        absolute: false,
                    ),
                ],
                'escalation_stage' => $order->poolOffer?->escalation_stage,
                'cancellation_reason' => $order->cancellation_reason,
                'rejection_reason' => $order->rejection_reason,
                'cancelled_by' => $order->cancelled_by,
                'can_cancel' => $isCustomerViewer && Gate::allows('cancel', $order),
                'cancellation_explanation' => $isCustomerViewer
                    ? $this->cancellationExplanation($order)
                    : null,
                'can_review' => $isCustomerViewer
                    && Gate::allows('review', $order)
                    && ! $hasAllReviews,
                'can_report' => $isCustomerViewer && Gate::allows('report', $order),
                'review' => $hasAllReviews ? [
                    'restaurant_rating' => $order->restaurantReview->rating,
                    'restaurant_comment' => $order->restaurantReview->comment,
                    'restaurant_photo_url' => $this->publicUrl($order->restaurantReview->photo_path),
                    'rider_rating' => $order->riderReview?->rating,
                ] : null,
            ],
            'history' => $order->statusHistory->map(fn (OrderStatusHistory $entry): array => [
                'status' => $entry->status,
                'note' => $entry->note,
                'created_at' => $this->dateTime($entry->created_at),
            ])->values(),
        ]);
    }

    public function reorder(Order $order, CustomerCatalog $catalog): JsonResponse
    {
        Gate::authorize('reorder', $order);
        $order->load([
            'restaurant:id,name,approval_status',
            'items.menuItem.category:id,restaurant_id',
            'items.variant',
            'items.addons.addon',
        ]);

        if ($order->restaurant->approval_status !== 'approved') {
            throw ValidationException::withMessages([
                'order' => 'This restaurant is no longer available.',
            ]);
        }

        $unavailable = [];
        $priceChanged = false;
        $items = [];

        foreach ($order->items as $orderItem) {
            $menuItem = $orderItem->menuItem;
            $variant = $orderItem->variant;
            $addons = $orderItem->addons;
            $available = $menuItem->category->restaurant_id === $order->restaurant_id
                && $catalog->isItemAvailable($menuItem)
                && ($variant === null || $variant->menu_item_id === $menuItem->id)
                && $addons->every(fn ($orderAddon): bool => $orderAddon->addon->menu_item_id === $menuItem->id
                    && $orderAddon->addon->is_available);

            if (! $available) {
                $unavailable[] = $menuItem->name;

                continue;
            }

            $variantPrice = $variant === null ? 0.0 : (float) $variant->price_delta;
            $currentCombinedPrice = (float) $menuItem->base_price
                + $variantPrice
                + $addons->sum(fn ($orderAddon): float => (float) $orderAddon->addon->price);
            $historicalCombinedPrice = (float) $orderItem->unit_price
                + $addons->sum(fn ($orderAddon): float => (float) $orderAddon->price);
            $priceChanged = $priceChanged
                || abs($currentCombinedPrice - $historicalCombinedPrice) >= 0.01;

            $items[] = [
                'menuItemId' => $menuItem->id,
                'restaurantId' => $order->restaurant->id,
                'restaurantName' => $order->restaurant->name,
                'name' => $menuItem->name,
                'photoUrl' => $this->publicUrl($menuItem->photo_path),
                'basePrice' => (float) $menuItem->base_price,
                'variant' => $variant === null ? null : [
                    'id' => $variant->id,
                    'name' => $variant->name,
                    'priceDelta' => (float) $variant->price_delta,
                ],
                'addons' => $addons->map(fn ($orderAddon): array => [
                    'id' => $orderAddon->addon->id,
                    'name' => $orderAddon->addon->name,
                    'price' => (float) $orderAddon->addon->price,
                ])->values(),
                'specialInstructions' => (string) ($orderItem->special_instructions ?? ''),
                'quantity' => $orderItem->quantity,
            ];
        }

        if ($unavailable !== []) {
            throw ValidationException::withMessages([
                'order' => 'Reorder is unavailable because these items changed or are sold out: '.implode(', ', $unavailable).'.',
            ]);
        }

        return response()->json([
            'items' => $items,
            'price_changed' => $priceChanged,
        ]);
    }

    public function review(Request $request, Order $order): RedirectResponse
    {
        Gate::authorize('review', $order);
        Gate::authorize('create', RestaurantReview::class);
        if ($order->rider_id !== null) {
            Gate::authorize('create', RiderReview::class);
        }

        $validated = $request->validate([
            'restaurant_rating' => ['required', 'integer', 'between:1,5'],
            'rider_rating' => $order->rider_id === null
                ? ['prohibited']
                : ['required', 'integer', 'between:1,5'],
            'comment' => ['nullable', 'string', 'max:2000'],
            'photo' => ['nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:5120'],
        ]);

        $photoPath = null;

        try {
            DB::transaction(function () use ($request, $order, $validated, &$photoPath): void {
                $lockedOrder = Order::query()
                    ->with(['restaurantReview', 'riderReview'])
                    ->lockForUpdate()
                    ->findOrFail($order->id);

                if (! $lockedOrder->canBeReviewedByCustomer()) {
                    throw ValidationException::withMessages([
                        'restaurant_rating' => 'Only delivered orders can be reviewed.',
                    ]);
                }

                if ($lockedOrder->restaurantReview !== null
                    && ($lockedOrder->rider_id === null || $lockedOrder->riderReview !== null)) {
                    throw ValidationException::withMessages([
                        'restaurant_rating' => 'This order has already been reviewed.',
                    ]);
                }

                if ($lockedOrder->restaurantReview === null) {
                    $photo = $request->file('photo');
                    if ($photo !== null) {
                        $stored = $photo->store("reviews/restaurants/{$lockedOrder->restaurant_id}", 'public');
                        if (! is_string($stored)) {
                            throw new RuntimeException('The review photo could not be stored.');
                        }
                        $photoPath = $stored;
                    }

                    RestaurantReview::query()->create([
                        'order_id' => $lockedOrder->id,
                        'customer_id' => $lockedOrder->customer_id,
                        'restaurant_id' => $lockedOrder->restaurant_id,
                        'rating' => $validated['restaurant_rating'],
                        'comment' => $validated['comment'] ?? null,
                        'photo_path' => $photoPath,
                    ]);
                }

                if ($lockedOrder->rider_id !== null && $lockedOrder->riderReview === null) {
                    RiderReview::query()->create([
                        'order_id' => $lockedOrder->id,
                        'customer_id' => $lockedOrder->customer_id,
                        'rider_id' => $lockedOrder->rider_id,
                        'rating' => $validated['rider_rating'],
                    ]);
                }
            });
        } catch (Throwable $exception) {
            if ($photoPath !== null) {
                Storage::disk('public')->delete($photoPath);
            }

            throw $exception;
        }

        return back()->with('success', 'Thank you for rating your order.');
    }

    public function report(Request $request, Order $order): RedirectResponse
    {
        Gate::authorize('report', $order);
        Gate::authorize('create', OrderReport::class);
        $validated = $request->validate([
            'type' => ['required', Rule::in([
                'missing_item', 'wrong_item', 'late_delivery', 'rude_behavior', 'other',
            ])],
            'description' => ['required', 'string', 'max:2000'],
        ]);

        DB::transaction(function () use ($request, $order, $validated): void {
            $lockedOrder = Order::query()->lockForUpdate()->findOrFail($order->id);
            if (! $lockedOrder->canBeReportedByCustomer()) {
                throw ValidationException::withMessages([
                    'description' => 'The reporting window for this order has closed.',
                ]);
            }

            OrderReport::query()->create([
                'order_id' => $lockedOrder->id,
                'reported_by_user_id' => $request->user()->id,
                'against' => $this->reportAgainst($validated['type'], $lockedOrder),
                'type' => $validated['type'],
                'description' => $validated['description'],
                'status' => 'open',
            ]);
        });

        return back()->with('success', 'Your report was submitted for admin review.');
    }

    public function cancel(
        Order $order,
        TransitionOrderStatus $transition,
        RecordPaymentStatus $paymentStatus,
    ): RedirectResponse {
        Gate::authorize('cancel', $order);

        DB::transaction(function () use ($order, $transition, $paymentStatus): void {
            $lockedOrder = Order::query()
                ->with('poolOffer')
                ->lockForUpdate()
                ->findOrFail($order->id);

            if (! $lockedOrder->canBeCancelledByCustomer()) {
                throw ValidationException::withMessages([
                    'order' => 'This order can no longer be cancelled.',
                ]);
            }

            $delayedRiderSearch = $lockedOrder->status === 'finding_rider';
            $reason = $delayedRiderSearch
                ? 'Customer cancelled because a rider could not be found in time.'
                : 'Customer cancelled before the restaurant accepted the order.';

            $transition->handle(
                $lockedOrder,
                'cancelled_by_customer',
                'customer',
                $reason,
                [
                    'cancellation_reason' => $reason,
                    'cancelled_by' => 'customer',
                ],
            );

            $payment = Payment::query()
                ->where('order_id', $lockedOrder->id)
                ->lockForUpdate()
                ->first();

            if ($payment === null) {
                return;
            }

            if (in_array($payment->status, ['paid', 'partially_refunded'], true)) {
                $payment->forceFill([
                    'refunded_amount' => $payment->amount,
                    'refunded_at' => now(),
                ])->save();
                $paymentStatus->transition(
                    $payment,
                    'refunded',
                    'customer',
                    'Full refund recorded after customer cancellation.',
                );
            } elseif ($payment->status === 'pending' && $payment->method === 'cod') {
                $paymentStatus->transition(
                    $payment,
                    'failed',
                    'customer',
                    'COD order cancelled before cash collection.',
                );
            }
        });

        return to_route('customer.orders.show', $order)
            ->with('success', 'Order cancelled. Any captured payment has been marked for a full refund.');
    }

    private function cancellationExplanation(Order $order): ?string
    {
        if (Gate::allows('cancel', $order)) {
            return null;
        }

        if ($order->isTerminal()) {
            return 'This order is already finished and can no longer be cancelled.';
        }

        if ($order->status === 'finding_rider') {
            return 'You can cancel for a full refund if the rider search reaches the customer-notify delay stage.';
        }

        if (in_array($order->status, ['accepted', 'preparing', 'ready'], true)) {
            return 'The restaurant has accepted this order. Cancellation is available only if the platform cannot find a rider in time.';
        }

        return 'A rider is already handling this order, so customer cancellation is no longer available.';
    }

    private function reportAgainst(string $type, Order $order): string
    {
        return match ($type) {
            'missing_item', 'wrong_item' => 'restaurant',
            'rude_behavior' => $order->rider_id === null ? 'restaurant' : 'rider',
            default => 'platform',
        };
    }

    private function dateTime(mixed $value): ?string
    {
        return $value === null ? null : Carbon::parse($value)->toIso8601String();
    }

    private function publicUrl(?string $path): ?string
    {
        return $path === null ? null : Storage::disk('public')->url($path);
    }
}
