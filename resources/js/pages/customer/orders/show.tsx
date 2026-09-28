import { Head, Link, router, useForm } from '@inertiajs/react';
import { useConnectionStatus, useEcho } from '@laravel/echo-react';
import {
    Bike,
    Check,
    ChefHat,
    Clock3,
    LoaderCircle,
    MapPin,
    MessageCircle,
    PackageCheck,
    ReceiptText,
    Star,
    TriangleAlert,
    Utensils,
} from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import InputError from '@/components/input-error';
import OrderStatusBadge, {
    orderStatusLabel,
    terminalOrderStatuses,
    type CustomerOrderStatus,
} from '@/components/customer/order-status-badge';
import OrderTrackingMap, {
    type RiderLocation,
} from '@/components/customer/order-tracking-map';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Rider = {
    id: number;
    name: string;
    photo_url: string | null;
    vehicle_type: string;
    current_latitude: number | null;
    current_longitude: number | null;
    location_updated_at: string | null;
    message_url: string;
};

type OrderItem = {
    id: number;
    name: string;
    photo_url: string | null;
    variant: string | null;
    quantity: number;
    unit_price: number;
    special_instructions: string | null;
    addons: Array<{ name: string; price: number }>;
    line_total: number;
};

type Payment = {
    status: 'pending' | 'paid' | 'refunded' | 'partially_refunded' | 'failed';
    amount: number;
    refunded_amount: number;
    transaction_reference: string | null;
};

type SubmittedReview = {
    restaurant_rating: number;
    restaurant_comment: string | null;
    restaurant_photo_url: string | null;
    rider_rating: number | null;
};

type OrderDetail = {
    id: number;
    order_number: string;
    status: CustomerOrderStatus;
    is_active: boolean;
    restaurant: {
        id: number;
        name: string;
        logo_url: string | null;
        latitude: number;
        longitude: number;
    };
    delivery_address: {
        label: string;
        address_line: string;
        landmark: string | null;
        delivery_instructions: string | null;
        latitude: number;
        longitude: number;
    };
    items: OrderItem[];
    subtotal: number;
    delivery_fee: number;
    service_fee: number;
    discount_amount: number;
    tip_amount: number;
    total_amount: number;
    payment_method: 'cod' | 'gcash' | 'card';
    payment: Payment | null;
    customer_notes: string | null;
    placed_at: string;
    delivered_at: string | null;
    estimated_ready_at: string | null;
    prep_extended_minutes: number | null;
    rider: Rider | null;
    escalation_stage: string | null;
    cancellation_reason: string | null;
    rejection_reason: string | null;
    cancelled_by: string | null;
    can_cancel: boolean;
    cancellation_explanation: string | null;
    can_review: boolean;
    can_report: boolean;
    review: SubmittedReview | null;
};

type HistoryEntry = {
    status: CustomerOrderStatus;
    note: string | null;
    created_at: string | null;
};

type StatusUpdate = {
    event_id: string;
    id: number;
    order_number: string;
    status: CustomerOrderStatus;
    estimated_ready_at: string | null;
    prep_extended_minutes: number | null;
    rider: Rider | null;
    escalation_stage: string | null;
    notice: 'prep_extended' | 'rider_search_delayed' | null;
    cancellation_reason: string | null;
    rejection_reason: string | null;
    updated_at: string;
};

type LocationUpdate = {
    order_id: number;
    latitude: number;
    longitude: number;
    timestamp: string;
};

const steps = [
    ['placed', 'Order placed', 'Your order was sent to the restaurant.'],
    ['accepted', 'Accepted', 'The restaurant accepted your order.'],
    ['preparing', 'Preparing', 'The kitchen is preparing your food.'],
    [
        'finding_rider',
        'Finding a rider',
        'We are matching your order with a rider.',
    ],
    [
        'rider_assigned',
        'Rider assigned',
        'A rider is heading to the restaurant.',
    ],
    ['picked_up', 'Picked up', 'Your rider collected your order.'],
    ['on_the_way', 'On the way', 'Your order is heading to you.'],
    ['delivered', 'Delivered', 'Your order has arrived.'],
] as const;

