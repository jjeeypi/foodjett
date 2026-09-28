<?php

namespace App\Services;

use App\Models\Customer;
use App\Models\Restaurant;
use App\Models\Voucher;
use Illuminate\Support\Carbon;
use Illuminate\Validation\ValidationException;

class VoucherService
{
    /** @return array{voucher: Voucher|null, discount: float} */
    public function resolve(
        ?string $code,
        Customer $customer,
        Restaurant $restaurant,
        float $subtotal,
        float $deliveryFee,
    ): array {
        $code = mb_strtoupper(trim((string) $code));

        if ($code === '') {
            return ['voucher' => null, 'discount' => 0.0];
        }

        $voucher = Voucher::query()->where('code', $code)->first();

        if ($voucher === null || ! $voucher->is_active) {
            throw $this->invalid('This voucher code is invalid or inactive.');
        }

        if ($voucher->starts_at !== null && Carbon::parse($voucher->starts_at)->isFuture()) {
            throw $this->invalid('This voucher is not active yet.');
        }

        if ($voucher->ends_at !== null && Carbon::parse($voucher->ends_at)->isPast()) {
            throw $this->invalid('This voucher has expired.');
        }

        if ($voucher->scope === 'restaurant' && $voucher->restaurant_id !== $restaurant->id) {
            throw $this->invalid('This voucher does not apply to this restaurant.');
        }

        if ($subtotal < (float) $voucher->min_order_amount) {
            throw $this->invalid(sprintf(
                'This voucher requires a minimum food subtotal of ₱%s.',
                number_format((float) $voucher->min_order_amount, 2),
            ));
        }

        if ($voucher->usage_limit_total !== null
            && $voucher->redemptions()->count() >= $voucher->usage_limit_total) {
            throw $this->invalid('This voucher has reached its total usage limit.');
        }

        if ($voucher->redemptions()->where('customer_id', $customer->id)->count()
            >= $voucher->usage_limit_per_customer) {
            throw $this->invalid('You have already used this voucher the maximum number of times.');
        }

        $type = $voucher->getAttribute('type');
        $value = $voucher->getAttribute('value');
        $discount = 0.0;

        if ($type === 'percentage' && is_numeric($value)) {
            $discount = min($subtotal * ((float) $value / 100), $subtotal);
        } elseif ($type === 'fixed' && is_numeric($value)) {
            $discount = min((float) $value, $subtotal);
        } elseif ($type === 'free_delivery') {
            $discount = $deliveryFee;
        }

        return [
            'voucher' => $voucher,
            'discount' => round(max(0, $discount), 2),
        ];
    }

    private function invalid(string $message): ValidationException
    {
        return ValidationException::withMessages(['voucher_code' => $message]);
    }
}
