<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RiderPoolOffer extends Model
{
    use HasFactory;

    protected $fillable = [
        'order_id',
        'search_radius_km',
        'incentive_amount',
        'escalation_stage',
        'admin_assigned',
    ];

    protected function casts(): array
    {
        return [
            'search_radius_km' => 'decimal:1',
            'incentive_amount' => 'decimal:2',
            'admin_assigned' => 'boolean',
        ];
    }

    /** @return BelongsTo<Order, $this> */
    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }
}
