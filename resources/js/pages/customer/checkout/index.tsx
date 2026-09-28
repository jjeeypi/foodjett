import { Head, Link, router } from '@inertiajs/react';
import {
    AlertCircle,
    ArrowLeft,
    LoaderCircle,
    MapPinPlus,
    ReceiptText,
    ShoppingBag,
    TicketPercent,
} from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import AddressForm, {
    type AddressFormValues,
} from '@/components/customer/address-form';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
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
import { useCart, type CartItem } from '@/contexts/cart-context';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type Restaurant = {
    id: number;
    name: string;
    cuisine_type: string;
    address: string;
    latitude: number;
    longitude: number;
    min_order_amount: number;
};

type Address = {
    id: number;
    label: string;
    address_line: string;
    landmark: string | null;
    delivery_instructions: string | null;
    latitude: number;
    longitude: number;
    is_default: boolean;
};

type Quote = {
    subtotal: number;
    delivery_fee: number;
    delivery_distance_km: number;
    service_fee: number;
    discount_amount: number;
    tip_amount: number;
    total_amount: number;
    voucher: { id: number; code: string } | null;
};

type PaymentMethod = 'cod' | 'gcash' | 'card';

const money = new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
});

const paymentMethods: Array<{
    value: PaymentMethod;
    label: string;
    description: string;
}> = [
    {
        value: 'cod',
        label: 'Cash on Delivery',
        description: 'Pay the assigned rider in cash when your food arrives.',
    },
    {
        value: 'gcash',
        label: 'GCash',
        description: 'Pay securely on PayMongo’s hosted GCash checkout.',
    },
    {
        value: 'card',
        label: 'Credit or Debit Card',
        description: 'Pay securely by card on PayMongo’s hosted checkout.',
    },
];

const itemUnitPrice = (item: CartItem) =>
    item.basePrice +
    (item.variant?.priceDelta ?? 0) +
    item.addons.reduce((total, addon) => total + addon.price, 0);

const csrfToken = () =>
    document
        .querySelector<HTMLMetaElement>('meta[name="csrf-token"]')
        ?.getAttribute('content') ?? '';

const validationMessages = (body: unknown): string[] => {
    if (typeof body !== 'object' || body === null || !('errors' in body)) {
        return ['We could not validate this checkout. Please try again.'];
    }

    const errors = (body as { errors?: Record<string, string[]> }).errors;

    return errors ? Object.values(errors).flat() : ['Checkout is invalid.'];
};

