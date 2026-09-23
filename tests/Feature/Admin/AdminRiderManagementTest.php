<?php

namespace Tests\Feature\Admin;

use App\Models\Admin;
use App\Models\AuditLog;
use App\Models\Customer;
use App\Models\Rider;
use App\Models\RiderDocument;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class AdminRiderManagementTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_filter_the_paginated_rider_list(): void
    {
        $admin = Admin::factory()->create();
        $searchableUser = User::factory()->rider()->create([
            'name' => 'Searchable Rider',
        ]);
        Rider::factory()->create([
            'approval_status' => 'pending',
            'user_id' => $searchableUser->id,
        ]);
        Rider::factory()->approved()->create();

        $this->actingAs($admin->user)
            ->get(route('admin.riders.index', [
                'search' => 'Searchable',
                'approval_status' => 'pending',
            ]))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('admin/riders/index')
                ->where('filters.search', 'Searchable')
                ->where('filters.approval_status', 'pending')
                ->has('riders.data', 1)
                ->where('riders.data.0.user.name', 'Searchable Rider')
                ->has('riders.links'));
    }

    public function test_pending_queue_includes_rider_documents(): void
    {
        $admin = Admin::factory()->create();
        $rider = Rider::factory()->create(['approval_status' => 'pending']);
        RiderDocument::factory()->create([
            'rider_id' => $rider->id,
            'type' => 'drivers_license',
            'status' => 'pending',
        ]);

        $this->actingAs($admin->user)
            ->get(route('admin.riders.pending'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('admin/riders/pending')
                ->has('riders.data', 1)
                ->where('riders.data.0.id', $rider->id)
                ->has('riders.data.0.documents', 1));
    }

    public function test_admin_can_approve_and_reject_rider_applications(): void
    {
        $admin = Admin::factory()->create();
        $approvedRider = Rider::factory()->create(['approval_status' => 'pending']);
        $rejectedRider = Rider::factory()->create([
            'approval_status' => 'pending',
            'availability_status' => 'available',
        ]);

        $this->actingAs($admin->user)
            ->patch(route('admin.riders.approve', $approvedRider))
            ->assertRedirect(route('admin.riders.pending'))
            ->assertSessionHas('success');
        $this->assertDatabaseHas('riders', [
            'id' => $approvedRider->id,
            'approval_status' => 'approved',
            'rejection_reason' => null,
        ]);

        $reason = 'The submitted licence could not be validated.';
        $this->actingAs($admin->user)
            ->patch(route('admin.riders.reject', $rejectedRider), [
                'reason' => $reason,
            ])
            ->assertRedirect(route('admin.riders.pending'))
            ->assertSessionHas('success');
        $this->assertDatabaseHas('riders', [
            'id' => $rejectedRider->id,
            'approval_status' => 'rejected',
            'rejection_reason' => $reason,
            'availability_status' => 'offline',
        ]);
        $this->assertSame(2, AuditLog::query()->count());
    }

    public function test_admin_can_verify_and_reject_individual_rider_documents(): void
    {
        $admin = Admin::factory()->create();
        $rider = Rider::factory()->create(['approval_status' => 'pending']);
        $verifiedDocument = RiderDocument::factory()->create([
            'rider_id' => $rider->id,
            'status' => 'pending',
        ]);
        $rejectedDocument = RiderDocument::factory()->create([
            'rider_id' => $rider->id,
            'status' => 'pending',
        ]);

        $this->actingAs($admin->user)
            ->patch(route('admin.riders.documents.verify', [$rider, $verifiedDocument]))
            ->assertRedirect();
        $this->assertDatabaseHas('rider_documents', [
            'id' => $verifiedDocument->id,
            'status' => 'verified',
            'rejection_reason' => null,
        ]);

        $reason = 'The ID photo is unreadable and must be uploaded again.';
        $this->actingAs($admin->user)
            ->patch(
                route('admin.riders.documents.reject', [$rider, $rejectedDocument]),
                ['reason' => $reason]
            )
            ->assertRedirect();
        $this->assertDatabaseHas('rider_documents', [
            'id' => $rejectedDocument->id,
            'status' => 'rejected',
            'rejection_reason' => $reason,
        ]);
    }

    public function test_admin_can_suspend_and_reactivate_a_rider_account(): void
    {
        $admin = Admin::factory()->create();
        $rider = Rider::factory()->approved()->create([
            'availability_status' => 'available',
        ]);

        $this->actingAs($admin->user)
            ->patch(route('admin.riders.suspension', $rider), ['action' => 'suspend'])
            ->assertRedirect();
        $this->assertDatabaseHas('users', [
            'id' => $rider->user_id,
            'status' => 'suspended',
        ]);
        $this->assertDatabaseHas('riders', [
            'id' => $rider->id,
            'availability_status' => 'offline',
        ]);

        $this->actingAs($admin->user)
            ->patch(route('admin.riders.suspension', $rider), ['action' => 'reactivate'])
            ->assertRedirect();
        $this->assertDatabaseHas('users', [
            'id' => $rider->user_id,
            'status' => 'active',
        ]);
    }

    public function test_customer_cannot_manage_riders(): void
    {
        $customer = Customer::factory()->create();
        $rider = Rider::factory()->create();

        $this->actingAs($customer->user)
            ->patch(route('admin.riders.approve', $rider))
            ->assertForbidden();
    }
}
