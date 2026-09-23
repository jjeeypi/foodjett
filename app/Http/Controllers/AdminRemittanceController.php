<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\Rider;
use App\Models\RiderCashRemittance;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class AdminRemittanceController extends Controller
{
    public function index(Request $request): Response
    {
        Gate::authorize('viewAny', RiderCashRemittance::class);

        $filters = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'status' => ['nullable', Rule::in(['pending', 'confirmed', 'all'])],
        ]);
        $status = $filters['status'] ?? 'pending';

        return Inertia::render('admin/finance/cash-remittances', [
            'remittances' => RiderCashRemittance::query()
                ->with(['rider.user:id,name,email'])
                ->when(
                    $status !== 'all',
                    fn (Builder $query) => $query->where('status', $status)
                )
                ->when(
                    $filters['search'] ?? null,
                    fn (Builder $query, string $search) => $query->whereHas(
                        'rider.user',
                        fn (Builder $userQuery) => $userQuery
                            ->where('name', 'like', "%{$search}%")
                            ->orWhere('email', 'like', "%{$search}%")
                    )
                )
                ->oldest()
                ->paginate(15)
                ->withQueryString(),
            'filters' => [
                'search' => $filters['search'] ?? '',
                'status' => $status,
            ],
        ]);
    }

    public function confirm(RiderCashRemittance $remittance): RedirectResponse
    {
        Gate::authorize('confirm', $remittance);
        $adminId = request()->user()?->admin?->id;
        abort_unless($adminId !== null, 403);

        DB::transaction(function () use ($remittance, $adminId): void {
            $lockedRemittance = RiderCashRemittance::query()
                ->whereKey($remittance->id)
                ->lockForUpdate()
                ->firstOrFail();

            if ($lockedRemittance->status === 'confirmed') {
                return;
            }

            $rider = Rider::query()
                ->whereKey($lockedRemittance->rider_id)
                ->lockForUpdate()
                ->firstOrFail();
            if ((float) $lockedRemittance->amount > (float) $rider->cash_on_hand) {
                throw ValidationException::withMessages([
                    'remittance' => "The rider's cash balance is lower than this remittance amount.",
                ]);
            }

            $before = [
                ...$lockedRemittance->only(['status', 'confirmed_by_admin_id', 'remitted_at']),
                'rider_cash_on_hand' => $rider->cash_on_hand,
            ];
            $lockedRemittance->update([
                'status' => 'confirmed',
                'confirmed_by_admin_id' => $adminId,
                'remitted_at' => $lockedRemittance->remitted_at ?? now(),
            ]);
            $rider->update([
                'cash_on_hand' => round((float) $rider->cash_on_hand - (float) $lockedRemittance->amount, 2),
            ]);

            AuditLog::query()->create([
                'user_id' => request()->user()?->id,
                'action' => 'rider_remittance.confirmed',
                'subject_type' => RiderCashRemittance::class,
                'subject_id' => $lockedRemittance->id,
                'changes' => [
                    'before' => $before,
                    'after' => [
                        ...$lockedRemittance->fresh()->only(['status', 'confirmed_by_admin_id', 'remitted_at']),
                        'rider_cash_on_hand' => $rider->fresh()->cash_on_hand,
                    ],
                ],
                'created_at' => now(),
            ]);
        });

        return back()->with('success', 'Remittance confirmed and rider cash balance updated.');
    }
}
