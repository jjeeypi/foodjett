<?php

namespace App\Models;

use Database\Factories\RestaurantDocumentFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RestaurantDocument extends Model
{
    /** @use HasFactory<RestaurantDocumentFactory> */
    use HasFactory;

    protected $fillable = [
        'restaurant_id',
        'type',
        'file_path',
        'status',
    ];

    /** @return BelongsTo<Restaurant, $this> */
    public function restaurant(): BelongsTo
    {
        return $this->belongsTo(Restaurant::class);
    }
}
