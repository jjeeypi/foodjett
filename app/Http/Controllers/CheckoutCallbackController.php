<?php

namespace App\Http\Controllers;

use App\Actions\Orders\FinalizePaidCheckout;
use App\Models\PendingCheckout;
use App\Services\PayMongo\PayMongoClient;
use App\Services\PayMongo\PayMongoPaymentVerifier;
use Inertia\Inertia;
use Inertia\Response;
use Throwable;

class CheckoutCallbackController extends Controller
{
    public function __invoke(
        PendingCheckout $pendingCheckout,
        PayMongoClient $payMongo,
        PayMongoPaymentVerifier $verifier,
        FinalizePaidCheckout $finalize,
    ): Response {
        abort_unless(request()->user()?->customer?->id === $pendingCheckout->customer_id, 403);

        if ($pendingCheckout->order_id !== null) {
            return $this->success($pendingCheckout->order?->order_number, (float) $pendingCheckout->total_amount);
        }

        if ($pendingCheckout->paymongo_session_id === null) {
            return $this->failure('The payment session could not be found. No order was created.');
        }

        try {
            $session = $payMongo->retrieveCheckoutSession($pendingCheckout->paymongo_session_id);
            $paymentReference = $verifier->paidPaymentReference($session, $pendingCheckout);
        } catch (Throwable $exception) {
            report($exception);

            return $this->failure('We could not verify the payment yet. No order was created; please try this callback again.');
        }

        if ($paymentReference === null) {
            $pendingCheckout->update([
                'status' => request()->query('outcome') === 'cancel' ? 'cancelled' : 'failed',
            ]);

            return $this->failure('Payment did not go through. No order was created.');
        }

        $order = $finalize->handle($pendingCheckout, $paymentReference);

        return $this->success($order->order_number, (float) $order->total_amount);
    }

    private function success(?string $orderNumber, float $totalAmount): Response
    {
        return Inertia::render('customer/payment-result', [
            'success' => true,
            'title' => 'Payment Successful — thank you for your order!',
            'message' => 'Your payment was verified and your order has been placed.',
            'orderNumber' => $orderNumber,
            'totalAmount' => $totalAmount,
        ]);
    }

    private function failure(string $message): Response
    {
        return Inertia::render('customer/payment-result', [
            'success' => false,
            'title' => 'Payment didn’t go through',
            'message' => $message,
        ]);
    }
}
