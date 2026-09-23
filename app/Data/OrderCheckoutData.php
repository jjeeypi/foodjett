<?php

namespace App\Data;

final readonly class OrderCheckoutData
{
    /**
     * @param  list<array{
     *     menu_item_id: int,
     *     menu_item_variant_id: int|null,
     *     quantity: int,
     *     unit_price: float,
     *     special_instructions: string|null,
     *     addons: list<array{menu_item_addon_id: int, price: float}>
     * }>  $items
     */
    public function __construct(
        public int $customerId,
        public int $restaurantId,
        public int $customerAddressId,
        public string $paymentMethod,
        public float $subtotal,
        public float $deliveryFee,
        public float $serviceFee,
        public float $discountAmount,
        public float $tipAmount,
        public float $totalAmount,
        public float $commissionAmount,
        public ?string $customerNotes,
        public array $items,
    ) {}

    /** @return array<string, mixed> */
    public function toArray(): array
    {
        return [
            'customer_id' => $this->customerId,
            'restaurant_id' => $this->restaurantId,
            'customer_address_id' => $this->customerAddressId,
            'payment_method' => $this->paymentMethod,
            'subtotal' => $this->subtotal,
            'delivery_fee' => $this->deliveryFee,
            'service_fee' => $this->serviceFee,
            'discount_amount' => $this->discountAmount,
            'tip_amount' => $this->tipAmount,
            'total_amount' => $this->totalAmount,
            'commission_amount' => $this->commissionAmount,
            'customer_notes' => $this->customerNotes,
            'items' => $this->items,
        ];
    }

    /** @param array<string, mixed> $payload */
    public static function fromArray(array $payload): self
    {
        $items = [];

        foreach ((array) ($payload['items'] ?? []) as $item) {
            if (! is_array($item)) {
                continue;
            }

            $addons = [];
            foreach ((array) ($item['addons'] ?? []) as $addon) {
                if (! is_array($addon)) {
                    continue;
                }

                $addons[] = [
                    'menu_item_addon_id' => (int) ($addon['menu_item_addon_id'] ?? 0),
                    'price' => (float) ($addon['price'] ?? 0),
                ];
            }

            $items[] = [
                'menu_item_id' => (int) ($item['menu_item_id'] ?? 0),
                'menu_item_variant_id' => isset($item['menu_item_variant_id'])
                    ? (int) $item['menu_item_variant_id']
                    : null,
                'quantity' => (int) ($item['quantity'] ?? 0),
                'unit_price' => (float) ($item['unit_price'] ?? 0),
                'special_instructions' => isset($item['special_instructions'])
                    ? (string) $item['special_instructions']
                    : null,
                'addons' => $addons,
            ];
        }

        return new self(
            customerId: (int) ($payload['customer_id'] ?? 0),
            restaurantId: (int) ($payload['restaurant_id'] ?? 0),
            customerAddressId: (int) ($payload['customer_address_id'] ?? 0),
            paymentMethod: (string) ($payload['payment_method'] ?? ''),
            subtotal: (float) ($payload['subtotal'] ?? 0),
            deliveryFee: (float) ($payload['delivery_fee'] ?? 0),
            serviceFee: (float) ($payload['service_fee'] ?? 0),
            discountAmount: (float) ($payload['discount_amount'] ?? 0),
            tipAmount: (float) ($payload['tip_amount'] ?? 0),
            totalAmount: (float) ($payload['total_amount'] ?? 0),
            commissionAmount: (float) ($payload['commission_amount'] ?? 0),
            customerNotes: isset($payload['customer_notes']) ? (string) $payload['customer_notes'] : null,
            items: $items,
        );
    }
}
