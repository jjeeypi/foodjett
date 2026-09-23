<?php

namespace App\Models;

use Database\Factories\RiderDocumentFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RiderDocument extends Model
{
    /** @use HasFactory<RiderDocumentFactory> */
    use HasFactory;

    protected $fillable = [
        'rider_id',
        'type',
        'file_path',
        'status',
        'rejection_reason',
    ];

    /** @return BelongsTo<Rider, $this> */
    public function rider(): BelongsTo
    {
        return $this->belongsTo(Rider::class);
    }
}
