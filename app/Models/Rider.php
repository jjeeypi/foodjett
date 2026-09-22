<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Rider extends Model
{
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

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function documents(): HasMany
    {
        return $this->hasMany(RiderDocument::class);
    }

    public function orders(): HasMany
    {
        return $this->hasMany(Order::class);
    }

    public function earnings(): HasMany
    {
        return $this->hasMany(RiderEarning::class);
    }

    public function reviews(): HasMany
    {
        return $this->hasMany(RiderReview::class);
    }

    public function payouts(): HasMany
    {
        return $this->hasMany(RiderPayout::class);
    }

    public function cashRemittances(): HasMany
    {
        return $this->hasMany(RiderCashRemittance::class);
    }

    public function poolDeclines(): HasMany
    {
        return $this->hasMany(RiderPoolDecline::class);
    }
}
