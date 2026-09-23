<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Restaurant;
use App\Models\RestaurantDocument;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class RestaurantController extends Controller
{
    public function index(Request $request): Response
    {
        Gate::authorize('viewAny', Restaurant::class);

        $filters = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'approval_status' => ['nullable', Rule::in(['pending', 'approved', 'rejected'])],
        ]);

        return Inertia::render('admin/restaurants/index', [
            'restaurants' => Restaurant::query()
                ->with('user:id,name,email,status')
                ->withAvg('reviews', 'rating')
                ->when(
                    $filters['search'] ?? null,
                    fn (Builder $query, string $search) => $query->where('name', 'like', "%{$search}%")
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
        Gate::authorize('viewAny', Restaurant::class);

        return Inertia::render('admin/restaurants/pending', [
            'restaurants' => Restaurant::query()
                ->with(['user:id,name,email,phone,status,created_at', 'documents'])
                ->where('approval_status', 'pending')
                ->oldest()
                ->paginate(8),
        ]);
    }

    public function show(Restaurant $restaurant): Response
    {
        Gate::authorize('view', $restaurant);

        $restaurant->load([
            'user:id,name,email,phone,status,created_at',
            'documents',
            'operatingHours' => fn ($query) => $query->orderBy('day_of_week'),
            'menuCategories' => fn ($query) => $query
                ->withCount('menuItems')
                ->orderBy('sort_order'),
            'orders' => fn ($query) => $query
                ->with('customer.user:id,name')
                ->latest('placed_at')
                ->limit(10),
        ])->loadAvg('reviews', 'rating');

        $prepOrders = $restaurant->orders()
            ->whereNotNull('estimated_ready_at')
            ->whereNotNull('ready_at')
            ->get(['id', 'estimated_ready_at', 'ready_at']);
        $prepVariances = $prepOrders->map(
            fn ($order): float => Carbon::parse($order->estimated_ready_at)
                ->diffInMinutes(Carbon::parse($order->ready_at), false)
        );
        $onTimeCount = $prepVariances->filter(fn (float $minutes): bool => $minutes <= 0)->count();

        return Inertia::render('admin/restaurants/show', [
            'restaurant' => $restaurant,
            'menuSummary' => [
                'category_count' => $restaurant->menuCategories->count(),
                'item_count' => $restaurant->menuCategories->sum('menu_items_count'),
            ],
            'prepTimeAccuracy' => [
                'sample_size' => $prepOrders->count(),
                'on_time_count' => $onTimeCount,
                'on_time_percentage' => $prepOrders->isEmpty()
                    ? null
                    : round(($onTimeCount / $prepOrders->count()) * 100, 1),
                'average_variance_minutes' => $prepVariances->isEmpty()
                    ? null
                    : round($prepVariances->average(), 1),
            ],
        ]);
    }

    public function approve(Restaurant $restaurant): RedirectResponse
    {
        Gate::authorize('approve', $restaurant);

        $before = $restaurant->only(['approval_status', 'rejection_reason']);
        $restaurant->update([
            'approval_status' => 'approved',
            'rejection_reason' => null,
        ]);
        $this->audit($restaurant, 'restaurant.approved', $before, $restaurant->only([
            'approval_status',
            'rejection_reason',
        ]));

        return to_route('admin.restaurants.pending')
            ->with('success', "{$restaurant->name} has been approved.");
    }

    public function reject(Request $request, Restaurant $restaurant): RedirectResponse
    {
        Gate::authorize('reject', $restaurant);

        $validated = $request->validate([
            'reason' => ['required', 'string', 'max:1000'],
        ]);
        $before = $restaurant->only(['approval_status', 'rejection_reason', 'operating_status']);
        $restaurant->update([
            'approval_status' => 'rejected',
            'rejection_reason' => $validated['reason'],
            'operating_status' => 'closed',
        ]);
        $this->audit($restaurant, 'restaurant.rejected', $before, $restaurant->only([
            'approval_status',
            'rejection_reason',
            'operating_status',
        ]));

        return to_route('admin.restaurants.pending')
            ->with('success', "{$restaurant->name} has been rejected.");
    }

    public function updateCommission(Request $request, Restaurant $restaurant): RedirectResponse
    {
        Gate::authorize('update', $restaurant);

        $validated = $request->validate([
            'commission_rate' => ['required', 'numeric', 'min:0', 'max:100'],
        ]);
        $before = $restaurant->only('commission_rate');
        $restaurant->update(['commission_rate' => $validated['commission_rate']]);
        $this->audit(
            $restaurant,
            'restaurant.commission_updated',
            $before,
            $restaurant->only('commission_rate')
        );

        return back()->with('success', 'Commission rate updated.');
    }

    public function suspend(Request $request, Restaurant $restaurant): RedirectResponse
    {
        Gate::authorize('suspend', $restaurant);

        $validated = $request->validate([
            'action' => ['required', Rule::in(['suspend', 'reactivate'])],
        ]);
        $user = $restaurant->user;
        abort_if($user === null, 422, 'This restaurant does not have an owner account.');
        abort_if($user->status === 'banned', 422, 'A banned account cannot be toggled with suspension controls.');

        $before = [
            'user_status' => $user->status,
            'operating_status' => $restaurant->operating_status,
        ];

        DB::transaction(function () use ($restaurant, $user, $validated): void {
            $isSuspending = $validated['action'] === 'suspend';
            $user->update(['status' => $isSuspending ? 'suspended' : 'active']);

            if ($isSuspending) {
                $restaurant->update(['operating_status' => 'closed']);
            }
        });

        $restaurant->refresh();
        $this->audit(
            $restaurant,
            $validated['action'] === 'suspend' ? 'restaurant.suspended' : 'restaurant.reactivated',
            $before,
            [
                'user_status' => $restaurant->user()->value('status'),
                'operating_status' => $restaurant->operating_status,
            ]
        );

        return back()->with(
            'success',
            $validated['action'] === 'suspend'
                ? "{$restaurant->name} has been suspended."
                : "{$restaurant->name} has been reactivated."
        );
    }

    public function verifyDocument(Restaurant $restaurant, RestaurantDocument $document): RedirectResponse
    {
        Gate::authorize('approve', $restaurant);
        Gate::authorize('verify', $document);
        abort_unless($document->restaurant_id === $restaurant->id, 404);

        $before = $document->only(['status', 'rejection_reason']);
        $document->update(['status' => 'verified', 'rejection_reason' => null]);
        $this->audit($document, 'restaurant_document.verified', $before, $document->only([
            'status',
            'rejection_reason',
        ]));

        return back()->with('success', 'Restaurant document verified.');
    }

    public function rejectDocument(
        Request $request,
        Restaurant $restaurant,
        RestaurantDocument $document
    ): RedirectResponse {
        Gate::authorize('approve', $restaurant);
        Gate::authorize('reject', $document);
        abort_unless($document->restaurant_id === $restaurant->id, 404);

        $validated = $request->validate([
            'reason' => ['required', 'string', 'max:1000'],
        ]);
        $before = $document->only(['status', 'rejection_reason']);
        $document->update([
            'status' => 'rejected',
            'rejection_reason' => $validated['reason'],
        ]);
        $this->audit($document, 'restaurant_document.rejected', $before, $document->only([
            'status',
            'rejection_reason',
        ]));

        return back()->with('success', 'Restaurant document rejected.');
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
