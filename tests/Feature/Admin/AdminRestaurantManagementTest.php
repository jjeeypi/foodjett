<?php

namespace Tests\Feature\Admin;

use App\Models\Admin;
use App\Models\AuditLog;
use App\Models\Customer;
use App\Models\Restaurant;
use App\Models\RestaurantDocument;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class AdminRestaurantManagementTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_filter_the_paginated_restaurant_list(): void
    {
        $admin = Admin::factory()->create();
        Restaurant::factory()->create([
            'name' => 'Searchable Kitchen',
            'approval_status' => 'pending',
        ]);
        Restaurant::factory()->approved()->create(['name' => 'Different Bistro']);

        $this->actingAs($admin->user)
            ->get(route('admin.restaurants.index', [
                'search' => 'Searchable',
                'approval_status' => 'pending',
            ]))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('admin/restaurants/index')
                ->where('filters.search', 'Searchable')
                ->where('filters.approval_status', 'pending')
                ->has('restaurants.data', 1)
                ->where('restaurants.data.0.name', 'Searchable Kitchen')
                ->has('restaurants.links'));
    }

    public function test_pending_queue_includes_submitted_documents(): void
    {
        $admin = Admin::factory()->create();
        $restaurant = Restaurant::factory()->create(['approval_status' => 'pending']);
        RestaurantDocument::factory()->create([
            'restaurant_id' => $restaurant->id,
            'type' => 'business_permit',
            'status' => 'pending',
        ]);

        $this->actingAs($admin->user)
            ->get(route('admin.restaurants.pending'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('admin/restaurants/pending')
                ->has('restaurants.data', 1)
                ->where('restaurants.data.0.id', $restaurant->id)
                ->has('restaurants.data.0.documents', 1));
    }

    public function test_admin_can_approve_and_reject_restaurant_applications(): void
    {
        $admin = Admin::factory()->create();
        $approvedRestaurant = Restaurant::factory()->create([
            'approval_status' => 'pending',
            'rejection_reason' => 'An old reason.',
        ]);
        $rejectedRestaurant = Restaurant::factory()->create([
            'approval_status' => 'pending',
            'operating_status' => 'open',
        ]);

        $this->actingAs($admin->user)
            ->patch(route('admin.restaurants.approve', $approvedRestaurant))
            ->assertRedirect();
        $this->assertDatabaseHas('restaurants', [
            'id' => $approvedRestaurant->id,
            'approval_status' => 'approved',
            'rejection_reason' => null,
        ]);

        $reason = 'The submitted business permit is not readable.';
        $this->actingAs($admin->user)
            ->patch(route('admin.restaurants.reject', $rejectedRestaurant), [
                'reason' => $reason,
            ])
            ->assertRedirect();
        $this->assertDatabaseHas('restaurants', [
            'id' => $rejectedRestaurant->id,
            'approval_status' => 'rejected',
            'rejection_reason' => $reason,
            'operating_status' => 'closed',
        ]);
        $this->assertSame(2, AuditLog::query()->count());
    }

    public function test_admin_can_suspend_and_reactivate_a_restaurant_owner_account(): void
    {
        $admin = Admin::factory()->create();
        $restaurant = Restaurant::factory()->approved()->create([
            'operating_status' => 'open',
        ]);

        $this->actingAs($admin->user)
            ->patch(route('admin.restaurants.suspension', $restaurant), [
                'action' => 'suspend',
            ])
            ->assertRedirect();
        $this->assertDatabaseHas('users', [
            'id' => $restaurant->user_id,
            'status' => 'suspended',
        ]);
        $this->assertDatabaseHas('restaurants', [
            'id' => $restaurant->id,
            'operating_status' => 'closed',
        ]);

        $this->actingAs($admin->user)
            ->patch(route('admin.restaurants.suspension', $restaurant), [
                'action' => 'reactivate',
            ])
            ->assertRedirect();
        $this->assertDatabaseHas('users', [
            'id' => $restaurant->user_id,
            'status' => 'active',
        ]);
    }

    public function test_customer_cannot_manage_restaurants(): void
    {
        $customer = Customer::factory()->create();
        $restaurant = Restaurant::factory()->create();

        $this->actingAs($customer->user)
            ->patch(route('admin.restaurants.approve', $restaurant))
            ->assertForbidden();
    }
}
