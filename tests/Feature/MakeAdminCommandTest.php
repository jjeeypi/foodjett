<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MakeAdminCommandTest extends TestCase
{
    use RefreshDatabase;

    public function test_command_creates_a_verified_admin_with_a_profile(): void
    {
        $this->artisan('make:admin', [
            'name' => 'FoodJett Operator',
            'email' => 'operator@example.com',
            'password' => 'password',
        ])->assertSuccessful();

        $user = User::where('email', 'operator@example.com')->firstOrFail();

        $this->assertTrue($user->isAdmin());
        $this->assertTrue($user->hasVerifiedEmail());
        $this->assertNotNull($user->admin);
    }
}