export default function Checkout({
    restaurant,
    addresses: initialAddresses,
    idempotencyToken,
}: {
    restaurant: Restaurant;
    addresses: Address[];
    idempotencyToken: string;
}) {
    const {
        items,
        subtotal: cartSubtotal,
        restaurant: cartRestaurant,
    } = useCart();
    const [addresses, setAddresses] = useState(initialAddresses);
    const [addressId, setAddressId] = useState<number | null>(
        initialAddresses.find((address) => address.is_default)?.id ??
            initialAddresses[0]?.id ??
            null,
    );
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cod');
    const [customerNotes, setCustomerNotes] = useState('');
    const [tipAmount, setTipAmount] = useState(0);
    const [voucherInput, setVoucherInput] = useState('');
    const [appliedVoucher, setAppliedVoucher] = useState<string | null>(null);
    const [quote, setQuote] = useState<Quote | null>(null);
    const [quoteErrors, setQuoteErrors] = useState<string[]>([]);
    const [quoteLoading, setQuoteLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [submitErrors, setSubmitErrors] = useState<string[]>([]);
    const [showNewAddress, setShowNewAddress] = useState(
        initialAddresses.length === 0,
    );
    const [addressSaving, setAddressSaving] = useState(false);
    const [addressErrors, setAddressErrors] = useState<string[]>([]);
    const [newAddress, setNewAddress] = useState<AddressFormValues>({
        label: 'Home',
        address_line: '',
        landmark: '',
        delivery_instructions: '',
        latitude: restaurant.latitude,
        longitude: restaurant.longitude,
    });

    const checkoutItems = useMemo(
        () =>
            items.map((item) => ({
                menu_item_id: item.menuItemId,
                menu_item_variant_id: item.variant?.id ?? null,
                quantity: item.quantity,
                addon_ids: item.addons.map((addon) => addon.id),
                special_instructions: item.specialInstructions || null,
                expected_unit_price: Number(itemUnitPrice(item).toFixed(2)),
            })),
        [items],
    );
    const cartMatchesRestaurant =
        cartRestaurant !== null && cartRestaurant.id === restaurant.id;
    const canRequestQuote =
        cartMatchesRestaurant && checkoutItems.length > 0 && addressId !== null;

    const requestPayload = useMemo(
        () => ({
            customer_address_id: addressId,
            payment_method: paymentMethod,
            customer_notes: customerNotes || null,
            voucher_code: appliedVoucher,
            tip_amount: tipAmount,
            idempotency_token: idempotencyToken,
            items: checkoutItems,
        }),
        [
            addressId,
            appliedVoucher,
            checkoutItems,
            customerNotes,
            idempotencyToken,
            paymentMethod,
            tipAmount,
        ],
    );
    const quotePayload = useMemo(
        () => ({
            customer_address_id: addressId,
            payment_method: paymentMethod,
            customer_notes: null,
            voucher_code: appliedVoucher,
            tip_amount: tipAmount,
            idempotency_token: idempotencyToken,
            items: checkoutItems,
        }),
        [
            addressId,
            appliedVoucher,
            checkoutItems,
            idempotencyToken,
            paymentMethod,
            tipAmount,
        ],
    );

    useEffect(() => {
        if (!canRequestQuote) {
            setQuote(null);
            setQuoteLoading(false);
            return;
        }

        const controller = new AbortController();
        setQuote(null);
        setQuoteLoading(true);
        setQuoteErrors([]);
        const timeout = window.setTimeout(() => {
            void fetch(
                `/customer/restaurants/${restaurant.id}/checkout/quote`,
                {
                    method: 'POST',
                    signal: controller.signal,
                    credentials: 'same-origin',
                    headers: {
                        Accept: 'application/json',
                        'Content-Type': 'application/json',
                        'X-CSRF-TOKEN': csrfToken(),
                    },
                    body: JSON.stringify(quotePayload),
                },
            )
                .then(async (response) => {
                    const body = (await response.json()) as unknown;
                    if (!response.ok) {
                        setQuote(null);
                        setQuoteErrors(validationMessages(body));
                        return;
                    }

                    setQuote((body as { quote: Quote }).quote);
                })
                .catch((error: unknown) => {
                    if ((error as { name?: string }).name !== 'AbortError') {
                        setQuote(null);
                        setQuoteErrors([
                            'Could not refresh your total. Check your connection and try again.',
                        ]);
                    }
                })
                .finally(() => {
                    if (!controller.signal.aborted) setQuoteLoading(false);
                });
        }, 300);

        return () => {
            window.clearTimeout(timeout);
            controller.abort();
        };
    }, [canRequestQuote, quotePayload, restaurant.id]);

    const saveAddress = async () => {
        setAddressSaving(true);
        setAddressErrors([]);

        try {
            const response = await fetch('/customer/checkout/addresses', {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': csrfToken(),
                },
                body: JSON.stringify(newAddress),
            });
            const body = (await response.json()) as unknown;
            if (!response.ok) {
                setAddressErrors(validationMessages(body));
                return;
            }

            const result = body as {
                address: Address;
                outside_delivery_zone: boolean;
            };
            const address = result.address;
            setAddresses((current) => [...current, address]);
            setAddressId(address.id);
            setShowNewAddress(false);
            if (result.outside_delivery_zone) {
                toast.warning(
                    'Address saved, but it is outside the current delivery zones.',
                );
            }
        } catch {
            setAddressErrors([
                'Could not save this address. Check your connection and try again.',
            ]);
        } finally {
            setAddressSaving(false);
        }
    };

    const submit = (event: FormEvent) => {
        event.preventDefault();
        if (!quote || submitting) return;

        setSubmitErrors([]);
        router.post(
            `/customer/restaurants/${restaurant.id}/checkout`,
            requestPayload,
            {
                preserveScroll: true,
                onStart: () => setSubmitting(true),
                onFinish: () => setSubmitting(false),
                onError: (errors) =>
                    setSubmitErrors(
                        Object.values(errors).map((message) => String(message)),
                    ),
            },
        );
    };

    return (
        <>
            <Head title={`Checkout — ${restaurant.name}`} />
            <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8">
                <Button variant="ghost" className="mb-4 -ml-3" asChild>
                    <Link href={`/customer/restaurants/${restaurant.id}`}>
                        <ArrowLeft /> Back to {restaurant.name}
                    </Link>
                </Button>
                <div className="mb-6">
                    <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
                        Checkout
                    </h1>
                    <p className="text-muted-foreground mt-1 text-sm">
                        Review your delivery details and order from{' '}
                        {restaurant.name}.
                    </p>
                </div>

                {!cartMatchesRestaurant && (
                    <Alert variant="destructive" className="mb-6">
                        <AlertCircle />
                        <AlertTitle>
                            Your cart does not match this restaurant
                        </AlertTitle>
                        <AlertDescription>
                            Open your cart and continue checkout from the
                            restaurant shown there.
                        </AlertDescription>
                    </Alert>
                )}

                <form
                    onSubmit={submit}
                    className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_23rem]"
                >
                    <div className="space-y-6">
                        <Card>
                            <CardHeader className="flex-row items-start justify-between gap-4">
                                <div>
                                    <CardTitle>Delivery address</CardTitle>
                                    <CardDescription>
                                        Delivery is available only inside an
                                        active service zone.
                                    </CardDescription>
                                </div>
                                {addresses.length > 0 && (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                            setShowNewAddress(
                                                (visible) => !visible,
                                            )
                                        }
                                    >
                                        <MapPinPlus /> Add new
                                    </Button>
                                )}
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {addresses.length === 0 && !showNewAddress && (
                                    <Alert>
                                        <AlertCircle />
                                        <AlertTitle>
                                            No saved address
                                        </AlertTitle>
                                        <AlertDescription>
                                            Add a delivery address before
                                            placing your order.
                                        </AlertDescription>
                                    </Alert>
                                )}

                                {addresses.length > 0 && (
                                    <div className="grid gap-3 sm:grid-cols-2">
                                        {addresses.map((address) => (
                                            <label
                                                key={address.id}
                                                className={cn(
                                                    'cursor-pointer rounded-xl border p-4 transition-colors',
                                                    addressId === address.id &&
                                                        'border-primary bg-primary/5 ring-primary/20 ring-2',
                                                )}
                                            >
                                                <div className="flex items-start gap-3">
                                                    <input
                                                        type="radio"
                                                        name="customer_address_id"
                                                        className="mt-1"
                                                        checked={
                                                            addressId ===
                                                            address.id
                                                        }
                                                        onChange={() =>
                                                            setAddressId(
                                                                address.id,
                                                            )
                                                        }
                                                    />
                                                    <span className="min-w-0">
                                                        <span className="flex items-center gap-2 font-medium">
                                                            {address.label}
                                                            {address.is_default && (
                                                                <Badge variant="secondary">
                                                                    Default
                                                                </Badge>
                                                            )}
                                                        </span>
                                                        <span className="text-muted-foreground mt-1 block text-sm">
                                                            {
                                                                address.address_line
                                                            }
                                                        </span>
                                                        {address.landmark && (
                                                            <span className="text-muted-foreground block text-xs">
                                                                Near{' '}
                                                                {
                                                                    address.landmark
                                                                }
                                                            </span>
                                                        )}
                                                    </span>
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                )}

                                {showNewAddress && (
                                    <div className="space-y-4 rounded-xl border p-4">
                                        <AddressForm
                                            value={newAddress}
                                            fallback={restaurant}
                                            onChange={setNewAddress}
                                            onSubmit={() => void saveAddress()}
                                            onCancel={
                                                addresses.length > 0
                                                    ? () =>
                                                          setShowNewAddress(
                                                              false,
                                                          )
                                                    : undefined
                                            }
                                            errors={addressErrors}
                                            processing={addressSaving}
                                            idPrefix="checkout-address"
                                        />
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Order notes</CardTitle>
                                <CardDescription>
                                    Add instructions for the restaurant or
                                    rider.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <textarea
                                    className="border-input bg-background min-h-24 w-full rounded-md border px-3 py-2 text-sm"
                                    value={customerNotes}
                                    maxLength={1000}
                                    onChange={(event) =>
                                        setCustomerNotes(event.target.value)
                                    }
                                    placeholder="Allergies, gate instructions, or other notes"
                                />
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Payment method</CardTitle>
                                <CardDescription>
                                    Online orders are created only after
                                    PayMongo verifies payment.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="grid gap-3 sm:grid-cols-3">
                                {paymentMethods.map((method) => (
                                    <label
                                        key={method.value}
                                        className={cn(
                                            'cursor-pointer rounded-xl border p-4 transition-colors',
                                            paymentMethod === method.value &&
                                                'border-primary bg-primary/5 ring-primary/20 ring-2',
                                        )}
                                    >
                                        <span className="flex items-start gap-3">
                                            <input
                                                type="radio"
                                                name="payment_method"
                                                className="mt-1"
                                                checked={
                                                    paymentMethod ===
                                                    method.value
                                                }
                                                onChange={() =>
                                                    setPaymentMethod(
                                                        method.value,
                                                    )
                                                }
                                            />
                                            <span>
                                                <span className="block text-sm font-medium">
                                                    {method.label}
                                                </span>
                                                <span className="text-muted-foreground mt-1 block text-xs">
                                                    {method.description}
                                                </span>
                                            </span>
                                        </span>
                                    </label>
                                ))}
                            </CardContent>
                        </Card>
                    </div>

                    <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <ShoppingBag className="size-5" /> Order
                                    summary
                                </CardTitle>
                                <CardDescription>
                                    {restaurant.name}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {items.map((item) => (
                                    <div
                                        key={item.key}
                                        className="flex justify-between gap-3 text-sm"
                                    >
                                        <div className="min-w-0">
                                            <p className="font-medium">
                                                {item.quantity}× {item.name}
                                            </p>
                                            {item.variant && (
                                                <p className="text-muted-foreground text-xs">
                                                    {item.variant.name}
                                                </p>
                                            )}
                                            {item.addons.length > 0 && (
                                                <p className="text-muted-foreground text-xs">
                                                    {item.addons
                                                        .map(
                                                            (addon) =>
                                                                addon.name,
                                                        )
                                                        .join(', ')}
                                                </p>
                                            )}
                                            {item.specialInstructions && (
                                                <p className="text-muted-foreground mt-1 line-clamp-2 text-xs italic">
                                                    “{item.specialInstructions}”
                                                </p>
                                            )}
                                        </div>
                                        <span className="shrink-0 font-medium">
                                            {money.format(
                                                itemUnitPrice(item) *
                                                    item.quantity,
                                            )}
                                        </span>
                                    </div>
                                ))}

                                <div className="space-y-2 border-t pt-4">
                                    <Label htmlFor="voucher">
                                        Voucher code
                                    </Label>
                                    <div className="flex gap-2">
                                        <div className="relative flex-1">
                                            <TicketPercent className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                                            <Input
                                                id="voucher"
                                                className="pl-9 uppercase"
                                                value={voucherInput}
                                                onChange={(event) =>
                                                    setVoucherInput(
                                                        event.target.value.toUpperCase(),
                                                    )
                                                }
                                            />
                                        </div>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() =>
                                                setAppliedVoucher(
                                                    voucherInput.trim() || null,
                                                )
                                            }
                                        >
                                            Apply
                                        </Button>
                                    </div>
                                    {quote?.voucher && (
                                        <p className="text-xs font-medium text-emerald-700">
                                            {quote.voucher.code} applied
                                        </p>
                                    )}
                                </div>

                                <div className="space-y-2 border-t pt-4">
                                    <Label>Tip your rider</Label>
                                    <div className="grid grid-cols-4 gap-2">
                                        {[0, 20, 50, 100].map((amount) => (
                                            <Button
                                                key={amount}
                                                type="button"
                                                size="sm"
                                                variant={
                                                    tipAmount === amount
                                                        ? 'default'
                                                        : 'outline'
                                                }
                                                onClick={() =>
                                                    setTipAmount(amount)
                                                }
                                            >
                                                ₱{amount}
                                            </Button>
                                        ))}
                                    </div>
                                    <Input
                                        type="number"
                                        min={0}
                                        max={5000}
                                        step="0.01"
                                        value={tipAmount}
                                        onChange={(event) =>
                                            setTipAmount(
                                                Math.max(
                                                    0,
                                                    Number(
                                                        event.target.value,
                                                    ) || 0,
                                                ),
                                            )
                                        }
                                        aria-label="Custom tip amount"
                                        placeholder="Custom tip"
                                    />
                                </div>

                                <div className="space-y-2 border-t pt-4 text-sm">
                                    <SummaryRow
                                        label="Subtotal"
                                        value={quote?.subtotal ?? cartSubtotal}
                                    />
                                    <SummaryRow
                                        label={
                                            quote
                                                ? `Delivery (${quote.delivery_distance_km.toFixed(1)} km)`
                                                : 'Delivery'
                                        }
                                        value={quote?.delivery_fee}
                                    />
                                    <SummaryRow
                                        label="Service fee"
                                        value={quote?.service_fee}
                                    />
                                    {(quote?.discount_amount ?? 0) > 0 && (
                                        <SummaryRow
                                            label="Discount"
                                            value={
                                                -(quote?.discount_amount ?? 0)
                                            }
                                            positive
                                        />
                                    )}
                                    {(quote?.tip_amount ?? tipAmount) > 0 && (
                                        <SummaryRow
                                            label="Rider tip"
                                            value={
                                                quote?.tip_amount ?? tipAmount
                                            }
                                        />
                                    )}
                                    <div className="flex justify-between border-t pt-3 text-base font-semibold">
                                        <span>Total</span>
                                        <span>
                                            {quoteLoading ? (
                                                <LoaderCircle className="size-5 animate-spin" />
                                            ) : quote ? (
                                                money.format(quote.total_amount)
                                            ) : (
                                                '—'
                                            )}
                                        </span>
                                    </div>
                                </div>

                                {quoteErrors.length > 0 && (
                                    <ErrorList messages={quoteErrors} />
                                )}
                                {submitErrors.length > 0 && (
                                    <ErrorList messages={submitErrors} />
                                )}

                                <Button
                                    type="submit"
                                    size="lg"
                                    className="w-full"
                                    disabled={
                                        !quote ||
                                        quoteLoading ||
                                        submitting ||
                                        !cartMatchesRestaurant ||
                                        addressId === null
                                    }
                                >
                                    {submitting ? (
                                        <>
                                            <LoaderCircle className="animate-spin" />
                                            Processing…
                                        </>
                                    ) : paymentMethod === 'cod' ? (
                                        <>
                                            <ReceiptText /> Place order
                                        </>
                                    ) : (
                                        'Continue to PayMongo'
                                    )}
                                </Button>
                                <p className="text-muted-foreground text-center text-xs">
                                    Prices, availability, restaurant hours,
                                    minimum order, and delivery zone are checked
                                    again when you place the order.
                                </p>
                            </CardContent>
                        </Card>
                    </aside>
                </form>
            </div>
        </>
    );
}

function SummaryRow({
    label,
    value,
    positive = false,
}: {
    label: string;
    value?: number;
    positive?: boolean;
}) {
    return (
        <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">{label}</span>
            <span className={positive ? 'text-emerald-700' : undefined}>
                {value === undefined
                    ? '—'
                    : `${value < 0 ? '−' : ''}${money.format(Math.abs(value))}`}
            </span>
        </div>
    );
}

function ErrorList({ messages }: { messages: string[] }) {
    return (
        <Alert variant="destructive">
            <AlertCircle />
            <AlertTitle>Checkout needs attention</AlertTitle>
            <AlertDescription>
                <ul className="list-disc pl-4">
                    {messages.map((message, index) => (
                        <li key={`${message}-${index}`}>{message}</li>
                    ))}
                </ul>
            </AlertDescription>
        </Alert>
    );
}
