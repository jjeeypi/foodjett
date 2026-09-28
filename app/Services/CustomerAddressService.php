<?php

namespace App\Services;

use App\Models\Customer;
use App\Models\CustomerAddress;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class CustomerAddressService
{
    public function __construct(private readonly DeliveryZoneService $deliveryZones) {}

    /** @param array<string, mixed> $attributes */
    public function create(Customer $customer, array $attributes): CustomerAddress
    {
        return DB::transaction(function () use ($customer, $attributes): CustomerAddress {
            Customer::query()->lockForUpdate()->findOrFail($customer->id);
            $hasAddress = $customer->addresses()->exists();

            return $customer->addresses()->create([
                ...$attributes,
                'is_default' => ! $hasAddress,
            ]);
        });
    }

    /** @param array<string, mixed> $attributes */
    public function update(CustomerAddress $address, array $attributes): CustomerAddress
    {
        $address->update($attributes);

        return $address->refresh();
    }

    public function setDefault(Customer $customer, CustomerAddress $address): void
    {
        DB::transaction(function () use ($customer, $address): void {
            Customer::query()->lockForUpdate()->findOrFail($customer->id);
            $customer->addresses()->update(['is_default' => false]);
            $customer->addresses()->whereKey($address->id)->update(['is_default' => true]);
        });
    }

    public function delete(Customer $customer, CustomerAddress $address): void
    {
        if ($address->orders()->exists() || $address->pendingCheckouts()->exists()) {
            throw ValidationException::withMessages([
                'address' => 'This address is linked to an order or checkout and cannot be deleted. You can edit it or set another address as default.',
            ]);
        }

        DB::transaction(function () use ($customer, $address): void {
            Customer::query()->lockForUpdate()->findOrFail($customer->id);
            $wasDefault = $address->is_default;
            $address->delete();

            if ($wasDefault) {
                $replacement = $customer->addresses()
                    ->latest('updated_at')
                    ->lockForUpdate()
                    ->first();
                $replacement?->update(['is_default' => true]);
            }
        });
    }

    public function isOutsideDeliveryZones(CustomerAddress $address): bool
    {
        return $this->deliveryZones->containing(
            (float) $address->latitude,
            (float) $address->longitude,
        ) === null;
    }

    /** @return array<string, mixed> */
    public function data(CustomerAddress $address): array
    {
        return [
            'id' => $address->id,
            'label' => $address->label,
            'address_line' => $address->address_line,
            'landmark' => $address->landmark,
            'delivery_instructions' => $address->delivery_instructions,
            'latitude' => (float) $address->latitude,
            'longitude' => (float) $address->longitude,
            'is_default' => $address->is_default,
            'can_delete' => ! $address->orders()->exists()
                && ! $address->pendingCheckouts()->exists(),
        ];
    }
}
