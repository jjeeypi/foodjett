<?php

namespace Tests\Feature;

use App\Models\Admin;
use App\Models\Restaurant;
use App\Models\Rider;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RoleAccessControlTest extends TestCase
{
    use RefreshDatabase;

    public function test_each_role_can_access_its_own_dashboard(): void
    {
        $admin = Admin::factory()->create()->user;
        $restaurant = Restaurant::factory()->approved()->create();
        $rider = Rider::factory()->create(['approval_status' => 'approved'])->user;
        $customer = User::factory()->customer()->create();
        $customer->customer()->create();

        $this->actingAs($admin)->get(route('admin.dashboard'))->assertOk();
        $this->actingAs($restaurant->user)->get(route('restaurant.dashboard'))->assertOk();
        $this->actingAs($rider)->get(route('rider.dashboard'))->assertOk();
        $this->actingAs($customer)->get(route('customer.dashboard'))->assertOk();
    }

    public function test_users_cannot_access_another_roles_dashboard(): void
    {
        $customer = User::factory()->customer()->create();
        $customer->customer()->create();

        $this->actingAs($customer)->get(route('admin.dashboard'))->assertForbidden();
        $this->actingAs($customer)->get(route('restaurant.dashboard'))->assertForbidden();
        $this->actingAs($customer)->get(route('rider.dashboard'))->assertForbidden();
    }

    public function test_pending_restaurant_is_redirected_away_from_dashboard(): void
    {
        $restaurant = Restaurant::factory()->create(['approval_status' => 'pending']);

        $this->actingAs($restaurant->user)
            ->get(route('restaurant.dashboard'))
            ->assertRedirect(route('restaurant.pending'));

        $this->actingAs($restaurant->user)
            ->get(route('restaurant.pending'))
            ->assertOk();
    }

    public function test_pending_rider_is_redirected_away_from_dashboard(): void
    {
        $rider = Rider::factory()->create(['approval_status' => 'pending']);

        $this->actingAs($rider->user)
            ->get(route('rider.dashboard'))
            ->assertRedirect(route('rider.pending'));

        $this->actingAs($rider->user)
            ->get(route('rider.pending'))
            ->assertOk();
    }

    public function test_inactive_users_are_logged_out(): void
    {
        $user = User::factory()->customer()->create(['status' => 'suspended']);
        $user->customer()->create();

        $response = $this->actingAs($user)->get(route('customer.dashboard'));

        $response
            ->assertRedirect(route('login'))
            ->assertSessionHas('status', 'Your account has been suspended. Contact support if you believe this is a mistake.');
        $this->assertGuest();
    }
}
