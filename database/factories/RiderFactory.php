<?php

namespace Database\Factories;

use App\Models\Rider;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Rider>
 */
class RiderFactory extends Factory
{
    public function definition(): array
    {
        $approvalStatus = $this->faker->randomElement([
            'approved', 'approved', 'approved', 'approved', 'pending', 'rejected',
        ]);

        return [
            'user_id' => User::factory()->rider(),
            'vehicle_type' => $this->faker->randomElement(['motorcycle', 'motorcycle', 'bicycle']),
            'plate_number' => strtoupper($this->faker->bothify('??-####')),
            'approval_status' => $approvalStatus,
            'rejection_reason' => $approvalStatus === 'rejected' ? 'Incomplete documents submitted.' : null,
            'availability_status' => $approvalStatus === 'approved'
                ? $this->faker->randomElement(['available', 'available', 'offline', 'busy'])
                : 'offline',
            'current_latitude' => $this->faker->randomFloat(7, 9.3000, 9.3200),
            'current_longitude' => $this->faker->randomFloat(7, 123.2900, 123.3100),
            'last_location_at' => $this->faker->dateTimeBetween('-2 hours', 'now'),
            'cash_on_hand' => 0.00,
            'cash_remit_limit' => 500.00,
            'payout_method' => $this->faker->randomElement(['bank', 'ewallet']),
            'payout_account_details' => ['account_number' => $this->faker->numerify('###########')],
        ];
    }

    public function approved(): static
    {
        return $this->state(fn () => [
            'approval_status' => 'approved',
            'availability_status' => 'available',
        ]);
    }
}
