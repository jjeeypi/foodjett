import { Head, Link, router } from '@inertiajs/react';
import { useConnectionStatus, useEcho } from '@laravel/echo-react';
import {
    Bike,
    Check,
    ChefHat,
    Clock3,
    PackageCheck,
    TriangleAlert,
    Utensils,
} from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import OrderTrackingMap, {
    type MapPoint,
    type RiderLocation,
} from '@/components/customer/order-tracking-map';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type OrderStatus =
    | 'placed'
    | 'accepted'
    | 'preparing'
    | 'ready'
    | 'finding_rider'
    | 'rider_assigned'
    | 'at_restaurant'
    | 'picked_up'
    | 'on_the_way'
    | 'arrived'
    | 'delivered'
    | 'rejected_by_restaurant'
    | 'cancelled_by_customer'
    | 'cancelled_by_restaurant'
    | 'cancelled_no_rider'
    | 'cancelled_by_admin'
    | 'failed_delivery';

type Rider = {
    name: string;
    photo_url: string | null;
    vehicle_type: string;
    current_latitude: number | null;
    current_longitude: number | null;
    location_updated_at: string | null;
};

type TrackingOrder = {
    id: number;
    order_number: string;
    restaurant_name: string;
    restaurant_location: MapPoint;
    delivery_location: MapPoint & { address: string };
    status: OrderStatus;
    payment_method: 'cod' | 'gcash' | 'card';
    placed_at: string;
    estimated_ready_at: string | null;
    prep_extended_minutes: number | null;
    rider: Rider | null;
    escalation_stage: string | null;
    cancellation_reason: string | null;
    rejection_reason: string | null;
};

type HistoryEntry = {
    status: OrderStatus;
    note: string | null;
    created_at: string | null;
};

type StatusUpdate = {
    event_id: string;
    id: number;
    order_number: string;
    status: OrderStatus;
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
    {
        status: 'placed' as const,
        label: 'Order placed',
        description: 'Your order was sent to the restaurant.',
    },
    {
        status: 'accepted' as const,
        label: 'Accepted',
        description: 'The restaurant accepted your order.',
    },
    {
        status: 'preparing' as const,
        label: 'Preparing',
        description: 'The kitchen is preparing your food.',
    },
    {
        status: 'finding_rider' as const,
        label: 'Finding a rider',
        description: 'We are matching your order with a rider.',
    },
    {
        status: 'rider_assigned' as const,
        label: 'Rider assigned',
        description: 'A rider is heading to the restaurant.',
    },
    {
        status: 'picked_up' as const,
        label: 'Picked up',
        description: 'Your rider has collected the order.',
    },
    {
        status: 'on_the_way' as const,
        label: 'On the way',
        description: 'Your order is on its way to you.',
    },
    {
        status: 'delivered' as const,
        label: 'Delivered',
        description: 'Your order has arrived.',
    },
];

const statusRank: Record<OrderStatus, number> = {
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

const terminalLabels: Partial<Record<OrderStatus, string>> = {
    rejected_by_restaurant: 'Rejected by restaurant',
    cancelled_by_customer: 'Cancelled by you',
    cancelled_by_restaurant: 'Cancelled by restaurant',
    cancelled_no_rider: 'Cancelled because no rider was available',
    cancelled_by_admin: 'Cancelled by an administrator',
    failed_delivery: 'Delivery failed',
};

const mapStatuses = new Set<OrderStatus>([
    'rider_assigned',
    'at_restaurant',
    'picked_up',
    'on_the_way',
    'arrived',
    'delivered',
]);

const dateTime = new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
});

function initialNotice(order: TrackingOrder): StatusUpdate['notice'] {
    if (
        order.status === 'finding_rider' &&
        order.escalation_stage === 'customer_notified'
    ) {
        return 'rider_search_delayed';
    }

    if (
        ['accepted', 'preparing', 'ready'].includes(order.status) &&
        (order.prep_extended_minutes ?? 0) > 0
    ) {
        return 'prep_extended';
    }

    return null;
}

