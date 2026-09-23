import { Head, useForm } from '@inertiajs/react';
import type { FormEvent } from 'react';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Variant = { id: number; name: string; price_delta: string };
type Addon = { id: number; name: string; price: string };
type MenuItem = {
    id: number;
    name: string;
    description: string | null;
    base_price: string;
    variants: Variant[];
    addons: Addon[];
};
type MenuCategory = { id: number; name: string; menu_items: MenuItem[] };
type Restaurant = {
    id: number;
    name: string;
    cuisine_type: string;
    address: string;
    min_order_amount: string;
    menuCategories: MenuCategory[];
};
type Address = {
    id: number;
    label: string;
    address_line: string;
    landmark: string | null;
};
type CheckoutItem = {
    menu_item_id: number;
    menu_item_variant_id: number | null;
    quantity: number;
    addon_ids: number[];
    special_instructions: string;
};
type CheckoutForm = {
    customer_address_id: string;
    payment_method: 'cod' | 'gcash' | 'card';
    customer_notes: string;
    items: CheckoutItem[];
};

const paymentMethods = [
    {
        value: 'cod' as const,
        label: 'Cash on Delivery',
        description: 'Pay the assigned rider in cash when your food arrives.',
    },
    {
        value: 'gcash' as const,
        label: 'GCash',
        description: 'Complete payment securely on PayMongo’s hosted checkout.',
    },
    {
        value: 'card' as const,
        label: 'Credit or Debit Card',
        description: 'Pay by card through PayMongo’s secure hosted checkout.',
    },
];

