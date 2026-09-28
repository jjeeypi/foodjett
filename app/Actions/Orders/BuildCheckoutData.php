<?php

namespace App\Actions\Orders;

use App\Data\OrderCheckoutData;
use App\Models\Customer;
use App\Models\CustomerAddress;
use App\Models\MenuItem;
use App\Models\PlatformSetting;
use App\Models\Restaurant;
use App\Services\CustomerCatalog;
use App\Services\DeliveryZoneService;
use App\Services\VoucherService;
use Illuminate\Validation\ValidationException;

class BuildCheckoutData
{
    public function __construct(
        private CustomerCatalog $catalog,
        private DeliveryZoneService $deliveryZones,
        private VoucherService $vouchers,
    ) {}

    /**
     * @param  list<array{
     *     menu_item_id: int,
     *     menu_item_variant_id?: int|null,
     *     quantity: int,
     *     addon_ids?: list<int>,
     *     special_instructions?: string|null,
     *     expected_unit_price: float
     * }>  $requestedItems
     */
    public function handle(
        Customer $customer,
        Restaurant $restaurant,
        CustomerAddress $address,
        string $paymentMethod,
        ?string $customerNotes,
        array $requestedItems,
        ?string $voucherCode = null,
        float $tipAmount = 0,
    ): OrderCheckoutData {
        if ($restaurant->approval_status !== 'approved' || ! $this->catalog->isRestaurantOpen($restaurant)) {
            throw ValidationException::withMessages([
                'restaurant' => 'This restaurant is not currently accepting orders.',
            ]);
        }

        if ($address->customer_id !== $customer->id) {
            throw ValidationException::withMessages([
                'customer_address_id' => 'The selected delivery address is not yours.',
            ]);
        }

        $deliveryZone = $this->deliveryZones->containing(
            (float) $address->latitude,
            (float) $address->longitude,
        );

        if ($deliveryZone === null) {
            throw ValidationException::withMessages([
                'customer_address_id' => 'This address is outside the platform’s active delivery zones.',
            ]);
        }

        $normalizedItems = [];
        $subtotal = 0.0;

        foreach ($requestedItems as $index => $requestedItem) {
            $menuItem = MenuItem::query()
                ->with(['category', 'variants', 'addons'])
                ->find($requestedItem['menu_item_id']);

            if (! $menuItem
                || $menuItem->category->restaurant_id !== $restaurant->id
                || ! $this->catalog->isItemAvailable($menuItem)) {
                throw ValidationException::withMessages([
                    "items.{$index}.menu_item_id" => 'This menu item is unavailable for the selected restaurant.',
                ]);
            }

            $variantId = $requestedItem['menu_item_variant_id'] ?? null;
            $variant = $variantId === null ? null : $menuItem->variants->firstWhere('id', $variantId);

            if ($variantId !== null && $variant === null) {
                throw ValidationException::withMessages([
                    "items.{$index}.menu_item_variant_id" => 'The selected variant does not belong to this menu item.',
                ]);
            }

            $requestedAddonIds = array_values(array_unique($requestedItem['addon_ids'] ?? []));
            $addons = $menuItem->addons
                ->whereIn('id', $requestedAddonIds)
                ->where('is_available', true)
                ->values();

            if ($addons->count() !== count($requestedAddonIds)) {
                throw ValidationException::withMessages([
                    "items.{$index}.addon_ids" => 'One or more selected add-ons are unavailable.',
                ]);
            }

            $variantPrice = $variant === null ? 0.0 : (float) $variant->price_delta;
            $unitPrice = round((float) $menuItem->base_price + $variantPrice, 2);
            $addonTotal = round($addons->sum(fn ($addon): float => (float) $addon->price), 2);
            $currentCombinedPrice = round($unitPrice + $addonTotal, 2);
            $expectedPrice = round((float) $requestedItem['expected_unit_price'], 2);

            if (abs($currentCombinedPrice - $expectedPrice) >= 0.01) {
                throw ValidationException::withMessages([
                    "items.{$index}.expected_unit_price" => sprintf(
                        'The price of %s changed from ₱%s to ₱%s. Please review your cart.',
                        $menuItem->name,
                        number_format($expectedPrice, 2),
                        number_format($currentCombinedPrice, 2),
                    ),
                ]);
            }

            $quantity = $requestedItem['quantity'];
            $subtotal += $currentCombinedPrice * $quantity;

            $normalizedItems[] = [
                'menu_item_id' => $menuItem->id,
                'menu_item_variant_id' => $variant?->id,
                'quantity' => $quantity,
                'unit_price' => $unitPrice,
                'special_instructions' => $requestedItem['special_instructions'] ?? null,
                'addons' => array_values($addons->map(fn ($addon): array => [
                    'menu_item_addon_id' => (int) $addon->getKey(),
                    'price' => (float) $addon->price,
                ])->all()),
            ];
        }

        $subtotal = round($subtotal, 2);
        if ($subtotal < (float) $restaurant->min_order_amount) {
            throw ValidationException::withMessages([
                'items' => sprintf(
                    'This restaurant requires a minimum food subtotal of ₱%s.',
                    number_format((float) $restaurant->min_order_amount, 2),
                ),
            ]);
        }

        $deliveryDistance = $this->catalog->distanceInKilometres(
            (float) $restaurant->latitude,
            (float) $restaurant->longitude,
            (float) $address->latitude,
            (float) $address->longitude,
        );
        $baseFee = PlatformSetting::getFloat(
            'delivery_base_fee',
            (float) config('orders.delivery_fee'),
        );
        $perKilometre = PlatformSetting::getFloat('delivery_fee_per_km', 10);
        $deliveryFee = round($baseFee + ($deliveryDistance * $perKilometre), 2);
        $serviceFee = round((float) config('orders.service_fee'), 2);
        $voucher = $this->vouchers->resolve(
            $voucherCode,
            $customer,
            $restaurant,
            $subtotal,
            $deliveryFee,
        );
        $tipAmount = round($tipAmount, 2);
        $totalAmount = round(max(
            0,
            $subtotal + $deliveryFee + $serviceFee + $tipAmount - $voucher['discount'],
        ), 2);
        $commissionAmount = round($subtotal * ((float) $restaurant->commission_rate / 100), 2);

        return new OrderCheckoutData(
            customerId: $customer->id,
            restaurantId: $restaurant->id,
            customerAddressId: $address->id,
            paymentMethod: $paymentMethod,
            subtotal: $subtotal,
            deliveryFee: $deliveryFee,
            serviceFee: $serviceFee,
            discountAmount: $voucher['discount'],
            tipAmount: $tipAmount,
            totalAmount: $totalAmount,
            commissionAmount: $commissionAmount,
            customerNotes: $customerNotes,
            voucherId: $voucher['voucher']?->id,
            voucherCode: $voucher['voucher']?->code,
            deliveryDistanceKm: round($deliveryDistance, 2),
            items: $normalizedItems,
        );
    }
}
