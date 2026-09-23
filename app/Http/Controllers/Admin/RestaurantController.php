<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Restaurant;
use Illuminate\Database\Eloquent\Builder;
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

        $restaurants = Restaurant::query()
            ->with('user:id,name,email,status')
            ->withAvg('reviews', 'rating')
            ->when(
                $filters['search'] ?? null,
                fn (Builder $query, string $search) => $query->where(function (Builder $query) use ($search): void {
                    $query
                        ->where('name', 'like', "%{$search}%")
                        ->orWhere('cuisine_type', 'like', "%{$search}%")
                        ->orWhereHas('user', fn (Builder $userQuery) => $userQuery
                            ->where('name', 'like', "%{$search}%")
                            ->orWhere('email', 'like', "%{$search}%"));
                })
            )
            ->when(
                $filters['approval_status'] ?? null,
                fn (Builder $query, string $status) => $query->where('approval_status', $status)
            )
            ->latest()
            ->paginate(15)
            ->withQueryString();

        return Inertia::render('admin/restaurants/index', [
            'restaurants' => $restaurants,
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
            'menuCategories' => fn ($query) => $query
                ->with(['menuItems' => fn ($query) => $query->orderBy('name')])
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
        $accuratePrepOrders = $prepOrders->filter(
            fn ($order): bool => Carbon::parse($order->ready_at)
                ->lessThanOrEqualTo(Carbon::parse($order->estimated_ready_at))
        )->count();

        return Inertia::render('admin/restaurants/show', [
            'restaurant' => $restaurant,
            'prepTimeAccuracy' => [
                'sample_size' => $prepOrders->count(),
                'on_time_count' => $accuratePrepOrders,
                'percentage' => $prepOrders->isEmpty()
                    ? null
                    : round(($accuratePrepOrders / $prepOrders->count()) * 100, 1),
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
        $this->audit($restaurant, 'restaurant.approved', $before);

        return back()->with('success', "{$restaurant->name} has been approved.");
    }

    public function reject(Request $request, Restaurant $restaurant): RedirectResponse
    {
        Gate::authorize('reject', $restaurant);

        $validated = $request->validate([
            'reason' => ['required', 'string', 'min:10', 'max:1000'],
        ]);
        $before = $restaurant->only(['approval_status', 'rejection_reason', 'operating_status']);
        $restaurant->update([
            'approval_status' => 'rejected',
            'rejection_reason' => $validated['reason'],
            'operating_status' => 'closed',
        ]);
        $this->audit($restaurant, 'restaurant.rejected', $before);

        return back()->with('success', "{$restaurant->name} has been rejected.");
    }

    public function suspend(Request $request, Restaurant $restaurant): RedirectResponse
    {
        Gate::authorize('suspend', $restaurant);

        $validated = $request->validate([
            'action' => ['required', Rule::in(['suspend', 'reactivate'])],
        ]);
        $user = $restaurant->user;
        abort_if($user === null, 422, 'This restaurant does not have an owner account.');

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

        $action = $validated['action'] === 'suspend'
            ? 'restaurant.suspended'
            : 'restaurant.reactivated';
        $this->audit($restaurant, $action, $before);

        return back()->with(
            'success',
            $validated['action'] === 'suspend'
                ? "{$restaurant->name} has been suspended."
                : "{$restaurant->name} has been reactivated."
        );
    }

    /** @param array<string, mixed> $before */
    private function audit(Restaurant $restaurant, string $action, array $before): void
    {
        AuditLog::query()->create([
            'user_id' => request()->user()?->id,
            'action' => $action,
            'subject_type' => Restaurant::class,
            'subject_id' => $restaurant->id,
            'changes' => [
                'before' => $before,
                'after' => [
                    ...$restaurant->fresh()->only([
                        'approval_status',
                        'rejection_reason',
                        'operating_status',
                    ]),
                    'user_status' => $restaurant->user()->value('status'),
                ],
            ],
            'created_at' => now(),
        ]);
    }
}