const statusRank: Record<CustomerOrderStatus, number> = {
    placed: 0,
    accepted: 1,
    preparing: 2,
    ready: 2,
    finding_rider: 3,
    rider_assigned: 4,
    at_restaurant: 4,
    picked_up: 5,
    on_the_way: 6,
    arrived: 6,
    delivered: 7,
    rejected_by_restaurant: -1,
    cancelled_by_customer: -1,
    cancelled_by_restaurant: -1,
    cancelled_no_rider: -1,
    cancelled_by_admin: -1,
    failed_delivery: -1,
};

const mapStatuses = new Set<CustomerOrderStatus>([
    'rider_assigned',
    'at_restaurant',
    'picked_up',
    'on_the_way',
    'arrived',
]);

const money = new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
});
const dateTime = new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
});

const initials = (name: string) =>
    name
        .split(' ')
        .map((part) => part[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();

const initialLocation = (rider: Rider | null): RiderLocation | null => {
    if (
        rider?.current_latitude == null ||
        rider.current_longitude == null ||
        rider.location_updated_at === null
    ) {
        return null;
    }

    return {
        latitude: rider.current_latitude,
        longitude: rider.current_longitude,
        timestamp: rider.location_updated_at,
    };
};

const cancellationState = (
    status: CustomerOrderStatus,
    escalationStage: string | null,
) => {
    const canCancel =
        status === 'placed' ||
        (status === 'finding_rider' && escalationStage === 'customer_notified');

    if (canCancel) return { canCancel: true, explanation: null };
    if (terminalOrderStatuses.has(status)) {
        return {
            canCancel: false,
            explanation:
                'This order is already finished and can no longer be cancelled.',
        };
    }
    if (status === 'finding_rider') {
        return {
            canCancel: false,
            explanation:
                'You can cancel for a full refund if the rider search reaches the customer-notify delay stage.',
        };
    }
    if (['accepted', 'preparing', 'ready'].includes(status)) {
        return {
            canCancel: false,
            explanation:
                'The restaurant has accepted this order. Cancellation is available only if the platform cannot find a rider in time.',
        };
    }

    return {
        canCancel: false,
        explanation:
            'A rider is already handling this order, so customer cancellation is no longer available.',
    };
};

export default function ShowOrder({
    order,
    history,
}: {
    order: OrderDetail;
    history: HistoryEntry[];
}) {
    const [currentOrder, setCurrentOrder] = useState(order);
    const [timeline, setTimeline] = useState(history);

    useEffect(() => {
        setCurrentOrder(order);
        setTimeline(history);
    }, [history, order]);

    return (
        <>
            <Head title={`Order ${currentOrder.order_number}`} />
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                    <div>
                        <Button
                            variant="link"
                            className="mb-2 h-auto p-0"
                            asChild
                        >
                            <Link href="/customer/orders">← All orders</Link>
                        </Button>
                        <p className="text-muted-foreground text-sm">
                            {currentOrder.restaurant.name}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-3">
                            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
                                {currentOrder.order_number}
                            </h1>
                            <OrderStatusBadge status={currentOrder.status} />
                        </div>
                        <p className="text-muted-foreground mt-1 text-xs">
                            Placed{' '}
                            {dateTime.format(new Date(currentOrder.placed_at))}
                        </p>
                    </div>
                    {currentOrder.can_report && (
                        <ReportProblemDialog orderId={currentOrder.id} />
                    )}
                </div>

                {currentOrder.is_active ? (
                    <LiveTracking
                        order={currentOrder}
                        history={timeline}
                        onOrderChange={setCurrentOrder}
                        onHistoryChange={setTimeline}
                    />
                ) : (
                    <FinishedSummary order={currentOrder} />
                )}

                <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
                    <OrderItems order={currentOrder} />
                    <Receipt order={currentOrder} />
                </div>

                <DeliveryDetails order={currentOrder} />

                {!currentOrder.is_active && currentOrder.can_review && (
                    <ReviewForm order={currentOrder} />
                )}
                {!currentOrder.is_active && currentOrder.review && (
                    <SubmittedReviewCard
                        review={currentOrder.review}
                        hasRider={currentOrder.rider !== null}
                    />
                )}
            </div>
        </>
    );
}

function LiveTracking({
    order,
    history,
    onOrderChange,
    onHistoryChange,
}: {
    order: OrderDetail;
    history: HistoryEntry[];
    onOrderChange: (order: OrderDetail) => void;
    onHistoryChange: (history: HistoryEntry[]) => void;
}) {
    const connectionStatus = useConnectionStatus();
    const [notice, setNotice] = useState<StatusUpdate['notice']>(() =>
        order.status === 'finding_rider' &&
        order.escalation_stage === 'customer_notified'
            ? 'rider_search_delayed'
            : ['accepted', 'preparing', 'ready'].includes(order.status) &&
                (order.prep_extended_minutes ?? 0) > 0
              ? 'prep_extended'
              : null,
    );
    const [riderLocation, setRiderLocation] = useState<RiderLocation | null>(
        () => initialLocation(order.rider),
    );
    const processedEvents = useRef(new Set<string>());

    useEcho<StatusUpdate>(
        `order.${order.id}.status`,
        '.order.status.updated',
        (update) => {
            if (
                update.id !== order.id ||
                processedEvents.current.has(update.event_id)
            ) {
                return;
            }
            processedEvents.current.add(update.event_id);

            const cancellation = cancellationState(
                update.status,
                update.escalation_stage,
            );
            const nextOrder: OrderDetail = {
                ...order,
                status: update.status,
                is_active: !terminalOrderStatuses.has(update.status),
                estimated_ready_at: update.estimated_ready_at,
                prep_extended_minutes: update.prep_extended_minutes,
                rider: update.rider ?? order.rider,
                escalation_stage: update.escalation_stage,
                cancellation_reason: update.cancellation_reason,
                rejection_reason: update.rejection_reason,
                can_cancel: cancellation.canCancel,
                cancellation_explanation: cancellation.explanation,
            };
            onOrderChange(nextOrder);
            onHistoryChange([
                ...history,
                {
                    status: update.status,
                    note: null,
                    created_at: update.updated_at,
                },
            ]);

            if (update.notice !== null) {
                setNotice(update.notice);
            } else if (
                !['accepted', 'preparing', 'ready', 'finding_rider'].includes(
                    update.status,
                )
            ) {
                setNotice(null);
            }

            if (update.rider) {
                setRiderLocation(initialLocation(update.rider));
            }
            toast.info(`Order ${update.order_number} updated`, {
                description: orderStatusLabel[update.status],
            });

            if (terminalOrderStatuses.has(update.status)) {
                router.reload({
                    only: ['order', 'history'],
                });
            }
        },
        [history, order],
    );

    useEcho<LocationUpdate>(
        `order.${order.id}.status`,
        '.rider.location.updated',
        (update) => {
            if (update.order_id === order.id) {
                setRiderLocation({
                    latitude: update.latitude,
                    longitude: update.longitude,
                    timestamp: update.timestamp,
                });
            }
        },
        [order.id],
    );

    return (
        <>
            <div className="text-muted-foreground flex items-center gap-2 text-xs">
                <span
                    className={`size-2 rounded-full ${
                        connectionStatus === 'connected'
                            ? 'bg-emerald-500'
                            : connectionStatus === 'failed'
                              ? 'bg-red-500'
                              : 'bg-amber-500'
                    }`}
                />
                Live updates: {connectionStatus}
            </div>

            {notice === 'prep_extended' && (
                <div className="flex gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
                    <Clock3 className="mt-0.5 size-5 shrink-0" />
                    <div>
                        <p className="font-medium">
                            The restaurant needs a few more minutes.
                        </p>
                        {order.estimated_ready_at && (
                            <p className="mt-1 text-sm opacity-80">
                                Updated estimate:{' '}
                                {dateTime.format(
                                    new Date(order.estimated_ready_at),
                                )}
                            </p>
                        )}
                    </div>
                </div>
            )}

            {notice === 'rider_search_delayed' && (
                <div className="flex flex-col justify-between gap-4 rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-950 sm:flex-row sm:items-center dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
                    <div className="flex gap-3">
                        <TriangleAlert className="mt-0.5 size-5 shrink-0" />
                        <p className="font-medium">
                            We&apos;re having trouble finding a rider. Keep
                            waiting or cancel for a full refund?
                        </p>
                    </div>
                    {order.can_cancel && <CancelOrderDialog order={order} />}
                </div>
            )}

            {mapStatuses.has(order.status) && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex flex-col justify-between gap-1 sm:flex-row sm:items-center">
                            <span>Live delivery map</span>
                            {riderLocation && (
                                <span className="text-muted-foreground text-xs font-normal">
                                    Updated{' '}
                                    {dateTime.format(
                                        new Date(riderLocation.timestamp),
                                    )}
                                </span>
                            )}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <OrderTrackingMap
                            restaurant={order.restaurant}
                            delivery={{
                                ...order.delivery_address,
                                address: order.delivery_address.address_line,
                            }}
                            rider={riderLocation}
                        />
                        <p className="text-muted-foreground mt-3 text-xs">
                            The dashed line is a straight-line guide, not a road
                            route or arrival-time estimate.
                        </p>
                    </CardContent>
                </Card>
            )}

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
                <ProgressStepper status={order.status} history={history} />
                <div className="space-y-4">
                    {order.estimated_ready_at && (
                        <Card>
                            <CardContent className="flex gap-3 pt-6">
                                <Clock3 className="text-muted-foreground size-5 shrink-0" />
                                <div>
                                    <p className="font-medium">
                                        Estimated ready time
                                    </p>
                                    <p className="text-muted-foreground mt-1 text-sm">
                                        {dateTime.format(
                                            new Date(order.estimated_ready_at),
                                        )}
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                    {order.rider && <RiderCard rider={order.rider} />}
                    {order.can_cancel ? (
                        notice !== 'rider_search_delayed' && (
                            <CancelOrderDialog order={order} fullWidth />
                        )
                    ) : order.cancellation_explanation ? (
                        <p className="text-muted-foreground rounded-lg border p-3 text-xs">
                            {order.cancellation_explanation}
                        </p>
                    ) : null}
                </div>
            </div>
        </>
    );
}

function ProgressStepper({
    status,
    history,
}: {
    status: CustomerOrderStatus;
    history: HistoryEntry[];
}) {
    const rank = statusRank[status];

    return (
        <Card>
            <CardHeader>
                <CardTitle>Order progress</CardTitle>
            </CardHeader>
            <CardContent>
                <ol>
                    {steps.map(([stepStatus, label, description], index) => {
                        const completed = rank > index;
                        const active = rank === index;
                        const entry = history.find(
                            (candidate) =>
                                statusRank[candidate.status] === index,
                        );

                        return (
                            <li
                                key={stepStatus}
                                className="relative flex gap-4 pb-7 last:pb-0"
                            >
                                {index < steps.length - 1 && (
                                    <span
                                        className={`absolute top-8 bottom-0 left-[15px] w-px ${completed ? 'bg-emerald-500' : 'bg-border'}`}
                                    />
                                )}
                                <span
                                    className={`relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border-2 ${
                                        completed
                                            ? 'border-emerald-500 bg-emerald-500 text-white'
                                            : active
                                              ? 'border-primary bg-primary text-primary-foreground'
                                              : 'border-border bg-background text-muted-foreground'
                                    }`}
                                >
                                    {completed ? (
                                        <Check className="size-4" />
                                    ) : index < 3 ? (
                                        <ChefHat className="size-4" />
                                    ) : index < 7 ? (
                                        <Bike className="size-4" />
                                    ) : (
                                        <PackageCheck className="size-4" />
                                    )}
                                </span>
                                <div className="pt-1">
                                    <p
                                        className={
                                            active
                                                ? 'font-semibold'
                                                : 'font-medium'
                                        }
                                    >
                                        {label}
                                    </p>
                                    <p className="text-muted-foreground mt-0.5 text-sm">
                                        {description}
                                    </p>
                                    {entry?.created_at && (
                                        <p className="text-muted-foreground mt-1 text-xs">
                                            {dateTime.format(
                                                new Date(entry.created_at),
                                            )}
                                        </p>
                                    )}
                                </div>
                            </li>
                        );
                    })}
                </ol>
            </CardContent>
        </Card>
    );
}

function RiderCard({ rider }: { rider: Rider }) {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-base">Your rider</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                    <Avatar className="size-11">
                        {rider.photo_url && (
                            <AvatarImage
                                src={rider.photo_url}
                                alt={rider.name}
                            />
                        )}
                        <AvatarFallback>{initials(rider.name)}</AvatarFallback>
                    </Avatar>
                    <div>
                        <p className="font-medium">{rider.name}</p>
                        <p className="text-muted-foreground text-sm capitalize">
                            {rider.vehicle_type.replaceAll('_', ' ')}
                        </p>
                    </div>
                </div>
                <Button variant="outline" className="w-full" asChild>
                    <Link href={rider.message_url}>
                        <MessageCircle /> Contact rider
                    </Link>
                </Button>
            </CardContent>
        </Card>
    );
}

function CancelOrderDialog({
    order,
    fullWidth = false,
}: {
    order: OrderDetail;
    fullWidth?: boolean;
}) {
    const [open, setOpen] = useState(false);
    const [cancelling, setCancelling] = useState(false);

    const cancel = () => {
        router.patch(
            `/customer/orders/${order.id}/cancel`,
            {},
            {
                preserveScroll: true,
                onStart: () => setCancelling(true),
                onSuccess: () => {
                    setOpen(false);
                    toast.success('Order cancelled.');
                },
                onError: (errors) =>
                    toast.error(
                        typeof errors.order === 'string'
                            ? errors.order
                            : 'This order can no longer be cancelled.',
                    ),
                onFinish: () => setCancelling(false),
            },
        );
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button
                    variant="outline"
                    className={fullWidth ? 'w-full' : undefined}
                >
                    Cancel order
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Cancel this order?</DialogTitle>
                    <DialogDescription>
                        {order.status === 'placed'
                            ? 'The restaurant has not accepted it yet.'
                            : 'The rider search has been delayed. Any captured online payment will be marked for a full refund.'}
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button variant="outline">Keep order</Button>
                    </DialogClose>
                    <Button
                        variant="destructive"
                        onClick={cancel}
                        disabled={cancelling}
                    >
                        {cancelling && (
                            <LoaderCircle className="animate-spin" />
                        )}
                        Confirm cancellation
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function FinishedSummary({ order }: { order: OrderDetail }) {
    const reason = order.cancellation_reason ?? order.rejection_reason;

    return (
        <Card
            className={
                order.status === 'delivered'
                    ? 'border-emerald-200 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-950/20'
                    : 'border-red-200 bg-red-50/60 dark:border-red-900 dark:bg-red-950/20'
            }
        >
            <CardContent className="flex items-start gap-3 pt-6">
                {order.status === 'delivered' ? (
                    <PackageCheck className="mt-0.5 size-6 text-emerald-600" />
                ) : (
                    <TriangleAlert className="text-destructive mt-0.5 size-6" />
                )}
                <div>
                    <h2 className="font-semibold">
                        {orderStatusLabel[order.status]}
                    </h2>
                    {order.status === 'delivered' && order.delivered_at ? (
                        <p className="text-muted-foreground mt-1 text-sm">
                            Delivered{' '}
                            {dateTime.format(new Date(order.delivered_at))}
                        </p>
                    ) : (
                        <>
                            {reason && <p className="mt-1 text-sm">{reason}</p>}
                            {order.cancelled_by && (
                                <p className="text-muted-foreground mt-1 text-xs capitalize">
                                    Cancelled by {order.cancelled_by}
                                </p>
                            )}
                        </>
                    )}
                    {order.payment &&
                        ['refunded', 'partially_refunded'].includes(
                            order.payment.status,
                        ) && (
                            <Badge variant="outline" className="mt-3">
                                Refund:{' '}
                                {order.payment.status.replaceAll('_', ' ')}
                            </Badge>
                        )}
                </div>
            </CardContent>
        </Card>
    );
}

function OrderItems({ order }: { order: OrderDetail }) {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Utensils className="size-5" /> Items
                </CardTitle>
            </CardHeader>
            <CardContent className="divide-y">
                {order.items.map((item) => (
                    <article
                        key={item.id}
                        className="flex gap-4 py-4 first:pt-0 last:pb-0"
                    >
                        {item.photo_url ? (
                            <img
                                src={item.photo_url}
                                alt=""
                                className="size-16 rounded-lg object-cover"
                            />
                        ) : (
                            <div className="bg-muted flex size-16 shrink-0 items-center justify-center rounded-lg">
                                <Utensils className="text-muted-foreground size-5" />
                            </div>
                        )}
                        <div className="min-w-0 flex-1">
                            <div className="flex justify-between gap-3">
                                <h3 className="font-medium">
                                    {item.quantity}× {item.name}
                                </h3>
                                <span className="font-medium">
                                    {money.format(item.line_total)}
                                </span>
                            </div>
                            {item.variant && (
                                <p className="text-muted-foreground text-sm">
                                    {item.variant}
                                </p>
                            )}
                            {item.addons.length > 0 && (
                                <ul className="text-muted-foreground mt-1 text-xs">
                                    {item.addons.map((addon) => (
                                        <li key={`${item.id}-${addon.name}`}>
                                            + {addon.name} (
                                            {money.format(addon.price)})
                                        </li>
                                    ))}
                                </ul>
                            )}
                            {item.special_instructions && (
                                <p className="text-muted-foreground mt-2 text-xs italic">
                                    “{item.special_instructions}”
                                </p>
                            )}
                        </div>
                    </article>
                ))}
            </CardContent>
        </Card>
    );
}

function Receipt({ order }: { order: OrderDetail }) {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <ReceiptText className="size-5" /> Receipt
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
                <PriceRow label="Subtotal" amount={order.subtotal} />
                <PriceRow label="Delivery fee" amount={order.delivery_fee} />
                <PriceRow label="Service fee" amount={order.service_fee} />
                {order.discount_amount > 0 && (
                    <PriceRow
                        label="Discount"
                        amount={-order.discount_amount}
                        accent
                    />
                )}
                {order.tip_amount > 0 && (
                    <PriceRow label="Rider tip" amount={order.tip_amount} />
                )}
                <div className="flex justify-between border-t pt-3 text-base font-semibold">
                    <span>Total</span>
                    <span>{money.format(order.total_amount)}</span>
                </div>
                <div className="space-y-1 border-t pt-3 text-xs">
                    <p className="flex justify-between gap-3">
                        <span className="text-muted-foreground">Payment</span>
                        <span className="uppercase">
                            {order.payment_method}
                        </span>
                    </p>
                    <p className="flex justify-between gap-3">
                        <span className="text-muted-foreground">Status</span>
                        <span className="capitalize">
                            {order.payment?.status.replaceAll('_', ' ') ?? '—'}
                        </span>
                    </p>
                    {(order.payment?.refunded_amount ?? 0) > 0 && (
                        <p className="flex justify-between gap-3 text-emerald-700">
                            <span>Refunded</span>
                            <span>
                                {money.format(
                                    order.payment?.refunded_amount ?? 0,
                                )}
                            </span>
                        </p>
                    )}
                    {order.payment?.transaction_reference && (
                        <p className="text-muted-foreground pt-1 break-all">
                            Ref: {order.payment.transaction_reference}
                        </p>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

function PriceRow({
    label,
    amount,
    accent = false,
}: {
    label: string;
    amount: number;
    accent?: boolean;
}) {
    return (
        <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">{label}</span>
            <span className={accent ? 'text-emerald-700' : undefined}>
                {amount < 0 ? '−' : ''}
                {money.format(Math.abs(amount))}
            </span>
        </div>
    );
}

function DeliveryDetails({ order }: { order: OrderDetail }) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Delivery details</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-5 md:grid-cols-2">
                <div className="flex gap-3">
                    <MapPin className="text-muted-foreground mt-0.5 size-5 shrink-0" />
                    <div>
                        <p className="font-medium">
                            {order.delivery_address.label}
                        </p>
                        <p className="text-muted-foreground text-sm">
                            {order.delivery_address.address_line}
                        </p>
                        {order.delivery_address.landmark && (
                            <p className="text-muted-foreground text-xs">
                                Landmark: {order.delivery_address.landmark}
                            </p>
                        )}
                        {order.delivery_address.delivery_instructions && (
                            <p className="mt-2 text-sm">
                                {order.delivery_address.delivery_instructions}
                            </p>
                        )}
                    </div>
                </div>
                <div>
                    <p className="font-medium">Customer notes</p>
                    <p className="text-muted-foreground mt-1 text-sm">
                        {order.customer_notes || 'No additional notes.'}
                    </p>
                </div>
            </CardContent>
        </Card>
    );
}

function ReviewForm({ order }: { order: OrderDetail }) {
    const form = useForm<{
        restaurant_rating: number;
        rider_rating: number | null;
        comment: string;
        photo: File | null;
    }>({
        restaurant_rating: 0,
        rider_rating: order.rider ? 0 : null,
        comment: '',
        photo: null,
    });

    const submit = (event: FormEvent) => {
        event.preventDefault();
        form.post(`/customer/orders/${order.id}/review`, {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => toast.success('Thank you for your review.'),
        });
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Rate this order</CardTitle>
                <CardDescription>
                    Rate the food and delivery separately.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={submit} className="space-y-5">
                    <div>
                        <Label>Restaurant and food</Label>
                        <StarPicker
                            value={form.data.restaurant_rating}
                            onChange={(value) =>
                                form.setData('restaurant_rating', value)
                            }
                        />
                        <InputError message={form.errors.restaurant_rating} />
                    </div>
                    {order.rider && (
                        <div>
                            <Label>Rider and delivery</Label>
                            <StarPicker
                                value={form.data.rider_rating ?? 0}
                                onChange={(value) =>
                                    form.setData('rider_rating', value)
                                }
                            />
                            <InputError message={form.errors.rider_rating} />
                        </div>
                    )}
                    <div className="space-y-2">
                        <Label htmlFor="review-comment">
                            Restaurant comment (optional)
                        </Label>
                        <textarea
                            id="review-comment"
                            className="border-input bg-background min-h-24 w-full rounded-md border px-3 py-2 text-sm"
                            value={form.data.comment}
                            onChange={(event) =>
                                form.setData('comment', event.target.value)
                            }
                            maxLength={2000}
                        />
                        <InputError message={form.errors.comment} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="review-photo">
                            Food photo (optional, up to 5 MB)
                        </Label>
                        <Input
                            id="review-photo"
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            onChange={(event) =>
                                form.setData(
                                    'photo',
                                    event.target.files?.[0] ?? null,
                                )
                            }
                        />
                        <InputError message={form.errors.photo} />
                    </div>
                    <Button
                        type="submit"
                        disabled={
                            form.processing ||
                            form.data.restaurant_rating === 0 ||
                            (order.rider !== null &&
                                (form.data.rider_rating ?? 0) === 0)
                        }
                    >
                        {form.processing && (
                            <LoaderCircle className="animate-spin" />
                        )}
                        Submit review
                    </Button>
                </form>
            </CardContent>
        </Card>
    );
}

function StarPicker({
    value,
    onChange,
}: {
    value: number;
    onChange: (value: number) => void;
}) {
    return (
        <div className="mt-2 flex gap-1" role="radiogroup" aria-label="Rating">
            {[1, 2, 3, 4, 5].map((star) => (
                <button
                    key={star}
                    type="button"
                    role="radio"
                    aria-checked={value === star}
                    aria-label={`${star} stars`}
                    onClick={() => onChange(star)}
                    className="rounded p-1 focus-visible:ring-2 focus-visible:outline-none"
                >
                    <Star
                        className={`size-7 ${
                            star <= value
                                ? 'fill-amber-400 text-amber-400'
                                : 'text-muted-foreground/40'
                        }`}
                    />
                </button>
            ))}
        </div>
    );
}

function SubmittedReviewCard({
    review,
    hasRider,
}: {
    review: SubmittedReview;
    hasRider: boolean;
}) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Your rating</CardTitle>
                <CardDescription>
                    Your submitted review is read-only.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <ReadOnlyStars
                    label="Restaurant and food"
                    value={review.restaurant_rating}
                />
                {hasRider && review.rider_rating && (
                    <ReadOnlyStars
                        label="Rider and delivery"
                        value={review.rider_rating}
                    />
                )}
                {review.restaurant_comment && (
                    <p className="text-sm">{review.restaurant_comment}</p>
                )}
                {review.restaurant_photo_url && (
                    <img
                        src={review.restaurant_photo_url}
                        alt="Customer review"
                        className="max-h-72 rounded-lg object-cover"
                    />
                )}
            </CardContent>
        </Card>
    );
}

function ReadOnlyStars({ label, value }: { label: string; value: number }) {
    return (
        <div>
            <p className="text-sm font-medium">{label}</p>
            <div
                className="mt-1 flex gap-1"
                aria-label={`${value} out of 5 stars`}
            >
                {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                        key={star}
                        className={`size-5 ${
                            star <= value
                                ? 'fill-amber-400 text-amber-400'
                                : 'text-muted-foreground/30'
                        }`}
                    />
                ))}
            </div>
        </div>
    );
}

