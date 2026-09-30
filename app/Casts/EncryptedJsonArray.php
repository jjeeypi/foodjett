<?php

namespace App\Casts;

use Illuminate\Contracts\Database\Eloquent\CastsAttributes;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Crypt;
use JsonException;

/**
 * Stores an encrypted payload inside a JSON object so it remains compatible
 * with the existing JSON database column. Legacy plain JSON remains readable
 * and is encrypted the next time the attribute is saved.
 *
 * @implements CastsAttributes<array<string, mixed>|null, array<string, mixed>|null>
 */
class EncryptedJsonArray implements CastsAttributes
{
    /**
     * @param  array<string, mixed>  $attributes
     * @return array<string, mixed>|null
     *
     * @throws JsonException
     */
    public function get(Model $model, string $key, mixed $value, array $attributes): ?array
    {
        if ($value === null || $value === '') {
            return null;
        }

        $decoded = json_decode((string) $value, true, 512, JSON_THROW_ON_ERROR);

        if (! is_array($decoded)) {
            return null;
        }

        $ciphertext = $decoded['encrypted'] ?? null;
        if (! is_string($ciphertext)) {
            return $decoded;
        }

        $decrypted = json_decode(Crypt::decryptString($ciphertext), true, 512, JSON_THROW_ON_ERROR);

        return is_array($decrypted) ? $decrypted : null;
    }

    /**
     * @param  array<string, mixed>  $attributes
     *
     * @throws JsonException
     */
    public function set(Model $model, string $key, mixed $value, array $attributes): ?string
    {
        if ($value === null) {
            return null;
        }

        return json_encode([
            'encrypted' => Crypt::encryptString(json_encode($value, JSON_THROW_ON_ERROR)),
        ], JSON_THROW_ON_ERROR);
    }
}
