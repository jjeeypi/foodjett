<?php

namespace App\Http\Controllers;

use App\Models\Order;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class OrderPlacedController extends Controller
{
    public function __invoke(Order $order): Response
    {
        Gate::authorize('view', $order);

        return Inertia::render('customer/payment-result', [
            'success' => true,
            'title' => 'Order placed — pay the rider on delivery',
            'message' => 'Your COD order is awaiting restaurant confirmation.',
            'orderNumber' => $order->order_number,
            'totalAmount' => (float) $order->total_amount,
        ]);
    }
}
