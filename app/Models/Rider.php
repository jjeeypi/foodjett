<?php

namespace App\Models;

use Database\Factories\RiderFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Rider extends Model
{
    /** @use HasFactory<RiderFactory> */
    use HasFactory;

    protected $fillable = [
        'user_id', 'vehicle_type', 'plate_number',
        'approval_status', 'rejection_reason', 'availability_status',
        'current_latitude', 'current_longitude', 'last_location_at',
        'cash_on_hand', 'cash_remit_limit', 'payout_method', 'payout_account_details',
    ];

    protected function casts(): array
    {
        return [
            'current_latitude' => 'float',
            'current_longitude' => 'float',
            'last_location_at' => 'datetime',
            'cash_on_hand' => 'decimal:2',
            'cash_remit_limit' => 'decimal:2',
            'payout_account_details' => 'array',
        ];
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** @return HasMany<RiderDocument, $this> */
    public function documents(): HasMany
    {
        return $this->hasMany(RiderDocument::class);
    }

    /** @return HasMany<Order, $this> */
    public function orders(): HasMany
    {
        return $this->hasMany(Order::class);
    }

    /** @return HasMany<RiderEarning, $this> */
    public function earnings(): HasMany
    {
        return $this->hasMany(RiderEarning::class);
    }

    /** @return HasMany<RiderReview, $this> */
    public function reviews(): HasMany
    {
        return $this->hasMany(RiderReview::class);
    }

    /** @return HasMany<RiderPayout, $this> */
    public function payouts(): HasMany
    {
        return $this->hasMany(RiderPayout::class);
    }

    /** @return HasMany<RiderCashRemittance, $this> */
    public function cashRemittances(): HasMany
    {
        return $this->hasMany(RiderCashRemittance::class);
    }

    /** @return HasMany<RiderPoolDecline, $this> */
    public function poolDeclines(): HasMany
    {
        return $this->hasMany(RiderPoolDecline::class);
    }

    public function canAcceptCodOrders(): bool
    {
        return (float) $this->cash_on_hand < (float) $this->cash_remit_limit;
    }
}
