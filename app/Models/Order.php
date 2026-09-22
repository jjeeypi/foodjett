<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Order extends Model
{
    use HasFactory;

    protected $fillable = [
        'order_number', 'customer_id', 'restaurant_id', 'customer_address_id', 'rider_id',
        'status', 'subtotal', 'delivery_fee', 'service_fee', 'discount_amount',
        'tip_amount', 'total_amount', 'commission_amount', 'payment_method',
        'customer_notes', 'rejection_reason', 'cancellation_reason', 'cancelled_by',
        'placed_at', 'accepted_at', 'estimated_prep_minutes', 'estimated_ready_at',
        'prep_extended_minutes', 'ready_at', 'rider_search_started_at', 'rider_assigned_at',
        'rider_arrived_restaurant_at', 'picked_up_at', 'delivered_at',
        'pickup_code', 'proof_of_delivery_path',
    ];

    protected function casts(): array
    {
        return [
            'subtotal' => 'decimal:2',
            'delivery_fee' => 'decimal:2',
            'service_fee' => 'decimal:2',
            'discount_amount' => 'decimal:2',
            'tip_amount' => 'decimal:2',
            'total_amount' => 'decimal:2',
            'commission_amount' => 'decimal:2',
            'placed_at' => 'datetime',
            'accepted_at' => 'datetime',
            'estimated_ready_at' => 'datetime',
            'ready_at' => 'datetime',
            'rider_search_started_at' => 'datetime',
            'rider_assigned_at' => 'datetime',
            'rider_arrived_restaurant_at' => 'datetime',
            'picked_up_at' => 'datetime',
            'delivered_at' => 'datetime',
        ];
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function restaurant(): BelongsTo
    {
        return $this->belongsTo(Restaurant::class);
    }

    public function rider(): BelongsTo
    {
        return $this->belongsTo(Rider::class);
    }

    public function deliveryAddress(): BelongsTo
    {
        return $this->belongsTo(CustomerAddress::class, 'customer_address_id');
    }

    public function items(): HasMany
    {
        return $this->hasMany(OrderItem::class);
    }

    public function statusHistory(): HasMany
    {
        return $this->hasMany(OrderStatusHistory::class);
    }

    public function payment(): HasOne
    {
        return $this->hasOne(Payment::class);
    }

    public function poolOffer(): HasOne
    {
        return $this->hasOne(RiderPoolOffer::class);
    }

    public function poolDeclines(): HasMany
    {
        return $this->hasMany(RiderPoolDecline::class);
    }

    public function restaurantReview(): HasOne
    {
        return $this->hasOne(RestaurantReview::class);
    }

    public function riderReview(): HasOne
    {
        return $this->hasOne(RiderReview::class);
    }

    public function riderEarning(): HasOne
    {
        return $this->hasOne(RiderEarning::class);
    }

    public function reports(): HasMany
    {
        return $this->hasMany(OrderReport::class);
    }

    public function voucherRedemption(): HasOne
    {
        return $this->hasOne(VoucherRedemption::class);
    }

    public function isTerminal(): bool
    {
        return in_array($this->status, [
            'rejected_by_restaurant', 'cancelled_by_customer',
            'cancelled_by_restaurant', 'cancelled_no_rider', 'failed_delivery', 'delivered',
        ]);
    }

    public function isCancelled(): bool
    {
        return in_array($this->status, [
            'rejected_by_restaurant', 'cancelled_by_customer',
            'cancelled_by_restaurant', 'cancelled_no_rider',
        ]);
    }
}
