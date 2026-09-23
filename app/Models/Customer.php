<?php

namespace App\Models;

use Database\Factories\CustomerFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Customer extends Model
{
    /** @use HasFactory<CustomerFactory> */
    use HasFactory;

    protected $fillable = [
        'user_id',
    ];

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** @return HasMany<CustomerAddress, $this> */
    public function addresses(): HasMany
    {
        return $this->hasMany(CustomerAddress::class);
    }

    /** @return HasMany<Order, $this> */
    public function orders(): HasMany
    {
        return $this->hasMany(Order::class);
    }

    /** @return HasMany<RestaurantReview, $this> */
    public function restaurantReviews(): HasMany
    {
        return $this->hasMany(RestaurantReview::class);
    }

    /** @return HasMany<RiderReview, $this> */
    public function riderReviews(): HasMany
    {
        return $this->hasMany(RiderReview::class);
    }

    /** @return HasMany<VoucherRedemption, $this> */
    public function voucherRedemptions(): HasMany
    {
        return $this->hasMany(VoucherRedemption::class);
    }

    /** @return HasMany<PendingCheckout, $this> */
    public function pendingCheckouts(): HasMany
    {
        return $this->hasMany(PendingCheckout::class);
    }
}