function ReportProblemDialog({ orderId }: { orderId: number }) {
    const [open, setOpen] = useState(false);
    const form = useForm({
        type: 'missing_item',
        description: '',
    });

    const submit = (event: FormEvent) => {
        event.preventDefault();
        form.post(`/customer/orders/${orderId}/reports`, {
            preserveScroll: true,
            onSuccess: () => {
                setOpen(false);
                form.reset();
                toast.success('Your report was submitted.');
            },
        });
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline">
                    <TriangleAlert /> Report a problem
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Report a problem</DialogTitle>
                    <DialogDescription>
                        Give the admin team enough detail to investigate this
                        order.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={submit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="report-type">Problem type</Label>
                        <select
                            id="report-type"
                            value={form.data.type}
                            onChange={(event) =>
                                form.setData('type', event.target.value)
                            }
                            className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm"
                        >
                            <option value="missing_item">Missing item</option>
                            <option value="wrong_item">Wrong item</option>
                            <option value="late_delivery">Late delivery</option>
                            <option value="rude_behavior">Rude behavior</option>
                            <option value="other">Other</option>
                        </select>
                        <InputError message={form.errors.type} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="report-description">Description</Label>
                        <textarea
                            id="report-description"
                            required
                            maxLength={2000}
                            value={form.data.description}
                            onChange={(event) =>
                                form.setData('description', event.target.value)
                            }
                            className="border-input bg-background min-h-28 w-full rounded-md border px-3 py-2 text-sm"
                        />
                        <InputError message={form.errors.description} />
                    </div>
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button type="button" variant="outline">
                                Cancel
                            </Button>
                        </DialogClose>
                        <Button type="submit" disabled={form.processing}>
                            {form.processing && (
                                <LoaderCircle className="animate-spin" />
                            )}
                            Submit report
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
