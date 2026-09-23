<?php

namespace App\Actions\Payments;

use App\Models\Payment;
use App\Models\PaymentStatusHistory;

class RecordPaymentStatus
{
    public function initial(Payment $payment, string $changedBy, ?string $note = null): void
    {
        PaymentStatusHistory::create([
            'payment_id' => $payment->id,
            'from_status' => null,
            'to_status' => $payment->status,
            'changed_by' => $changedBy,
            'note' => $note,
        ]);
    }

    public function transition(Payment $payment, string $toStatus, string $changedBy, ?string $note = null): void
    {
        $fromStatus = $payment->status;

        if ($fromStatus === $toStatus) {
            return;
        }

        $payment->forceFill([
            'status' => $toStatus,
            'paid_at' => $toStatus === 'paid' ? now() : $payment->paid_at,
        ])->save();

        PaymentStatusHistory::create([
            'payment_id' => $payment->id,
            'from_status' => $fromStatus,
            'to_status' => $toStatus,
            'changed_by' => $changedBy,
            'note' => $note,
        ]);
    }
}
