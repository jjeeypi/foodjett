<?php

namespace App\Models;

use Database\Factories\RestaurantOperatingHourFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RestaurantOperatingHour extends Model
{
    /** @use HasFactory<RestaurantOperatingHourFactory> */
    use HasFactory;

    protected $fillable = [
        'restaurant_id',
        'day_of_week',
        'opens_at',
        'closes_at',
    ];

    protected function casts(): array
    {
        return [
            'day_of_week' => 'integer',
        ];
    }

    /** @return BelongsTo<Restaurant, $this> */
    public function restaurant(): BelongsTo
    {
        return $this->belongsTo(Restaurant::class);
    }
}
