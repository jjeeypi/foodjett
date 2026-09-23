import { Head, Link } from '@inertiajs/react';
import {
    ArrowLeft,
    Ban,
    CreditCard,
    MapPin,
    ReceiptText,
    RotateCcw,
    Truck,
} from 'lucide-react';
import OrderStatusBadge, {
    type OrderStatus,
} from '@/components/admin/order-status-badge';
import TextActionDialog from '@/components/admin/text-action-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type OrderItem = {
    id: number;
    quantity: number;
    unit_price: string;
    special_instructions: string | null;
    menu_item: { name: string };
    variant: { name: string; price_delta: string } | null;
    addons: {
        id: number;
        price: string;
        addon: { name: string; price: string };
    }[];
};

type StatusHistory = {
    id: number;
    status: OrderStatus;
    changed_by: 'customer' | 'restaurant' | 'rider' | 'admin' | 'system';
    note: string | null;
    created_at: string;
};

type Payment = {
    id: number;
    method: 'cod' | 'gcash' | 'card';
    status: 'pending' | 'paid' | 'refunded' | 'partially_refunded' | 'failed';
    amount: string;
    refunded_amount: string;
    transaction_reference: string | null;
    paid_at: string | null;
    refunded_at: string | null;
    status_history: {
        id: number;
        from_status: string | null;
        to_status: string;
        changed_by: string;
        note: string | null;
        created_at: string;
    }[];
};

type Order = {
    id: number;
    order_number: string;
    customer_id: number;
    restaurant_id: number;
    customer_address_id: number;
    rider_id: number | null;
    status: OrderStatus;
    subtotal: string;
    delivery_fee: string;
    service_fee: string;
    discount_amount: string;
    tip_amount: string;
    total_amount: string;
    commission_amount: string | null;
    payment_method: 'cod' | 'gcash' | 'card';
    customer_notes: string | null;
    rejection_reason: string | null;
    cancellation_reason: string | null;
    cancelled_by: string | null;
    placed_at: string;
    accepted_at: string | null;
    estimated_prep_minutes: number | null;
    estimated_ready_at: string | null;
    prep_extended_minutes: number | null;
    ready_at: string | null;
    rider_search_started_at: string | null;
    rider_assigned_at: string | null;
    rider_arrived_restaurant_at: string | null;
    picked_up_at: string | null;
    delivered_at: string | null;
    pickup_code: string | null;
    proof_of_delivery_path: string | null;
    created_at: string;
    updated_at: string;
    restaurant: {
        id: number;
        name: string;
        address: string;
        latitude: string;
        longitude: string;
    };
    customer: {
        user: { name: string; email: string; phone: string | null };
    } | null;
    rider: {
        user: { name: string; email: string; phone: string | null };
    } | null;
    delivery_address: {
        label: string;
        address_line: string;
        landmark: string | null;
        delivery_instructions: string | null;
        latitude: string;
        longitude: string;
    };
    items: OrderItem[];
    status_history: StatusHistory[];
    payment: Payment | null;
    pool_offer: {
        search_radius_km: string;
        incentive_amount: string;
        escalation_stage: string;
        admin_assigned: boolean;
        updated_at: string;
    } | null;
};

const terminalStatuses: OrderStatus[] = [
    'delivered',
    'rejected_by_restaurant',
    'cancelled_by_customer',
    'cancelled_by_restaurant',
    'cancelled_no_rider',
    'cancelled_by_admin',
    'failed_delivery',
];

const currency = new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
});

const formatDate = (value: string | null) =>
    value ? new Date(value).toLocaleString() : '—';

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div>
            <dt className="text-muted-foreground text-xs">{label}</dt>
            <dd className="mt-1 text-sm break-words">{value || '—'}</dd>
        </div>
    );
}

