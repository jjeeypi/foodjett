<?php

namespace App\Models;

use Database\Factories\AdminFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Admin extends Model
{
    /** @use HasFactory<AdminFactory> */
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

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** @return HasMany<OrderReport, $this> */
    public function resolvedReports(): HasMany
    {
        return $this->hasMany(OrderReport::class, 'resolved_by_admin_id');
    }

    /** @return HasMany<RiderCashRemittance, $this> */
    public function confirmedRemittances(): HasMany
    {
        return $this->hasMany(RiderCashRemittance::class, 'confirmed_by_admin_id');
    }
}
