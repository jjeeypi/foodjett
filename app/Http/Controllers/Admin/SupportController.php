<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\SupportTicket;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class SupportController extends Controller
{
    public function index(Request $request): Response
    {
        Gate::authorize('viewAny', SupportTicket::class);
        $validated = $request->validate([
            'status' => ['nullable', Rule::in(['open', 'in_progress', 'closed'])],
        ]);
        $status = $validated['status'] ?? null;

        $tickets = SupportTicket::query()
            ->with('user:id,name,email')
            ->when($status, fn ($query, string $value) => $query->where('status', $value))
            ->latest()
            ->paginate(15)
            ->withQueryString()
            ->through(fn (SupportTicket $ticket): array => [
                'id' => $ticket->id,
                'customer' => [
                    'name' => $ticket->user->name,
                    'email' => $ticket->user->email,
                ],
                'subject' => $ticket->subject,
                'message' => $ticket->message,
                'status' => $ticket->status,
                'created_at' => Carbon::parse($ticket->created_at)->toIso8601String(),
                'update_url' => route('admin.support.update', $ticket, absolute: false),
            ]);

        return Inertia::render('admin/support/index', [
            'tickets' => $tickets,
            'filters' => ['status' => $status],
        ]);
    }

    public function updateStatus(Request $request, SupportTicket $ticket): RedirectResponse
    {
        Gate::authorize('update', $ticket);
        $validated = $request->validate([
            'status' => ['required', Rule::in(['open', 'in_progress', 'closed'])],
        ]);
        $before = $ticket->status;
        $ticket->update(['status' => $validated['status']]);

        AuditLog::query()->create([
            'user_id' => $request->user()->id,
            'action' => 'support_ticket.status_updated',
            'subject_type' => SupportTicket::class,
            'subject_id' => $ticket->id,
            'changes' => [
                'before' => ['status' => $before],
                'after' => ['status' => $ticket->status],
            ],
            'created_at' => now(),
        ]);
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Ticket status updated.']);

        return back();
    }
}