function initials(name: string): string {
    return name
        .split(' ')
        .map((part) => part[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();
}

function initialRiderLocation(order: TrackingOrder): RiderLocation | null {
    const rider = order.rider;

    if (
        rider?.current_latitude === null ||
        rider?.current_latitude === undefined ||
        rider.current_longitude === null ||
        rider.current_longitude === undefined ||
        rider.location_updated_at === null
    ) {
        return null;
    }

    return {
        latitude: rider.current_latitude,
        longitude: rider.current_longitude,
        timestamp: rider.location_updated_at,
    };
}

export default function TrackOrder({
    order,
    history,
}: {
    order: TrackingOrder;
    history: HistoryEntry[];
}) {
    const connectionStatus = useConnectionStatus();
    const [tracking, setTracking] = useState(order);
    const [timeline, setTimeline] = useState(history);
    const [notice, setNotice] = useState<StatusUpdate['notice']>(() =>
        initialNotice(order),
    );
    const [cancelling, setCancelling] = useState(false);
    const [riderLocation, setRiderLocation] = useState<RiderLocation | null>(
        () => initialRiderLocation(order),
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
            if (
                update.rider?.current_latitude !== null &&
                update.rider?.current_latitude !== undefined &&
                update.rider.current_longitude !== null &&
                update.rider.current_longitude !== undefined &&
                update.rider.location_updated_at !== null
            ) {
                setRiderLocation({
                    latitude: update.rider.current_latitude,
                    longitude: update.rider.current_longitude,
                    timestamp: update.rider.location_updated_at,
                });
            }
            setTracking((current) => ({
                ...current,
                status: update.status,
                estimated_ready_at: update.estimated_ready_at,
                prep_extended_minutes: update.prep_extended_minutes,
                rider: update.rider ?? current.rider,
                escalation_stage: update.escalation_stage,
                cancellation_reason: update.cancellation_reason,
                rejection_reason: update.rejection_reason,
            }));
            setTimeline((current) => [
                ...current,
                {
                    status: update.status,
                    note: null,
                    created_at: update.updated_at,
                },
            ]);

            if (update.notice !== null) {
                setNotice(update.notice);
            } else if (
                update.status !== 'finding_rider' &&
                update.status !== 'accepted' &&
                update.status !== 'preparing' &&
                update.status !== 'ready'
            ) {
                setNotice(null);
            }

            toast.info(`Order ${update.order_number} updated`, {
                description:
                    terminalLabels[update.status] ??
                    steps[statusRank[update.status]]?.label ??
                    update.status.replaceAll('_', ' '),
            });
        },
        [order.id],
    );

    useEcho<LocationUpdate>(
        `order.${order.id}.status`,
        '.rider.location.updated',
        (update) => {
            if (update.order_id !== order.id) {
                return;
            }

            setRiderLocation({
                latitude: update.latitude,
                longitude: update.longitude,
                timestamp: update.timestamp,
            });
        },
        [order.id],
    );

    const terminalLabel = terminalLabels[tracking.status];
    const rank = statusRank[tracking.status];
    const canCancel =
        tracking.status === 'finding_rider' &&
        tracking.escalation_stage === 'customer_notified';

    const cancelOrder = () => {
        router.patch(
            `/customer/orders/${tracking.id}/cancel`,
            {},
            {
                preserveScroll: true,
                onStart: () => setCancelling(true),
                onSuccess: () => {
                    setTracking((current) => ({
                        ...current,
                        status: 'cancelled_by_customer',
                        cancellation_reason:
                            'Customer cancelled because a rider could not be found in time.',
                    }));
                    setNotice(null);
                    toast.success('Order cancelled.');
                },
                onFinish: () => setCancelling(false),
                onError: (errors) =>
                    toast.error(
                        typeof errors.order === 'string'
                            ? errors.order
                            : 'The order could not be cancelled.',
                    ),
            },
        );
    };

    return (
        <>
            <Head title={`Track ${tracking.order_number}`} />
            <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 p-4 md:p-6">
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
                    <div>
                        <p className="text-muted-foreground text-sm">
                            {tracking.restaurant_name}
                        </p>
                        <h1 className="text-2xl font-semibold tracking-tight">
                            {tracking.order_number}
                        </h1>
                        <p className="text-muted-foreground mt-1 text-xs">
                            Placed{' '}
                            {dateTime.format(new Date(tracking.placed_at))}
                        </p>
                    </div>
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
                </div>

                {notice === 'prep_extended' && (
                    <div className="flex gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
                        <Clock3 className="mt-0.5 size-5 shrink-0" />
                        <div>
                            <p className="font-medium">
                                The restaurant needs a few more minutes.
                            </p>
                            {tracking.estimated_ready_at && (
                                <p className="mt-1 text-sm opacity-80">
                                    Updated estimate:{' '}
                                    {dateTime.format(
                                        new Date(tracking.estimated_ready_at),
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
                                We&apos;re having trouble finding a rider
                                &mdash; keep waiting or cancel for a full
                                refund?
                            </p>
                        </div>
                        {canCancel && (
                            <Button
                                variant="outline"
                                onClick={cancelOrder}
                                disabled={cancelling}
                                className="border-amber-500 bg-transparent"
                            >
                                {cancelling ? 'Cancelling...' : 'Cancel order'}
                            </Button>
                        )}
                    </div>
                )}

                {terminalLabel && (
                    <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-red-950 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100">
                        <p className="font-semibold">{terminalLabel}</p>
                        {(tracking.cancellation_reason ||
                            tracking.rejection_reason) && (
                            <p className="mt-1 text-sm opacity-80">
                                {tracking.cancellation_reason ??
                                    tracking.rejection_reason}
                            </p>
                        )}
                    </div>
                )}

                {mapStatuses.has(tracking.status) && (
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
                                restaurant={tracking.restaurant_location}
                                delivery={tracking.delivery_location}
                                rider={riderLocation}
                            />
                            <p className="text-muted-foreground mt-3 text-xs">
                                The dashed line is a straight-line guide, not a
                                road route or arrival-time estimate.
                            </p>
                        </CardContent>
                    </Card>
                )}

                <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
                    <Card>
                        <CardHeader>
                            <CardTitle>Order progress</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ol className="space-y-0">
                                {steps.map((step, index) => {
                                    const completed = rank > index;
                                    const active = rank === index;
                                    const historyEntry = timeline.find(
                                        (entry) =>
                                            statusRank[entry.status] === index,
                                    );

                                    return (
                                        <li
                                            key={step.status}
                                            className="relative flex gap-4 pb-7 last:pb-0"
                                        >
                                            {index < steps.length - 1 && (
                                                <span
                                                    className={`absolute top-8 bottom-0 left-[15px] w-px ${
                                                        completed
                                                            ? 'bg-emerald-500'
                                                            : 'bg-border'
                                                    }`}
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
                                                    {step.label}
                                                </p>
                                                <p className="text-muted-foreground mt-0.5 text-sm">
                                                    {step.description}
                                                </p>
                                                {historyEntry?.created_at && (
                                                    <p className="text-muted-foreground mt-1 text-xs">
                                                        {dateTime.format(
                                                            new Date(
                                                                historyEntry.created_at,
                                                            ),
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

                    <div className="space-y-4">
                        {tracking.estimated_ready_at && (
                            <Card>
                                <CardContent className="flex gap-3 pt-6">
                                    <Clock3 className="text-muted-foreground size-5 shrink-0" />
                                    <div>
                                        <p className="font-medium">
                                            Estimated ready time
                                        </p>
                                        <p className="text-muted-foreground mt-1 text-sm">
                                            {dateTime.format(
                                                new Date(
                                                    tracking.estimated_ready_at,
                                                ),
                                            )}
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {tracking.rider && (
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-base">
                                        Your rider
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="flex items-center gap-3">
                                    <Avatar className="size-11">
                                        {tracking.rider.photo_url && (
                                            <AvatarImage
                                                src={tracking.rider.photo_url}
                                                alt={tracking.rider.name}
                                            />
                                        )}
                                        <AvatarFallback>
                                            {initials(tracking.rider.name)}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <p className="font-medium">
                                            {tracking.rider.name}
                                        </p>
                                        <p className="text-muted-foreground text-sm capitalize">
                                            {tracking.rider.vehicle_type.replaceAll(
                                                '_',
                                                ' ',
                                            )}
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        <Card>
                            <CardContent className="space-y-3 pt-6">
                                <div className="flex gap-3">
                                    <Utensils className="text-muted-foreground size-5 shrink-0" />
                                    <div>
                                        <p className="font-medium">
                                            {tracking.restaurant_name}
                                        </p>
                                        <p className="text-muted-foreground text-sm capitalize">
                                            {tracking.payment_method}
                                        </p>
                                    </div>
                                </div>
                                <Button
                                    variant="outline"
                                    className="w-full"
                                    asChild
                                >
                                    <Link href="/customer/dashboard">
                                        Browse restaurants
                                    </Link>
                                </Button>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </>
    );
}