export default function Checkout({
    restaurant,
    addresses,
    fees,
}: {
    restaurant: Restaurant;
    addresses: Address[];
    fees: { delivery: number; service: number };
}) {
    const menuItems = restaurant.menuCategories.flatMap(
        (category) => category.menu_items,
    );
    const form = useForm<CheckoutForm>({
        customer_address_id: addresses[0]?.id.toString() ?? '',
        payment_method: 'cod',
        customer_notes: '',
        items: menuItems.map((item) => ({
            menu_item_id: item.id,
            menu_item_variant_id: null,
            quantity: 0,
            addon_ids: [],
            special_instructions: '',
        })),
    });

    const updateItem = (id: number, changes: Partial<CheckoutItem>) => {
        form.setData(
            'items',
            form.data.items.map((item) =>
                item.menu_item_id === id ? { ...item, ...changes } : item,
            ),
        );
    };

    const estimatedSubtotal = form.data.items.reduce((total, selection) => {
        if (selection.quantity < 1) return total;
        const item = menuItems.find(
            (candidate) => candidate.id === selection.menu_item_id,
        );
        if (!item) return total;
        const variant = item.variants.find(
            (candidate) => candidate.id === selection.menu_item_variant_id,
        );
        const addons = item.addons.filter((addon) =>
            selection.addon_ids.includes(addon.id),
        );
        const unit =
            Number(item.base_price) +
            Number(variant?.price_delta ?? 0) +
            addons.reduce((sum, addon) => sum + Number(addon.price), 0);
        return total + unit * selection.quantity;
    }, 0);

    const submit = (event: FormEvent) => {
        event.preventDefault();
        form.transform((data) => ({
            ...data,
            items: data.items.filter((item) => item.quantity > 0),
        }));
        form.post(`/customer/restaurants/${restaurant.id}/checkout`);
    };

    return (
        <>
            <Head title={`Checkout — ${restaurant.name}`} />
            <form
                onSubmit={submit}
                className="grid gap-6 p-4 md:p-6 xl:grid-cols-[1fr_22rem]"
            >
                <div className="space-y-6">
                    <div>
                        <h1 className="text-2xl font-semibold tracking-tight">
                            {restaurant.name}
                        </h1>
                        <p className="text-muted-foreground text-sm">
                            {restaurant.cuisine_type} · {restaurant.address}
                        </p>
                    </div>

                    {restaurant.menuCategories.map((category) => (
                        <Card key={category.id}>
                            <CardHeader>
                                <CardTitle>{category.name}</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-5">
                                {category.menu_items.map((item) => {
                                    const selection = form.data.items.find(
                                        (candidate) =>
                                            candidate.menu_item_id === item.id,
                                    );
                                    if (!selection) return null;

                                    return (
                                        <div
                                            key={item.id}
                                            className="space-y-3 border-b pb-5 last:border-0 last:pb-0"
                                        >
                                            <div className="flex items-start justify-between gap-4">
                                                <div>
                                                    <h3 className="font-medium">
                                                        {item.name}
                                                    </h3>
                                                    {item.description && (
                                                        <p className="text-muted-foreground text-sm">
                                                            {item.description}
                                                        </p>
                                                    )}
                                                    <p className="mt-1 text-sm font-medium">
                                                        ₱
                                                        {Number(
                                                            item.base_price,
                                                        ).toFixed(2)}
                                                    </p>
                                                </div>
                                                <Input
                                                    aria-label={`${item.name} quantity`}
                                                    type="number"
                                                    min={0}
                                                    max={20}
                                                    className="w-20"
                                                    value={selection.quantity}
                                                    onChange={(event) =>
                                                        updateItem(item.id, {
                                                            quantity: Number(
                                                                event.target
                                                                    .value,
                                                            ),
                                                        })
                                                    }
                                                />
                                            </div>

                                            {selection.quantity > 0 &&
                                                item.variants.length > 0 && (
                                                    <div className="space-y-2">
                                                        <Label>Variant</Label>
                                                        <select
                                                            className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                                                            value={
                                                                selection.menu_item_variant_id ??
                                                                ''
                                                            }
                                                            onChange={(event) =>
                                                                updateItem(
                                                                    item.id,
                                                                    {
                                                                        menu_item_variant_id:
                                                                            event
                                                                                .target
                                                                                .value ===
                                                                            ''
                                                                                ? null
                                                                                : Number(
                                                                                      event
                                                                                          .target
                                                                                          .value,
                                                                                  ),
                                                                    },
                                                                )
                                                            }
                                                        >
                                                            <option value="">
                                                                Regular
                                                            </option>
                                                            {item.variants.map(
                                                                (variant) => (
                                                                    <option
                                                                        key={
                                                                            variant.id
                                                                        }
                                                                        value={
                                                                            variant.id
                                                                        }
                                                                    >
                                                                        {
                                                                            variant.name
                                                                        }{' '}
                                                                        (
                                                                        {Number(
                                                                            variant.price_delta,
                                                                        ) >= 0
                                                                            ? '+'
                                                                            : ''}
                                                                        ₱
                                                                        {Number(
                                                                            variant.price_delta,
                                                                        ).toFixed(
                                                                            2,
                                                                        )}
                                                                        )
                                                                    </option>
                                                                ),
                                                            )}
                                                        </select>
                                                    </div>
                                                )}

                                            {selection.quantity > 0 &&
                                                item.addons.length > 0 && (
                                                    <div className="space-y-2">
                                                        <Label>Add-ons</Label>
                                                        <div className="grid gap-2 sm:grid-cols-2">
                                                            {item.addons.map(
                                                                (addon) => (
                                                                    <label
                                                                        key={
                                                                            addon.id
                                                                        }
                                                                        className="flex items-center gap-2 text-sm"
                                                                    >
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={selection.addon_ids.includes(
                                                                                addon.id,
                                                                            )}
                                                                            onChange={(
                                                                                event,
                                                                            ) =>
                                                                                updateItem(
                                                                                    item.id,
                                                                                    {
                                                                                        addon_ids:
                                                                                            event
                                                                                                .target
                                                                                                .checked
                                                                                                ? [
                                                                                                      ...selection.addon_ids,
                                                                                                      addon.id,
                                                                                                  ]
                                                                                                : selection.addon_ids.filter(
                                                                                                      (
                                                                                                          id,
                                                                                                      ) =>
                                                                                                          id !==
                                                                                                          addon.id,
                                                                                                  ),
                                                                                    },
                                                                                )
                                                                            }
                                                                        />
                                                                        {
                                                                            addon.name
                                                                        }{' '}
                                                                        (+₱
                                                                        {Number(
                                                                            addon.price,
                                                                        ).toFixed(
                                                                            2,
                                                                        )}
                                                                        )
                                                                    </label>
                                                                ),
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                        </div>
                                    );
                                })}
                            </CardContent>
                        </Card>
                    ))}
                    <InputError message={form.errors.items} />
                </div>

                <div className="space-y-6 xl:sticky xl:top-6 xl:self-start">
                    <Card>
                        <CardHeader>
                            <CardTitle>Delivery</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="address">Address</Label>
                                <select
                                    id="address"
                                    className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                                    value={form.data.customer_address_id}
                                    onChange={(event) =>
                                        form.setData(
                                            'customer_address_id',
                                            event.target.value,
                                        )
                                    }
                                >
                                    {addresses.map((address) => (
                                        <option
                                            key={address.id}
                                            value={address.id}
                                        >
                                            {address.label} —{' '}
                                            {address.address_line}
                                        </option>
                                    ))}
                                </select>
                                <InputError
                                    message={form.errors.customer_address_id}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="notes">Order notes</Label>
                                <textarea
                                    id="notes"
                                    className="border-input bg-background min-h-20 w-full rounded-md border p-3 text-sm"
                                    value={form.data.customer_notes}
                                    onChange={(event) =>
                                        form.setData(
                                            'customer_notes',
                                            event.target.value,
                                        )
                                    }
                                />
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Payment method</CardTitle>
                            <CardDescription>
                                Online orders are created only after PayMongo
                                confirms payment.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {paymentMethods.map((method) => (
                                <label
                                    key={method.value}
                                    className="flex cursor-pointer gap-3 rounded-lg border p-3"
                                >
                                    <input
                                        type="radio"
                                        name="payment_method"
                                        value={method.value}
                                        checked={
                                            form.data.payment_method ===
                                            method.value
                                        }
                                        onChange={() =>
                                            form.setData(
                                                'payment_method',
                                                method.value,
                                            )
                                        }
                                    />
                                    <span>
                                        <span className="block text-sm font-medium">
                                            {method.label}
                                        </span>
                                        <span className="text-muted-foreground block text-xs">
                                            {method.description}
                                        </span>
                                    </span>
                                </label>
                            ))}
                            <InputError message={form.errors.payment_method} />
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Order total</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span>Items</span>
                                <span>₱{estimatedSubtotal.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Delivery</span>
                                <span>₱{fees.delivery.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Service</span>
                                <span>₱{fees.service.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between border-t pt-2 text-base font-semibold">
                                <span>Total</span>
                                <span>
                                    ₱
                                    {(
                                        estimatedSubtotal +
                                        fees.delivery +
                                        fees.service
                                    ).toFixed(2)}
                                </span>
                            </div>
                            <Button
                                type="submit"
                                className="mt-4 w-full"
                                disabled={
                                    form.processing || estimatedSubtotal <= 0
                                }
                            >
                                {form.data.payment_method === 'cod'
                                    ? 'Place COD order'
                                    : 'Continue to PayMongo'}
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </form>
        </>
    );
}
