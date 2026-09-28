<?php

namespace Tests\Feature\Customer;

use App\Models\Admin;
use App\Models\AuditLog;
use App\Models\Customer;
use App\Models\SupportTicket;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class CustomerSupportTest extends TestCase
{
    use RefreshDatabase;

    public function test_customer_can_create_and_view_only_their_support_tickets(): void
    {
        $customer = Customer::factory()->create();
        $other = Customer::factory()->create();
        $otherTicket = SupportTicket::query()->create([
            'user_id' => $other->user_id,
            'subject' => 'Private ticket',
            'message' => 'Another customer owns this.',
            'status' => 'open',
        ]);

        $this->actingAs($customer->user)
            ->post(route('customer.account.support.store'), [
                'subject' => 'Account question',
                'message' => 'Please help me update an account setting.',
            ])
            ->assertSessionHasNoErrors();
        $ticket = $customer->user->supportTickets()->sole();

        $this->actingAs($customer->user)
            ->get(route('customer.account.support.show', $ticket))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('customer/account/support')
                ->has('tickets', 1)
                ->where('selectedTicket.id', $ticket->id)
                ->where('selectedTicket.message', $ticket->message));

        $this->actingAs($customer->user)
            ->get(route('customer.account.support.show', $otherTicket))
            ->assertForbidden();
    }

    public function test_admin_can_filter_and_update_ticket_status_with_audit_log(): void
    {
        $admin = Admin::factory()->create();
        $customer = Customer::factory()->create();
        $open = SupportTicket::query()->create([
            'user_id' => $customer->user_id,
            'subject' => 'Open issue',
            'message' => 'Please investigate.',
            'status' => 'open',
        ]);
        SupportTicket::query()->create([
            'user_id' => $customer->user_id,
            'subject' => 'Closed issue',
            'message' => 'Already handled.',
            'status' => 'closed',
        ]);

        $this->actingAs($admin->user)
            ->get(route('admin.support.index', ['status' => 'open']))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('admin/support/index')
                ->has('tickets.data', 1)
                ->where('tickets.data.0.id', $open->id)
                ->where('filters.status', 'open'));

        $this->actingAs($admin->user)
            ->patch(route('admin.support.update', $open), [
                'status' => 'in_progress',
            ])
            ->assertSessionHasNoErrors();

        $this->assertSame('in_progress', $open->refresh()->status);
        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $admin->user_id,
            'action' => 'support_ticket.status_updated',
            'subject_type' => SupportTicket::class,
            'subject_id' => $open->id,
        ]);
        $this->assertSame(1, AuditLog::query()->count());
    }
}
