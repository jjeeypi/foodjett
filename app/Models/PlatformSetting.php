<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Cache;

class PlatformSetting extends Model
{
    protected $fillable = [
        'key',
        'value',
        'description',
    ];

    private const CACHE_PREFIX = 'platform-setting:';

    protected static function booted(): void
    {
        static::saved(fn (self $setting) => static::forgetCached($setting->key));
        static::deleted(fn (self $setting) => static::forgetCached($setting->key));
    }

    /** Retrieve a cached setting value by key, with an optional default. */
    public static function get(string $key, mixed $default = null): mixed
    {
        $value = Cache::rememberForever(
            self::CACHE_PREFIX.$key,
            fn (): ?string => static::query()->where('key', $key)->value('value')
        );

        return $value ?? $default;
    }

    public static function getFloat(string $key, float $default): float
    {
        $value = static::get($key, $default);

        return is_numeric($value) ? (float) $value : $default;
    }

    public static function getInt(string $key, int $default): int
    {
        $value = static::get($key, $default);

        return is_numeric($value) ? (int) $value : $default;
    }

    public static function forgetCached(string $key): void
    {
        Cache::forget(self::CACHE_PREFIX.$key);
    }
}