export default function OrderShow({ order }: { order: Order }) {
    const canCancel = !terminalStatuses.includes(order.status);
    const canRefund =
        order.payment?.status === 'paid' ||
        order.payment?.status === 'partially_refunded';

    const timestamps: Array<[string, string | null]> = [
        ['Placed', order.placed_at],
        ['Accepted', order.accepted_at],
        ['Estimated ready', order.estimated_ready_at],
        ['Ready', order.ready_at],
        ['Rider search started', order.rider_search_started_at],
        ['Rider assigned', order.rider_assigned_at],
        ['Rider at restaurant', order.rider_arrived_restaurant_at],
        ['Picked up', order.picked_up_at],
        ['Delivered', order.delivered_at],
    ];

    return (
        <>
            <Head title={order.order_number} />
            <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
                <div>
                    <Button variant="ghost" size="sm" className="mb-3" asChild>
                        <Link href="/admin/orders">
                            <ArrowLeft /> Back to orders
                        </Link>
                    </Button>
                    <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                        <div>
                            <div className="flex flex-wrap items-center gap-2">
                                <h2 className="text-2xl font-semibold tracking-tight">
                                    {order.order_number}
                                </h2>
                                <OrderStatusBadge status={order.status} />
                            </div>
                            <p className="text-muted-foreground mt-1 text-sm">
                                Placed {formatDate(order.placed_at)} at{' '}
                                {order.restaurant.name}
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {canRefund && (
                                <TextActionDialog
                                    action={`/admin/orders/${order.id}/refund`}
                                    field="reason"
                                    title="Record full refund"
                                    description="This records a full refund in FoodJett. It does not send a refund request to PayMongo."
                                    fieldLabel="Refund reason"
                                    placeholder="Explain why the payment is being refunded…"
                                    triggerLabel="Process refund"
                                    submitLabel="Record refund"
                                    processingLabel="Recording…"
                                    variant="outline"
                                    triggerIcon={<RotateCcw />}
                                />
                            )}
                            {canCancel && (
                                <TextActionDialog
                                    action={`/admin/orders/${order.id}/cancel`}
                                    field="reason"
                                    title="Cancel this order"
                                    description="This is an admin override and immediately moves the order to a terminal state."
                                    fieldLabel="Cancellation reason"
                                    placeholder="Explain why the order must be cancelled…"
                                    triggerLabel="Cancel order"
                                    submitLabel="Cancel order"
                                    processingLabel="Cancelling…"
                                    variant="destructive"
                                    triggerIcon={<Ban />}
                                />
                            )}
                        </div>
                    </div>
                </div>

                <div className="grid gap-6 xl:grid-cols-3">
                    <div className="space-y-6 xl:col-span-2">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <ReceiptText className="size-5" /> Order
                                    items
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {order.items.map((item) => (
                                    <div
                                        key={item.id}
                                        className="flex flex-col justify-between gap-3 rounded-lg border p-4 sm:flex-row"
                                    >
                                        <div>
                                            <p className="font-medium">
                                                {item.quantity} ×{' '}
                                                {item.menu_item.name}
                                            </p>
                                            {item.variant && (
                                                <p className="text-muted-foreground text-sm">
                                                    Variant: {item.variant.name}
                                                </p>
                                            )}
                                            {item.addons.length > 0 && (
                                                <p className="text-muted-foreground text-sm">
                                                    Add-ons:{' '}
                                                    {item.addons
                                                        .map(
                                                            (itemAddon) =>
                                                                itemAddon.addon
                                                                    .name,
                                                        )
                                                        .join(', ')}
                                                </p>
                                            )}
                                            {item.special_instructions && (
                                                <p className="mt-1 text-sm italic">
                                                    “{item.special_instructions}
                                                    ”
                                                </p>
                                            )}
                                        </div>
                                        <p className="shrink-0 font-medium tabular-nums">
                                            {currency.format(
                                                Number(item.unit_price) *
                                                    item.quantity +
                                                    item.addons.reduce(
                                                        (sum, addon) =>
                                                            sum +
                                                            Number(
                                                                addon.price,
                                                            ) *
                                                                item.quantity,
                                                        0,
                                                    ),
                                            )}
                                        </p>
                                    </div>
                                ))}
                                {order.items.length === 0 && (
                                    <p className="text-muted-foreground text-sm">
                                        This order has no item rows.
                                    </p>
                                )}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Order timeline</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {order.status_history.length > 0 ? (
                                    <ol className="relative ml-2 border-l">
                                        {order.status_history.map((entry) => (
                                            <li
                                                key={entry.id}
                                                className="relative ml-6 pb-7 last:pb-0"
                                            >
                                                <span className="bg-primary ring-background absolute top-1.5 -left-[1.72rem] size-3 rounded-full ring-4" />
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <OrderStatusBadge
                                                        status={entry.status}
                                                    />
                                                    <Badge
                                                        variant="outline"
                                                        className="capitalize"
                                                    >
                                                        {entry.changed_by}
                                                    </Badge>
                                                </div>
                                                <p className="text-muted-foreground mt-1 text-xs">
                                                    {formatDate(
                                                        entry.created_at,
                                                    )}
                                                </p>
                                                {entry.note && (
                                                    <p className="mt-2 text-sm">
                                                        {entry.note}
                                                    </p>
                                                )}
                                            </li>
                                        ))}
                                    </ol>
                                ) : (
                                    <p className="text-muted-foreground text-sm">
                                        No status history has been recorded.
                                    </p>
                                )}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Operational details</CardTitle>
                            </CardHeader>
                            <CardContent className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                                <Detail
                                    label="Order record ID"
                                    value={`#${order.id}`}
                                />
                                <Detail
                                    label="Address record ID"
                                    value={`#${order.customer_address_id}`}
                                />
                                <Detail
                                    label="Payment method"
                                    value={order.payment_method.toUpperCase()}
                                />
                                <Detail
                                    label="Estimated prep"
                                    value={
                                        order.estimated_prep_minutes === null
                                            ? '—'
                                            : `${order.estimated_prep_minutes} minutes`
                                    }
                                />
                                <Detail
                                    label="Prep extension"
                                    value={
                                        order.prep_extended_minutes === null
                                            ? '—'
                                            : `${order.prep_extended_minutes} minutes`
                                    }
                                />
                                <Detail
                                    label="Pickup code"
                                    value={order.pickup_code}
                                />
                                {timestamps.map(([label, value]) => (
                                    <Detail
                                        key={label}
                                        label={label}
                                        value={formatDate(value)}
                                    />
                                ))}
                                <Detail
                                    label="Proof of delivery"
                                    value={order.proof_of_delivery_path}
                                />
                                <Detail
                                    label="Record created"
                                    value={formatDate(order.created_at)}
                                />
                                <Detail
                                    label="Last updated"
                                    value={formatDate(order.updated_at)}
                                />
                            </CardContent>
                        </Card>
                    </div>

                    <aside className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>People</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-5 text-sm">
                                <div>
                                    <p className="text-muted-foreground text-xs">
                                        Restaurant #{order.restaurant_id}
                                    </p>
                                    <p className="font-medium">
                                        {order.restaurant.name}
                                    </p>
                                    <p>{order.restaurant.address}</p>
                                </div>
                                <div>
                                    <p className="text-muted-foreground text-xs">
                                        Customer #{order.customer_id}
                                    </p>
                                    <p className="font-medium">
                                        {order.customer?.user.name ||
                                            'Customer'}
                                    </p>
                                    <p>{order.customer?.user.email}</p>
                                    <p>{order.customer?.user.phone}</p>
                                </div>
                                <div>
                                    <p className="text-muted-foreground text-xs">
                                        Rider{' '}
                                        {order.rider_id
                                            ? `#${order.rider_id}`
                                            : ''}
                                    </p>
                                    <p className="font-medium">
                                        {order.rider?.user.name ||
                                            'Not assigned'}
                                    </p>
                                    <p>{order.rider?.user.email}</p>
                                    <p>{order.rider?.user.phone}</p>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <MapPin className="size-5" /> Delivery
                                    address
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2 text-sm">
                                <p className="font-medium">
                                    {order.delivery_address.label}
                                </p>
                                <p>{order.delivery_address.address_line}</p>
                                {order.delivery_address.landmark && (
                                    <p>
                                        Landmark:{' '}
                                        {order.delivery_address.landmark}
                                    </p>
                                )}
                                {order.delivery_address
                                    .delivery_instructions && (
                                    <p className="text-muted-foreground">
                                        {
                                            order.delivery_address
                                                .delivery_instructions
                                        }
                                    </p>
                                )}
                                <p className="text-muted-foreground text-xs">
                                    {order.delivery_address.latitude},{' '}
                                    {order.delivery_address.longitude}
                                </p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <CreditCard className="size-5" /> Payment
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {order.payment ? (
                                    <>
                                        <dl className="grid grid-cols-2 gap-4">
                                            <Detail
                                                label="Method"
                                                value={order.payment.method.toUpperCase()}
                                            />
                                            <Detail
                                                label="Status"
                                                value={
                                                    <Badge
                                                        variant="outline"
                                                        className="capitalize"
                                                    >
                                                        {order.payment.status.replaceAll(
                                                            '_',
                                                            ' ',
                                                        )}
                                                    </Badge>
                                                }
                                            />
                                            <Detail
                                                label="Amount"
                                                value={currency.format(
                                                    Number(
                                                        order.payment.amount,
                                                    ),
                                                )}
                                            />
                                            <Detail
                                                label="Refunded"
                                                value={currency.format(
                                                    Number(
                                                        order.payment
                                                            .refunded_amount,
                                                    ),
                                                )}
                                            />
                                            <Detail
                                                label="Paid at"
                                                value={formatDate(
                                                    order.payment.paid_at,
                                                )}
                                            />
                                            <Detail
                                                label="Refunded at"
                                                value={formatDate(
                                                    order.payment.refunded_at,
                                                )}
                                            />
                                        </dl>
                                        <Detail
                                            label="Transaction reference"
                                            value={
                                                order.payment
                                                    .transaction_reference
                                            }
                                        />
                                        {order.payment.status_history.length >
                                            0 && (
                                            <div className="space-y-2 border-t pt-4">
                                                <p className="text-sm font-medium">
                                                    Payment history
                                                </p>
                                                {order.payment.status_history.map(
                                                    (entry) => (
                                                        <div
                                                            key={entry.id}
                                                            className="text-sm"
                                                        >
                                                            <p className="capitalize">
                                                                {entry.from_status ||
                                                                    'created'}{' '}
                                                                →{' '}
                                                                {
                                                                    entry.to_status
                                                                }
                                                            </p>
                                                            <p className="text-muted-foreground text-xs">
                                                                {
                                                                    entry.changed_by
                                                                }{' '}
                                                                ·{' '}
                                                                {formatDate(
                                                                    entry.created_at,
                                                                )}
                                                            </p>
                                                            {entry.note && (
                                                                <p className="mt-1 text-xs">
                                                                    {entry.note}
                                                                </p>
                                                            )}
                                                        </div>
                                                    ),
                                                )}
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <p className="text-muted-foreground text-sm">
                                        No payment row is linked to this order.
                                    </p>
                                )}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Truck className="size-5" /> Rider pool
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                {order.pool_offer ? (
                                    <dl className="grid grid-cols-2 gap-4">
                                        <Detail
                                            label="Escalation"
                                            value={order.pool_offer.escalation_stage.replaceAll(
                                                '_',
                                                ' ',
                                            )}
                                        />
                                        <Detail
                                            label="Admin assigned"
                                            value={
                                                order.pool_offer.admin_assigned
                                                    ? 'Yes'
                                                    : 'No'
                                            }
                                        />
                                        <Detail
                                            label="Search radius"
                                            value={`${order.pool_offer.search_radius_km} km`}
                                        />
                                        <Detail
                                            label="Incentive"
                                            value={currency.format(
                                                Number(
                                                    order.pool_offer
                                                        .incentive_amount,
                                                ),
                                            )}
                                        />
                                    </dl>
                                ) : (
                                    <p className="text-muted-foreground text-sm">
                                        This order has not entered the rider
                                        pool.
                                    </p>
                                )}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Financial summary</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <dl className="grid grid-cols-2 gap-4">
                                    <Detail
                                        label="Subtotal"
                                        value={currency.format(
                                            Number(order.subtotal),
                                        )}
                                    />
                                    <Detail
                                        label="Delivery fee"
                                        value={currency.format(
                                            Number(order.delivery_fee),
                                        )}
                                    />
                                    <Detail
                                        label="Service fee"
                                        value={currency.format(
                                            Number(order.service_fee),
                                        )}
                                    />
                                    <Detail
                                        label="Discount"
                                        value={currency.format(
                                            Number(order.discount_amount),
                                        )}
                                    />
                                    <Detail
                                        label="Tip"
                                        value={currency.format(
                                            Number(order.tip_amount),
                                        )}
                                    />
                                    <Detail
                                        label="Commission"
                                        value={
                                            order.commission_amount === null
                                                ? '—'
                                                : currency.format(
                                                      Number(
                                                          order.commission_amount,
                                                      ),
                                                  )
                                        }
                                    />
                                    <div className="col-span-2 border-t pt-3">
                                        <Detail
                                            label="Total"
                                            value={
                                                <span className="text-lg font-semibold">
                                                    {currency.format(
                                                        Number(
                                                            order.total_amount,
                                                        ),
                                                    )}
                                                </span>
                                            }
                                        />
                                    </div>
                                </dl>
                            </CardContent>
                        </Card>

                        {(order.customer_notes ||
                            order.rejection_reason ||
                            order.cancellation_reason) && (
                            <Card>
                                <CardHeader>
                                    <CardTitle>Notes and exceptions</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {order.customer_notes && (
                                        <Detail
                                            label="Customer notes"
                                            value={order.customer_notes}
                                        />
                                    )}
                                    {order.rejection_reason && (
                                        <Detail
                                            label="Rejection reason"
                                            value={order.rejection_reason}
                                        />
                                    )}
                                    {order.cancellation_reason && (
                                        <Detail
                                            label={`Cancellation reason${order.cancelled_by ? ` (${order.cancelled_by})` : ''}`}
                                            value={order.cancellation_reason}
                                        />
                                    )}
                                </CardContent>
                            </Card>
                        )}
                    </aside>
                </div>
            </div>
        </>
    );
}

OrderShow.layout = { title: 'Order details' };
