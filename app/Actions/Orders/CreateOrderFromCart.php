<?php

namespace App\Actions\Orders;

use App\Actions\Payments\RecordPaymentStatus;
use App\Data\OrderCheckoutData;
use App\Events\OrderPlaced;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\OrderItemAddon;
use App\Models\OrderStatusHistory;
use App\Models\Payment;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class CreateOrderFromCart
{
    public function __construct(private RecordPaymentStatus $paymentStatus) {}

    public function handle(
        OrderCheckoutData $checkout,
        string $paymentStatus,
        ?string $transactionReference = null,
    ): Order {
        $order = DB::transaction(function () use ($checkout, $paymentStatus, $transactionReference): Order {
            $order = Order::create([
                'order_number' => 'FJ-'.now()->format('Ymd').'-'.Str::upper(Str::random(8)),
                'customer_id' => $checkout->customerId,
                'restaurant_id' => $checkout->restaurantId,
                'customer_address_id' => $checkout->customerAddressId,
                'status' => 'placed',
                'subtotal' => $checkout->subtotal,
                'delivery_fee' => $checkout->deliveryFee,
                'service_fee' => $checkout->serviceFee,
                'discount_amount' => $checkout->discountAmount,
                'tip_amount' => $checkout->tipAmount,
                'total_amount' => $checkout->totalAmount,
                'commission_amount' => $checkout->commissionAmount,
                'payment_method' => $checkout->paymentMethod,
                'customer_notes' => $checkout->customerNotes,
                'placed_at' => now(),
            ]);

            foreach ($checkout->items as $itemData) {
                $orderItem = OrderItem::create([
                    'order_id' => $order->id,
                    'menu_item_id' => $itemData['menu_item_id'],
                    'menu_item_variant_id' => $itemData['menu_item_variant_id'],
                    'quantity' => $itemData['quantity'],
                    'unit_price' => $itemData['unit_price'],
                    'special_instructions' => $itemData['special_instructions'],
                ]);

                foreach ($itemData['addons'] as $addonData) {
                    OrderItemAddon::create([
                        'order_item_id' => $orderItem->id,
                        'menu_item_addon_id' => $addonData['menu_item_addon_id'],
                        'price' => $addonData['price'],
                    ]);
                }
            }

            $payment = Payment::create([
                'order_id' => $order->id,
                'method' => $checkout->paymentMethod,
                'status' => $paymentStatus,
                'amount' => $checkout->totalAmount,
                'transaction_reference' => $transactionReference,
                'paid_at' => $paymentStatus === 'paid' ? now() : null,
            ]);

            $this->paymentStatus->initial(
                $payment,
                $paymentStatus === 'paid' ? 'system' : 'customer',
                $paymentStatus === 'paid'
                    ? 'Payment verified by PayMongo before order creation.'
                    : 'Cash on delivery payment created with the order.',
            );

            OrderStatusHistory::create([
                'order_id' => $order->id,
                'status' => 'placed',
                'changed_by' => 'customer',
                'note' => 'Order placed.',
            ]);

            return $order->load(['payment', 'items.addons']);
        });

        OrderPlaced::dispatch($order);

        return $order;
    }
}
