<?php

namespace Database\Factories;

use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * @extends Factory<User>
 */
class UserFactory extends Factory
{
    protected static ?string $password;

    /** @var list<string> */
    private static array $maleFirstNames = [
        'Jose', 'Juan', 'Miguel', 'Carlo', 'Ramon', 'Rodel', 'Benjie', 'Noel',
        'Jayson', 'Mark', 'Kevin', 'Jerome', 'Ronnie', 'Dennis', 'Arjay', 'Gilbert',
        'Renz', 'Alvin', 'Jobert', 'Efren',
    ];

    /** @var list<string> */
    private static array $femaleFirstNames = [
        'Maria', 'Ana', 'Liza', 'Jasmine', 'Precious', 'Christine', 'Lovely', 'Angel',
        'Gina', 'Rona', 'Sheila', 'Maricel', 'Joy', 'Daisy', 'Len', 'Rhea',
        'Marivic', 'Cristina', 'Rowena', 'Rosalie',
    ];

    /** @var list<string> */
    private static array $lastNames = [
        'Santos', 'Reyes', 'Cruz', 'Garcia', 'Dela Cruz', 'Bautista', 'Aquino',
        'Villanueva', 'Gonzales', 'Mendoza', 'Flores', 'Ramos', 'Castillo',
        'Tolentino', 'Mercado', 'Magno', 'Abella', 'Borromeo', 'Lim', 'Tan',
        'Sabanal', 'Cabanero', 'Almacen', 'Espinosa', 'Cabahug',
    ];

    private function filipinoName(): string
    {
        $isMale = $this->faker->boolean();
        $first = $isMale
            ? $this->faker->randomElement(self::$maleFirstNames)
            : $this->faker->randomElement(self::$femaleFirstNames);
        $last = $this->faker->randomElement(self::$lastNames);

        return "{$first} {$last}";
    }

    public function definition(): array
    {
        return [
            'name' => $this->filipinoName(),
            'email' => $this->faker->unique()->safeEmail(),
            'phone' => null,
            'role' => 'customer',
            'status' => 'active',
            'email_verified_at' => now(),
            'phone_verified_at' => null,
            'avatar_path' => null,
            'last_login_at' => $this->faker->dateTimeBetween('-30 days', 'now'),
            'password' => static::$password ??= Hash::make('password'),
            'remember_token' => Str::random(10),
            /* @chisel-2fa */
            'two_factor_secret' => null,
            'two_factor_recovery_codes' => null,
            'two_factor_confirmed_at' => null,
            /* @end-chisel-2fa */
        ];
    }

    public function unverified(): static
    {
        return $this->state(fn () => ['email_verified_at' => null]);
    }

    public function withTwoFactor(): static
    {
        /* @chisel-2fa */
        return $this->state(fn () => [
            'two_factor_secret' => encrypt('secret'),
            'two_factor_recovery_codes' => encrypt(json_encode(['recovery-code-1'])),
            'two_factor_confirmed_at' => now(),
        ]);
        /* @end-chisel-2fa */
    }

    public function admin(): static
    {
        return $this->state(fn () => ['role' => 'admin', 'email' => 'admin@foodjett.ph']);
    }

    public function restaurantOwner(): static
    {
        return $this->state(fn () => ['role' => 'restaurant']);
    }

    public function rider(): static
    {
        return $this->state(fn () => ['role' => 'rider']);
    }

    public function customer(): static
    {
        return $this->state(fn () => ['role' => 'customer']);
    }
}
