<?php

namespace App\Actions\Orders;

use App\Actions\Payments\RecordPaymentStatus;
use App\Data\OrderCheckoutData;
use App\Events\OrderPlaced;
use App\Models\Customer;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\OrderItemAddon;
use App\Models\OrderStatusHistory;
use App\Models\Payment;
use App\Models\Restaurant;
use App\Models\Voucher;
use App\Models\VoucherRedemption;
use App\Services\VoucherService;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use RuntimeException;

class CreateOrderFromCart
{
    public function __construct(
        private RecordPaymentStatus $paymentStatus,
        private VoucherService $vouchers,
    ) {}

    public function handle(
        OrderCheckoutData $checkout,
        string $paymentStatus,
        ?string $transactionReference = null,
        ?string $checkoutToken = null,
    ): Order {
        if ($checkoutToken !== null) {
            $existing = Order::query()->where('checkout_token', $checkoutToken)->first();
            if ($existing !== null) {
                return $existing;
            }
        }

        try {
            $order = DB::transaction(function () use (
                $checkout,
                $paymentStatus,
                $transactionReference,
                $checkoutToken,
            ): Order {
                if ($checkout->voucherId !== null) {
                    $voucher = Voucher::query()
                        ->whereKey($checkout->voucherId)
                        ->lockForUpdate()
                        ->firstOrFail();

                    $verified = $this->vouchers->resolve(
                        $checkout->voucherCode,
                        Customer::query()->findOrFail($checkout->customerId),
                        Restaurant::query()->findOrFail($checkout->restaurantId),
                        $checkout->subtotal,
                        $checkout->deliveryFee,
                    );

                    if ($verified['voucher']?->id !== $voucher->id
                        || abs($verified['discount'] - $checkout->discountAmount) >= 0.01) {
                        throw new RuntimeException('Voucher pricing changed before order creation.');
                    }
                }

                $order = Order::create([
                    'order_number' => 'FJ-'.now()->format('Ymd').'-'.Str::upper(Str::random(8)),
                    'checkout_token' => $checkoutToken,
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
                        ? sprintf('Simulated %s payment recorded at checkout.', strtoupper($checkout->paymentMethod))
                        : 'Cash on delivery payment created with the order.',
                );

                OrderStatusHistory::create([
                    'order_id' => $order->id,
                    'status' => 'placed',
                    'changed_by' => 'customer',
                    'note' => 'Order placed.',
                ]);

                if ($checkout->voucherId !== null) {
                    VoucherRedemption::query()->create([
                        'voucher_id' => $checkout->voucherId,
                        'order_id' => $order->id,
                        'customer_id' => $checkout->customerId,
                        'discount_applied' => $checkout->discountAmount,
                    ]);
                }

                return $order->load(['payment', 'items.addons']);
            });
        } catch (QueryException $exception) {
            $existing = $checkoutToken === null
                ? null
                : Order::query()->where('checkout_token', $checkoutToken)->first();

            if ($existing !== null) {
                return $existing;
            }

            throw $exception;
        }

        OrderPlaced::dispatch($order);

        return $order;
    }
}
