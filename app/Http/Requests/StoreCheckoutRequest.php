<?php

namespace App\Http\Requests;

use App\Models\Order;
use App\Models\Restaurant;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreCheckoutRequest extends FormRequest
{
    public function authorize(): bool
    {
        $restaurant = $this->route('restaurant');

        return $restaurant instanceof Restaurant
            && $this->user()?->can('create', Order::class) === true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        $customerId = $this->user()?->customer?->id;

        return [
            'customer_address_id' => [
                'required',
                'integer',
                Rule::exists('customer_addresses', 'id')->where('customer_id', $customerId),
            ],
            'payment_method' => ['required', Rule::in(['cod', 'gcash', 'card'])],
            'customer_notes' => ['nullable', 'string', 'max:1000'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.menu_item_id' => ['required', 'integer', 'distinct', 'exists:menu_items,id'],
            'items.*.menu_item_variant_id' => ['nullable', 'integer', 'exists:menu_item_variants,id'],
            'items.*.quantity' => ['required', 'integer', 'min:1', 'max:20'],
            'items.*.addon_ids' => ['sometimes', 'array'],
            'items.*.addon_ids.*' => ['integer', 'distinct', 'exists:menu_item_addons,id'],
            'items.*.special_instructions' => ['nullable', 'string', 'max:500'],
        ];
    }

    public function addressId(): int
    {
        return (int) $this->validated('customer_address_id');
    }

    public function paymentMethod(): string
    {
        return (string) $this->validated('payment_method');
    }

    public function customerNotes(): ?string
    {
        $notes = $this->validated('customer_notes');

        return is_string($notes) && $notes !== '' ? $notes : null;
    }

    /**
     * @return list<array{
     *     menu_item_id: int,
     *     menu_item_variant_id?: int|null,
     *     quantity: int,
     *     addon_ids?: list<int>,
     *     special_instructions?: string|null
     * }>
     */
    public function items(): array
    {
        $items = [];

        foreach ((array) $this->validated('items') as $item) {
            if (! is_array($item)) {
                continue;
            }

            $items[] = [
                'menu_item_id' => (int) $item['menu_item_id'],
                'menu_item_variant_id' => isset($item['menu_item_variant_id'])
                    ? (int) $item['menu_item_variant_id']
                    : null,
                'quantity' => (int) $item['quantity'],
                'addon_ids' => array_values(array_map('intval', (array) ($item['addon_ids'] ?? []))),
                'special_instructions' => isset($item['special_instructions'])
                    ? (string) $item['special_instructions']
                    : null,
            ];
        }

        return $items;
    }
}
