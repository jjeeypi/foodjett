<?php

namespace App\Http\Controllers\Customer;

use App\Http\Controllers\Controller;
use App\Models\SupportTicket;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class SupportController extends Controller
{
    public function index(Request $request): Response
    {
        Gate::authorize('viewAny', SupportTicket::class);

        return $this->render($request);
    }

    public function show(Request $request, SupportTicket $ticket): Response
    {
        Gate::authorize('view', $ticket);

        return $this->render($request, $ticket);
    }

    public function store(Request $request): RedirectResponse
    {
        Gate::authorize('create', SupportTicket::class);
        $validated = $request->validate([
            'subject' => ['required', 'string', 'max:150'],
            'message' => ['required', 'string', 'max:3000'],
        ]);

        $ticket = $request->user()->supportTickets()->create([
            ...$validated,
            'status' => 'open',
        ]);
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Support ticket submitted.']);

        return to_route('customer.account.support.show', $ticket);
    }

    private function render(Request $request, ?SupportTicket $selected = null): Response
    {
        $tickets = $request->user()->supportTickets()
            ->latest()
            ->get()
            ->map(fn (SupportTicket $ticket): array => $this->ticketData($ticket, false))
            ->values();

        return Inertia::render('customer/account/support', [
            'tickets' => $tickets,
            'selectedTicket' => $selected === null
                ? null
                : $this->ticketData($selected, true),
        ]);
    }

    /** @return array<string, mixed> */
    private function ticketData(SupportTicket $ticket, bool $withMessage): array
    {
        return [
            'id' => $ticket->id,
            'subject' => $ticket->subject,
            'status' => $ticket->status,
            'created_at' => Carbon::parse($ticket->created_at)->toIso8601String(),
            'show_url' => route('customer.account.support.show', $ticket, absolute: false),
            ...($withMessage ? ['message' => $ticket->message] : []),
        ];
    }
}
