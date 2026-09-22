<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class PendingApprovalController extends Controller
{
    public function restaurant(Request $request): Response
    {
        $restaurant = $request->user()->restaurant()->firstOrFail();

        return Inertia::render('restaurant/pending', [
            'approvalStatus' => $restaurant->approval_status,
            'rejectionReason' => $restaurant->rejection_reason,
        ]);
    }

    public function rider(Request $request): Response
    {
        $rider = $request->user()->rider()->firstOrFail();

        return Inertia::render('rider/pending', [
            'approvalStatus' => $rider->approval_status,
            'rejectionReason' => $rider->rejection_reason,
        ]);
    }
}
