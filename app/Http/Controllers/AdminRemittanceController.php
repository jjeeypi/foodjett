<?php

namespace App\Http\Controllers;

use App\Models\Rider;
use App\Models\RiderCashRemittance;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class AdminRemittanceController extends Controller
{
    public function index(): Response
    {
        Gate::authorize('viewAny', RiderCashRemittance::class);

        return Inertia::render('admin/remittances', [
            'remittances' => RiderCashRemittance::query()
                ->with(['rider.user:id,name,email'])
                ->where('status', 'pending')
                ->oldest()
                ->get(),
        ]);
    }

    public function confirm(RiderCashRemittance $remittance): RedirectResponse
    {
        Gate::authorize('confirm', $remittance);
        $adminId = request()->user()?->admin?->id;
        abort_unless($adminId !== null, 403);

        DB::transaction(function () use ($remittance, $adminId): void {
            $lockedRemittance = RiderCashRemittance::query()->lockForUpdate()->findOrFail($remittance->id);

            if ($lockedRemittance->status === 'confirmed') {
                return;
            }

            $rider = Rider::query()->lockForUpdate()->findOrFail($lockedRemittance->rider_id);
            if ((float) $lockedRemittance->amount > (float) $rider->cash_on_hand) {
                throw ValidationException::withMessages([
                    'remittance' => 'The rider’s cash balance is lower than this remittance amount.',
                ]);
            }

            $lockedRemittance->update([
                'status' => 'confirmed',
                'confirmed_by_admin_id' => $adminId,
                'remitted_at' => now(),
            ]);
            $rider->update([
                'cash_on_hand' => round((float) $rider->cash_on_hand - (float) $lockedRemittance->amount, 2),
            ]);
        });

        return back()->with('success', 'Remittance confirmed and rider cash balance updated.');
    }
}
