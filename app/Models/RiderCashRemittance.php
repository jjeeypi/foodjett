<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RiderCashRemittance extends Model
{
    use HasFactory;

    protected $fillable = [
        'rider_id', 'amount', 'status', 'confirmed_by_admin_id', 'remitted_at',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'remitted_at' => 'datetime',
        ];
    }

    public function rider(): BelongsTo
    {
        return $this->belongsTo(Rider::class);
    }

    public function confirmedByAdmin(): BelongsTo
    {
        return $this->belongsTo(Admin::class, 'confirmed_by_admin_id');
    }
}
