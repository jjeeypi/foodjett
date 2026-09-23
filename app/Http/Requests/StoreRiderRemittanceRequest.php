<?php

namespace App\Http\Requests;

use App\Models\RiderCashRemittance;
use Illuminate\Foundation\Http\FormRequest;

class StoreRiderRemittanceRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('create', RiderCashRemittance::class) === true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'amount' => ['required', 'numeric', 'decimal:0,2', 'min:0.01'],
            'reference_note' => ['nullable', 'string', 'max:255'],
        ];
    }

    public function amount(): float
    {
        return round((float) $this->validated('amount'), 2);
    }

    public function referenceNote(): ?string
    {
        $note = $this->validated('reference_note');

        return is_string($note) && $note !== '' ? $note : null;
    }
}
