<?php

namespace App\Actions\Orders;

use App\Data\OrderCheckoutData;
use App\Models\Customer;
use App\Models\CustomerAddress;
use App\Models\MenuItem;
use App\Models\Restaurant;
use Illuminate\Validation\ValidationException;

class BuildCheckoutData
{
    /**
     * @param  list<array{
     *     menu_item_id: int,
     *     menu_item_variant_id?: int|null,
     *     quantity: int,
     *     addon_ids?: list<int>,
     *     special_instructions?: string|null
     * }>  $requestedItems
     */
    public function handle(
        Customer $customer,
        Restaurant $restaurant,
        CustomerAddress $address,
        string $paymentMethod,
        ?string $customerNotes,
        array $requestedItems,
    ): OrderCheckoutData {
        if ($restaurant->approval_status !== 'approved' || $restaurant->operating_status !== 'open') {
            throw ValidationException::withMessages([
                'restaurant' => 'This restaurant is not currently accepting orders.',
            ]);
        }

        if ($address->customer_id !== $customer->id) {
            throw ValidationException::withMessages([
                'customer_address_id' => 'The selected delivery address is not yours.',
            ]);
        }

        $normalizedItems = [];
        $subtotal = 0.0;

        foreach ($requestedItems as $index => $requestedItem) {
            $menuItem = MenuItem::query()
                ->with(['category', 'variants', 'addons'])
                ->find($requestedItem['menu_item_id']);

            if (! $menuItem || $menuItem->category->restaurant_id !== $restaurant->id || ! $menuItem->is_available) {
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
            $quantity = $requestedItem['quantity'];
            $subtotal += ($unitPrice + $addonTotal) * $quantity;

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
        $deliveryFee = round((float) config('orders.delivery_fee'), 2);
        $serviceFee = round((float) config('orders.service_fee'), 2);
        $totalAmount = round($subtotal + $deliveryFee + $serviceFee, 2);
        $commissionAmount = round($subtotal * ((float) $restaurant->commission_rate / 100), 2);

        return new OrderCheckoutData(
            customerId: $customer->id,
            restaurantId: $restaurant->id,
            customerAddressId: $address->id,
            paymentMethod: $paymentMethod,
            subtotal: $subtotal,
            deliveryFee: $deliveryFee,
            serviceFee: $serviceFee,
            discountAmount: 0,
            tipAmount: 0,
            totalAmount: $totalAmount,
            commissionAmount: $commissionAmount,
            customerNotes: $customerNotes,
            items: $normalizedItems,
        );
    }
}
