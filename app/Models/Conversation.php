<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $order_id
 * @property string $type
 * @property Carbon|null $closed_at
 */
class Conversation extends Model
{
    public const CUSTOMER_RIDER = 'customer_rider';

    public const CUSTOMER_RESTAURANT = 'customer_restaurant';

    /** @var list<string> */
    public const TYPES = [self::CUSTOMER_RIDER, self::CUSTOMER_RESTAURANT];

    protected $fillable = [
        'order_id',
        'type',
        'closed_at',
    ];

    protected function casts(): array
    {
        return [
            'closed_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<Order, $this> */
    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    /** @return HasMany<Message, $this> */
    public function messages(): HasMany
    {
        return $this->hasMany(Message::class);
    }

    /** @return HasOne<Message, $this> */
    public function latestMessage(): HasOne
    {
        return $this->hasOne(Message::class)->latestOfMany();
    }

    public function isClosed(): bool
    {
        return $this->closed_at !== null && $this->closed_at->isPast();
    }
}
