<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreRiderRemittanceRequest;
use App\Models\Rider;
use App\Models\RiderCashRemittance;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class RiderRemittanceController extends Controller
{
    public function index(): Response
    {
        $rider = request()->user()?->rider;
        abort_unless($rider !== null, 403);

        return Inertia::render('rider/remittances', [
            'rider' => $rider->only(['cash_on_hand', 'cash_remit_limit']),
            'remittances' => $rider->cashRemittances()->latest()->get(),
        ]);
    }

    public function store(StoreRiderRemittanceRequest $request): RedirectResponse
    {
        $riderId = $request->user()->rider?->id;
        abort_unless($riderId !== null, 403);

        DB::transaction(function () use ($request, $riderId): void {
            $rider = Rider::query()->lockForUpdate()->findOrFail($riderId);
            $pendingTotal = (float) RiderCashRemittance::query()
                ->where('rider_id', $rider->id)
                ->where('status', 'pending')
                ->sum('amount');

            if ($pendingTotal + $request->amount() > (float) $rider->cash_on_hand) {
                throw ValidationException::withMessages([
                    'amount' => 'The amount exceeds your uncommitted cash on hand.',
                ]);
            }

            RiderCashRemittance::create([
                'rider_id' => $rider->id,
                'amount' => $request->amount(),
                'reference_note' => $request->referenceNote(),
                'status' => 'pending',
            ]);
        });

        return back()->with('success', 'Cash remittance submitted for admin confirmation.');
    }
}
