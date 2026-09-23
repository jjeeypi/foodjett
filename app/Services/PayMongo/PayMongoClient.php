<?php

namespace App\Services\PayMongo;

use App\Models\PendingCheckout;
use App\Models\User;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\Http;
use RuntimeException;

class PayMongoClient
{
    /** @return array{id: string, checkout_url: string} */
    public function createCheckoutSession(
        PendingCheckout $checkout,
        User $customer,
        string $successUrl,
        string $cancelUrl,
    ): array {
        $response = $this->request()
            ->withHeader('Idempotency-Key', $checkout->id)
            ->post('/v2/checkout_sessions', [
                'data' => [
                    'attributes' => [
                        'billing' => array_filter([
                            'name' => $customer->name,
                            'email' => $customer->email,
                            'phone' => $customer->phone,
                        ], fn (mixed $value): bool => is_string($value) && $value !== ''),
                        'description' => 'FoodJett order payment',
                        'line_items' => [[
                            'name' => 'FoodJett order',
                            'description' => 'Food and delivery charges',
                            'amount' => $this->toCentavos((float) $checkout->total_amount),
                            'currency' => 'PHP',
                            'quantity' => 1,
                        ]],
                        'payment_method_types' => [$checkout->payment_method],
                        'reference_number' => $checkout->paymongo_reference,
                        'metadata' => [
                            'pending_checkout_id' => $checkout->id,
                            'customer_id' => (string) $checkout->customer_id,
                        ],
                        'send_email_receipt' => true,
                        'show_description' => true,
                        'show_line_items' => true,
                        'success_url' => $successUrl,
                        'cancel_url' => $cancelUrl,
                    ],
                ],
            ])
            ->throw()
            ->json();

        $id = data_get($response, 'data.id');
        $checkoutUrl = data_get($response, 'data.attributes.checkout_url');

        if (! is_string($id) || ! is_string($checkoutUrl)) {
            throw new RuntimeException('PayMongo returned an invalid checkout session response.');
        }

        return ['id' => $id, 'checkout_url' => $checkoutUrl];
    }

    /** @return array<string, mixed> */
    public function retrieveCheckoutSession(string $sessionId): array
    {
        return $this->request()
            ->get("/v1/checkout_sessions/{$sessionId}")
            ->throw()
            ->json();
    }

    private function request(): PendingRequest
    {
        $secretKey = config('services.paymongo.secret_key');

        if (! is_string($secretKey) || $secretKey === '') {
            throw new RuntimeException('PAYMONGO_SECRET_KEY is not configured.');
        }

        return Http::baseUrl((string) config('services.paymongo.base_url'))
            ->withBasicAuth($secretKey, '')
            ->acceptJson()
            ->asJson()
            ->timeout(15)
            ->retry(2, 250);
    }

    private function toCentavos(float $amount): int
    {
        return (int) round($amount * 100);
    }
}
