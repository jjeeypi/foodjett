<?php

namespace Tests\Feature\Auth;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RoleRegistrationTest extends TestCase
{
    use RefreshDatabase;

    public function test_restaurant_registration_screen_can_be_rendered(): void
    {
        $this->get(route('register.restaurant'))->assertOk();
    }

    public function test_restaurant_owners_can_register(): void
    {
        $response = $this->post(route('register.restaurant.store'), [
            'name' => 'Maria Santos',
            'email' => 'owner@example.com',
            'phone' => '09171234567',
            'password' => 'password',
            'password_confirmation' => 'password',
            'restaurant_name' => 'Maria Kitchen',
            'address' => 'Rizal Boulevard, Dumaguete City',
            'latitude' => 9.3068,
            'longitude' => 123.3054,
            'cuisine_type' => 'Filipino',
        ]);

        $response->assertRedirect(route('restaurant.pending'));
        $this->assertAuthenticated();

        $user = User::where('email', 'owner@example.com')->firstOrFail();

        $this->assertTrue($user->isRestaurant());
        $this->assertSame('pending', $user->restaurant?->approval_status);
        $this->assertSame('closed', $user->restaurant?->operating_status);
        $this->assertSame('maria-kitchen', $user->restaurant?->slug);
    }

    public function test_rider_registration_screen_can_be_rendered(): void
    {
        $this->get(route('register.rider'))->assertOk();
    }

    public function test_riders_can_register(): void
    {
        $response = $this->post(route('register.rider.store'), [
            'name' => 'Juan Rider',
            'email' => 'rider@example.com',
            'phone' => '09179876543',
            'password' => 'password',
            'password_confirmation' => 'password',
            'vehicle_type' => 'motorcycle',
            'plate_number' => 'ABC-1234',
        ]);

        $response->assertRedirect(route('rider.pending'));
        $this->assertAuthenticated();

        $user = User::where('email', 'rider@example.com')->firstOrFail();

        $this->assertTrue($user->isRider());
        $this->assertSame('pending', $user->rider?->approval_status);
        $this->assertSame('offline', $user->rider?->availability_status);
    }

    public function test_bicycle_riders_do_not_need_a_plate_number(): void
    {
        $response = $this->post(route('register.rider.store'), [
            'name' => 'Ana Rider',
            'email' => 'ana@example.com',
            'phone' => '09170000000',
            'password' => 'password',
            'password_confirmation' => 'password',
            'vehicle_type' => 'bicycle',
            'plate_number' => null,
        ]);

        $response->assertSessionHasNoErrors();
        $this->assertNull(User::where('email', 'ana@example.com')->firstOrFail()->rider?->plate_number);
    }
}
