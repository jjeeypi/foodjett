<?php

namespace App\Http\Requests;

use App\Models\Order;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class CompleteRiderOrderRequest extends FormRequest
{
    public function authorize(): bool
    {
        $order = $this->route('order');

        return $order instanceof Order && $this->user()?->can('updateAsRider', $order) === true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'outcome' => ['required', Rule::in(['delivered', 'failed_delivery'])],
            'cash_collected' => ['sometimes', 'boolean'],
            'cancellation_reason' => ['required_if:outcome,failed_delivery', 'nullable', 'string', 'max:1000'],
        ];
    }

    public function outcome(): string
    {
        return (string) $this->validated('outcome');
    }

    public function cashCollected(): bool
    {
        return $this->boolean('cash_collected');
    }

    public function cancellationReason(): ?string
    {
        $reason = $this->validated('cancellation_reason');

        return is_string($reason) && $reason !== '' ? $reason : null;
    }
}
