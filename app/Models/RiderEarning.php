<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RiderEarning extends Model
{
    use HasFactory;

    protected $fillable = [
        'rider_id', 'order_id', 'base_pay', 'distance_pay',
        'waiting_pay', 'incentive_pay', 'tip_amount', 'total_earned',
    ];

    protected function casts(): array
    {
        return [
            'base_pay' => 'decimal:2',
            'distance_pay' => 'decimal:2',
            'waiting_pay' => 'decimal:2',
            'incentive_pay' => 'decimal:2',
            'tip_amount' => 'decimal:2',
            'total_earned' => 'decimal:2',
        ];
    }

    public function rider(): BelongsTo
    {
        return $this->belongsTo(Rider::class);
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }
}
