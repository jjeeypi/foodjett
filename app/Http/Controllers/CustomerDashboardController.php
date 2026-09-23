<?php

namespace App\Http\Controllers;

use App\Models\Restaurant;
use Inertia\Inertia;
use Inertia\Response;

class CustomerDashboardController extends Controller
{
    public function __invoke(): Response
    {
        return Inertia::render('customer/dashboard', [
            'restaurants' => Restaurant::query()
                ->where('approval_status', 'approved')
                ->where('operating_status', 'open')
                ->orderBy('name')
                ->get(['id', 'name', 'cuisine_type', 'address', 'min_order_amount']),
        ]);
    }
}
