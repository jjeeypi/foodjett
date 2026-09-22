<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Restaurant extends Model
{
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

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function documents(): HasMany
    {
        return $this->hasMany(RestaurantDocument::class);
    }

    public function operatingHours(): HasMany
    {
        return $this->hasMany(RestaurantOperatingHour::class);
    }

    public function menuCategories(): HasMany
    {
        return $this->hasMany(MenuCategory::class);
    }

    public function orders(): HasMany
    {
        return $this->hasMany(Order::class);
    }

    public function reviews(): HasMany
    {
        return $this->hasMany(RestaurantReview::class);
    }

    public function payouts(): HasMany
    {
        return $this->hasMany(RestaurantPayout::class);
    }

    public function vouchers(): HasMany
    {
        return $this->hasMany(Voucher::class);
    }
}
