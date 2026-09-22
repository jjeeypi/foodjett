<?php

namespace App\Models;

use Database\Factories\RestaurantFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Restaurant extends Model
{
    /** @use HasFactory<RestaurantFactory> */
    use HasFactory;

    protected $fillable = [
        'user_id', 'name', 'slug', 'description', 'logo_path', 'cover_photo_path',
        'cuisine_type', 'address', 'latitude', 'longitude',
        'default_prep_time_minutes', 'min_order_amount', 'commission_rate',
        'approval_status', 'rejection_reason', 'operating_status',
        'payout_method', 'payout_account_details',
    ];

    protected function casts(): array
    {
        return [
            'latitude' => 'float',
            'longitude' => 'float',
            'min_order_amount' => 'decimal:2',
            'commission_rate' => 'decimal:2',
            'payout_account_details' => 'array',
        ];
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** @return HasMany<RestaurantDocument, $this> */
    public function documents(): HasMany
    {
        return $this->hasMany(RestaurantDocument::class);
    }

    /** @return HasMany<RestaurantOperatingHour, $this> */
    public function operatingHours(): HasMany
    {
        return $this->hasMany(RestaurantOperatingHour::class);
    }

    /** @return HasMany<MenuCategory, $this> */
    public function menuCategories(): HasMany
    {
        return $this->hasMany(MenuCategory::class);
    }

    /** @return HasMany<Order, $this> */
    public function orders(): HasMany
    {
        return $this->hasMany(Order::class);
    }

    /** @return HasMany<RestaurantReview, $this> */
    public function reviews(): HasMany
    {
        return $this->hasMany(RestaurantReview::class);
    }

    /** @return HasMany<RestaurantPayout, $this> */
    public function payouts(): HasMany
    {
        return $this->hasMany(RestaurantPayout::class);
    }

    /** @return HasMany<Voucher, $this> */
    public function vouchers(): HasMany
    {
        return $this->hasMany(Voucher::class);
    }
}
