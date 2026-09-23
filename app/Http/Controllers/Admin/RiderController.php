<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Rider;
use App\Models\RiderDocument;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class RiderController extends Controller
{
    public function index(Request $request): Response
    {
        Gate::authorize('viewAny', Rider::class);

        $filters = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'approval_status' => ['nullable', Rule::in(['pending', 'approved', 'rejected'])],
        ]);

        return Inertia::render('admin/riders/index', [
            'riders' => Rider::query()
                ->with('user:id,name,email,status')
                ->withAvg('reviews', 'rating')
                ->when(
                    $filters['search'] ?? null,
                    fn (Builder $query, string $search) => $query->whereHas(
                        'user',
                        fn (Builder $userQuery) => $userQuery->where('name', 'like', "%{$search}%")
                    )
                )
                ->when(
                    $filters['approval_status'] ?? null,
                    fn (Builder $query, string $status) => $query->where('approval_status', $status)
                )
                ->latest()
                ->paginate(15)
                ->withQueryString(),
            'filters' => [
                'search' => $filters['search'] ?? '',
                'approval_status' => $filters['approval_status'] ?? '',
            ],
        ]);
    }

    public function pending(): Response
    {
        Gate::authorize('viewAny', Rider::class);

        return Inertia::render('admin/riders/pending', [
            'riders' => Rider::query()
                ->with(['user:id,name,email,phone,status,created_at', 'documents'])
                ->where('approval_status', 'pending')
                ->oldest()
                ->paginate(8),
        ]);
    }

    public function show(Rider $rider): Response
    {
        Gate::authorize('view', $rider);

        $rider->load([
            'user:id,name,email,phone,status,created_at',
            'documents',
            'orders' => fn ($query) => $query
                ->with(['restaurant:id,name', 'customer.user:id,name'])
                ->latest('placed_at')
                ->limit(10),
        ])->loadAvg('reviews', 'rating');

        $assignedOrders = $rider->orders()->count();
        $declinedOffers = $rider->poolDeclines()->count();
        $consideredOffers = $assignedOrders + $declinedOffers;
        $riderCancellations = $rider->orders()->where('cancelled_by', 'rider')->count();

        return Inertia::render('admin/riders/show', [
            'rider' => $rider,
            'performance' => [
                'assigned_orders' => $assignedOrders,
                'delivered_orders' => $rider->orders()->where('status', 'delivered')->count(),
                'declined_offers' => $declinedOffers,
                'acceptance_rate' => $consideredOffers === 0
                    ? null
                    : round(($assignedOrders / $consideredOffers) * 100, 1),
                'cancellation_rate' => $assignedOrders === 0
                    ? null
                    : round(($riderCancellations / $assignedOrders) * 100, 1),
            ],
        ]);
    }

    public function approve(Rider $rider): RedirectResponse
    {
        Gate::authorize('approve', $rider);

        $before = $rider->only(['approval_status', 'rejection_reason']);
        $rider->update(['approval_status' => 'approved', 'rejection_reason' => null]);
        $this->audit($rider, 'rider.approved', $before, $rider->only([
            'approval_status',
            'rejection_reason',
        ]));

        return to_route('admin.riders.pending')
            ->with('success', "{$rider->user->name} has been approved.");
    }

    public function reject(Request $request, Rider $rider): RedirectResponse
    {
        Gate::authorize('reject', $rider);

        $validated = $request->validate([
            'reason' => ['required', 'string', 'max:1000'],
        ]);
        $before = $rider->only(['approval_status', 'rejection_reason', 'availability_status']);
        $rider->update([
            'approval_status' => 'rejected',
            'rejection_reason' => $validated['reason'],
            'availability_status' => 'offline',
        ]);
        $this->audit($rider, 'rider.rejected', $before, $rider->only([
            'approval_status',
            'rejection_reason',
            'availability_status',
        ]));

        return to_route('admin.riders.pending')
            ->with('success', "{$rider->user->name} has been rejected.");
    }

    public function suspend(Request $request, Rider $rider): RedirectResponse
    {
        Gate::authorize('suspend', $rider);

        $validated = $request->validate([
            'action' => ['required', Rule::in(['suspend', 'reactivate'])],
        ]);
        $user = $rider->user;
        abort_if($user === null, 422, 'This rider does not have a user account.');
        abort_if($user->status === 'banned', 422, 'A banned account cannot be toggled with suspension controls.');

        $before = [
            'user_status' => $user->status,
            'availability_status' => $rider->availability_status,
        ];

        DB::transaction(function () use ($rider, $user, $validated): void {
            $isSuspending = $validated['action'] === 'suspend';
            $user->update(['status' => $isSuspending ? 'suspended' : 'active']);

            if ($isSuspending) {
                $rider->update(['availability_status' => 'offline']);
            }
        });

        $rider->refresh();
        $this->audit(
            $rider,
            $validated['action'] === 'suspend' ? 'rider.suspended' : 'rider.reactivated',
            $before,
            [
                'user_status' => $rider->user()->value('status'),
                'availability_status' => $rider->availability_status,
            ]
        );

        return back()->with(
            'success',
            $validated['action'] === 'suspend'
                ? "{$rider->user->name} has been suspended."
                : "{$rider->user->name} has been reactivated."
        );
    }

    public function verifyDocument(Rider $rider, RiderDocument $document): RedirectResponse
    {
        Gate::authorize('approve', $rider);
        Gate::authorize('verify', $document);
        abort_unless($document->rider_id === $rider->id, 404);

        $before = $document->only(['status', 'rejection_reason']);
        $document->update(['status' => 'verified', 'rejection_reason' => null]);
        $this->audit($document, 'rider_document.verified', $before, $document->only([
            'status',
            'rejection_reason',
        ]));

        return back()->with('success', 'Rider document verified.');
    }

    public function rejectDocument(Request $request, Rider $rider, RiderDocument $document): RedirectResponse
    {
        Gate::authorize('approve', $rider);
        Gate::authorize('reject', $document);
        abort_unless($document->rider_id === $rider->id, 404);

        $validated = $request->validate([
            'reason' => ['required', 'string', 'max:1000'],
        ]);
        $before = $document->only(['status', 'rejection_reason']);
        $document->update([
            'status' => 'rejected',
            'rejection_reason' => $validated['reason'],
        ]);
        $this->audit($document, 'rider_document.rejected', $before, $document->only([
            'status',
            'rejection_reason',
        ]));

        return back()->with('success', 'Rider document rejected.');
    }

    /**
     * @param  array<string, mixed>  $before
     * @param  array<string, mixed>  $after
     */
    private function audit(Model $subject, string $action, array $before, array $after): void
    {
        AuditLog::query()->create([
            'user_id' => request()->user()?->id,
            'action' => $action,
            'subject_type' => $subject::class,
            'subject_id' => (int) $subject->getKey(),
            'changes' => ['before' => $before, 'after' => $after],
            'created_at' => now(),
        ]);
    }
}
