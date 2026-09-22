<?php

namespace Tests\Feature\Auth;

use App\Models\Admin;
use App\Models\Restaurant;
use App\Models\Rider;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\RateLimiter;
use Laravel\Fortify\Features;
use Tests\TestCase;

class AuthenticationTest extends TestCase
{
    use RefreshDatabase;

    public function test_login_screen_can_be_rendered()
    {
        $response = $this->get(route('login'));

        $response->assertOk();
    }

    public function test_users_can_authenticate_using_the_login_screen()
    {
        $user = User::factory()->create();

        $response = $this->post(route('login.store'), [
            'email' => $user->email,
            'password' => 'password',
        ]);

        $this->assertAuthenticated();
        $response->assertRedirect(route('customer.dashboard', absolute: false));
    }

    public function test_users_with_two_factor_enabled_are_redirected_to_two_factor_challenge()
    {
        $this->skipUnlessFortifyHas(Features::twoFactorAuthentication());

        Features::twoFactorAuthentication([
            'confirm' => true,
            'confirmPassword' => true,
        ]);

        $user = User::factory()->withTwoFactor()->create();

        $response = $this->post(route('login'), [
            'email' => $user->email,
            'password' => 'password',
        ]);

        $response->assertRedirect(route('two-factor.login'));
        $response->assertSessionHas('login.id', $user->id);
        $this->assertGuest();
    }

    public function test_users_can_not_authenticate_with_invalid_password()
    {
        $user = User::factory()->create();

        $this->post(route('login.store'), [
            'email' => $user->email,
            'password' => 'wrong-password',
        ]);

        $this->assertGuest();
    }

    public function test_inactive_users_are_logged_back_out_after_authentication(): void
    {
        $user = User::factory()->create(['status' => 'banned']);

        $response = $this->post(route('login.store'), [
            'email' => $user->email,
            'password' => 'password',
        ]);

        $response
            ->assertRedirect(route('login'))
            ->assertSessionHas('status', 'Your account has been banned. Contact support if you believe this is a mistake.');
        $this->assertGuest();
    }

    public function test_admins_are_redirected_to_the_admin_dashboard(): void
    {
        $admin = Admin::factory()->create()->user;

        $response = $this->post(route('login.store'), [
            'email' => $admin->email,
            'password' => 'password',
        ]);

        $response->assertRedirect(route('admin.dashboard', absolute: false));
    }

    public function test_pending_restaurants_are_redirected_to_the_pending_page(): void
    {
        $restaurant = Restaurant::factory()->create(['approval_status' => 'pending']);

        $response = $this->post(route('login.store'), [
            'email' => $restaurant->user->email,
            'password' => 'password',
        ]);

        $response->assertRedirect(route('restaurant.pending', absolute: false));
    }

    public function test_approved_restaurants_are_redirected_to_their_dashboard(): void
    {
        $restaurant = Restaurant::factory()->approved()->create();

        $response = $this->post(route('login.store'), [
            'email' => $restaurant->user->email,
            'password' => 'password',
        ]);

        $response->assertRedirect(route('restaurant.dashboard', absolute: false));
    }

    public function test_pending_riders_are_redirected_to_the_pending_page(): void
    {
        $rider = Rider::factory()->create(['approval_status' => 'pending']);

        $response = $this->post(route('login.store'), [
            'email' => $rider->user->email,
            'password' => 'password',
        ]);

        $response->assertRedirect(route('rider.pending', absolute: false));
    }

    public function test_users_can_logout()
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)->post(route('logout'));

        $response->assertRedirect(route('home'));

        $this->assertGuest();
    }

    public function test_users_are_rate_limited()
    {
        $user = User::factory()->create();

        RateLimiter::increment(md5('login'.implode('|', [$user->email, '127.0.0.1'])), amount: 5);

        $response = $this->post(route('login.store'), [
            'email' => $user->email,
            'password' => 'wrong-password',
        ]);

        $response->assertTooManyRequests();
    }
}
