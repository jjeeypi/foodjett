<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Admin extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'permissions',
    ];

    protected function casts(): array
    {
        return [
            'permissions' => 'array',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function resolvedReports(): HasMany
    {
        return $this->hasMany(OrderReport::class, 'resolved_by_admin_id');
    }

    public function confirmedRemittances(): HasMany
    {
        return $this->hasMany(RiderCashRemittance::class, 'confirmed_by_admin_id');
    }
}
