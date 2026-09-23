<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PendingCheckout extends Model
{
    use HasUuids;

    protected $fillable = [
        'customer_id', 'restaurant_id', 'customer_address_id', 'payment_method',
        'payload', 'total_amount', 'paymongo_session_id', 'paymongo_checkout_url',
        'paymongo_reference', 'status', 'order_id', 'expires_at',
    ];

    protected function casts(): array
    {
        return [
            'payload' => 'array',
            'total_amount' => 'decimal:2',
            'expires_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<Customer, $this> */
    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    /** @return BelongsTo<Restaurant, $this> */
    public function restaurant(): BelongsTo
    {
        return $this->belongsTo(Restaurant::class);
    }

    /** @return BelongsTo<CustomerAddress, $this> */
    public function customerAddress(): BelongsTo
    {
        return $this->belongsTo(CustomerAddress::class);
    }

    /** @return BelongsTo<Order, $this> */
    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    /** @return array<string, mixed> */
    public function checkoutPayload(): array
    {
        $payload = $this->getAttribute('payload');

        return is_array($payload) ? $payload : [];
    }
}
