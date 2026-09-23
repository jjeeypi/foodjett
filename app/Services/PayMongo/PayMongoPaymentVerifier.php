<?php

namespace App\Services\PayMongo;

use App\Models\PendingCheckout;

class PayMongoPaymentVerifier
{
    /** @param array<string, mixed> $response */
    public function paidPaymentReference(array $response, PendingCheckout $checkout): ?string
    {
        $session = data_get($response, 'data');

        if (! is_array($session)
            || data_get($session, 'id') !== $checkout->paymongo_session_id
            || data_get($session, 'attributes.reference_number') !== $checkout->paymongo_reference) {
            return null;
        }

        $payments = data_get($session, 'attributes.payments', []);

        if (! is_array($payments)) {
            return null;
        }

        foreach ($payments as $payment) {
            if (! is_array($payment)) {
                continue;
            }

            $reference = data_get($payment, 'id');
            $status = data_get($payment, 'attributes.status');
            $amount = data_get($payment, 'attributes.amount');
            $currency = data_get($payment, 'attributes.currency');

            if (is_string($reference)
                && $status === 'paid'
                && $currency === 'PHP'
                && (int) $amount === (int) round((float) $checkout->total_amount * 100)) {
                return $reference;
            }
        }

        return null;
    }
}
