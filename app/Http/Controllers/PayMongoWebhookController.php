<?php

namespace App\Http\Controllers;

use App\Actions\Orders\FinalizePaidCheckout;
use App\Models\PendingCheckout;
use App\Services\PayMongo\PayMongoPaymentVerifier;
use App\Services\PayMongo\VerifyWebhookSignature;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PayMongoWebhookController extends Controller
{
    public function __invoke(
        Request $request,
        VerifyWebhookSignature $signature,
        PayMongoPaymentVerifier $verifier,
        FinalizePaidCheckout $finalize,
    ): JsonResponse {
        $rawBody = $request->getContent();

        if (! $signature->handle($rawBody, (string) $request->header('Paymongo-Signature'))) {
            return response()->json(['message' => 'Invalid signature.'], 401);
        }

        $payload = json_decode($rawBody, true);
        if (! is_array($payload) || data_get($payload, 'data.type') !== 'checkout_session.payment.paid') {
            return response()->json(['received' => true]);
        }

        $session = data_get($payload, 'data.data');
        if (! is_array($session)) {
            return response()->json(['received' => true]);
        }

        $sessionId = data_get($session, 'id');
        $reference = data_get($session, 'attributes.reference_number');

        $pendingCheckout = PendingCheckout::query()
            ->when(is_string($sessionId), fn ($query) => $query->where('paymongo_session_id', $sessionId))
            ->when(! is_string($sessionId) && is_string($reference), fn ($query) => $query->where('paymongo_reference', $reference))
            ->first();

        if (! $pendingCheckout) {
            return response()->json(['received' => true]);
        }

        $paymentReference = $verifier->paidPaymentReference(['data' => $session], $pendingCheckout);
        if ($paymentReference !== null) {
            $finalize->handle($pendingCheckout, $paymentReference);
        }

        return response()->json(['received' => true]);
    }
}
