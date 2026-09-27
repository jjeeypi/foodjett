import { Head, router } from '@inertiajs/react';
import { useConnectionStatus, useEchoPublic } from '@laravel/echo-react';
import {
    Banknote,
    Bike,
    Clock3,
    MapPin,
    Navigation,
    Radio,
    TriangleAlert,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import RiderLocationTracker from '@/components/rider/rider-location-tracker';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { playNewOrderSound } from '@/lib/notification-sound';

type Location = {
    latitude: number;
    longitude: number;
};

type PoolOrder = {
    id: number;
    order_number: string;
    payment_method: 'cod' | 'gcash' | 'card';
    restaurant: Location & { name: string; address: string };
    delivery_address: (Location & { address_line: string }) | null;
    pickup_distance_km: number;
    delivery_distance_km: number;
    search_radius_km: number;
    base_pay: number;
    distance_pay: number;
    incentive_amount: number;
    estimated_pay: number;
    estimated_ready_at: string | null;
    accept_block_reason: string | null;
};

type AvailableOrderEvent = Omit<
    PoolOrder,
    'pickup_distance_km' | 'delivery_address' | 'accept_block_reason'
> & { event_id: string };

type ActiveOrder = {
    id: number;
    order_number: string;
    status: string;
    payment_method: 'cod' | 'gcash' | 'card';
    total_amount: string;
    restaurant: { name: string; address: string };
    delivery_address: { address_line: string };
};

type RiderContext = {
    cash_on_hand: number;
    cash_remit_limit: number;
    current_latitude: number | null;
    current_longitude: number | null;
    last_location_at: string | null;
};

const currency = new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
});

const dateTime = new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
});

function distanceInKilometres(from: Location, to: Location): number {
    const earthRadius = 6371;
    const latitudeDelta = ((to.latitude - from.latitude) * Math.PI) / 180;
    const longitudeDelta = ((to.longitude - from.longitude) * Math.PI) / 180;
    const fromLatitude = (from.latitude * Math.PI) / 180;
    const toLatitude = (to.latitude * Math.PI) / 180;
    const a =
        Math.sin(latitudeDelta / 2) ** 2 +
        Math.cos(fromLatitude) *
            Math.cos(toLatitude) *
            Math.sin(longitudeDelta / 2) ** 2;

    return (
        Math.round(
            earthRadius * 2 * Math.asin(Math.min(1, Math.sqrt(a))) * 100,
        ) / 100
    );
}

export default function RiderOrderPool({
    rider,
    poolOrders,
    activeOrders,
    hasActiveOrder,
    blockedCodOrders,
}: {
    rider: RiderContext;
    poolOrders: PoolOrder[];
    activeOrders: ActiveOrder[];
    hasActiveOrder: boolean;
    blockedCodOrders: number;
}) {
    const connectionStatus = useConnectionStatus();
    const [orders, setOrders] = useState(poolOrders);
    const ordersRef = useRef(poolOrders);
    const [highlightedIds, setHighlightedIds] = useState<Set<number>>(
        new Set(),
    );
    const [acceptingOrderId, setAcceptingOrderId] = useState<number | null>(
        null,
    );
    const [cashCollected, setCashCollected] = useState<Record<number, boolean>>(
        {},
    );
    const [failureReasons, setFailureReasons] = useState<
        Record<number, string>
    >({});
    const processedEvents = useRef(new Set<string>());
    const acceptingOrderIdRef = useRef<number | null>(null);
    const highlightTimers = useRef(
        new Map<number, ReturnType<typeof setTimeout>>(),
    );
    const hasConnected = useRef(false);

    useEffect(() => {
        ordersRef.current = poolOrders;
        setOrders(poolOrders);
    }, [poolOrders]);

    useEffect(() => {
        if (connectionStatus !== 'connected') {
            return;
        }

        if (hasConnected.current) {
            router.reload({
                only: [
                    'poolOrders',
                    'activeOrders',
                    'hasActiveOrder',
                    'blockedCodOrders',
                ],
            });
        } else {
            hasConnected.current = true;
        }
    }, [connectionStatus]);

    useEffect(
        () => () => {
            highlightTimers.current.forEach((timer) => clearTimeout(timer));
        },
        [],
    );

    useEchoPublic<AvailableOrderEvent>(
        'orders.pool',
        '.order.pool.available',
        (available) => {
            if (
                processedEvents.current.has(available.event_id) ||
                rider.current_latitude === null ||
                rider.current_longitude === null
            ) {
                return;
            }

            processedEvents.current.add(available.event_id);
            const pickupDistance = distanceInKilometres(
                {
                    latitude: rider.current_latitude,
                    longitude: rider.current_longitude,
                },
                available.restaurant,
            );

            if (pickupDistance > available.search_radius_km) {
                return;
            }

            const codBlocked =
                available.payment_method === 'cod' &&
                rider.cash_on_hand >= rider.cash_remit_limit;
            const order: PoolOrder = {
                ...available,
                delivery_address: null,
                pickup_distance_km: pickupDistance,
                accept_block_reason: hasActiveOrder
                    ? 'Finish your active delivery before accepting another order.'
                    : codBlocked
                      ? 'Cash remit limit reached. Remit cash before accepting this COD order.'
                      : null,
            };

            setOrders((current) => {
                const next = [
                    order,
                    ...current.filter((item) => item.id !== order.id),
                ];
                ordersRef.current = next;

                return next;
            });
            setHighlightedIds((current) => new Set(current).add(order.id));
            const existingTimer = highlightTimers.current.get(order.id);
            if (existingTimer) {
                clearTimeout(existingTimer);
            }
            highlightTimers.current.set(
                order.id,
                setTimeout(() => {
                    setHighlightedIds((current) => {
                        const next = new Set(current);
                        next.delete(order.id);

                        return next;
                    });
                    highlightTimers.current.delete(order.id);
                }, 5000),
            );

            void playNewOrderSound();
            toast.info(`New delivery ${order.order_number}`, {
                description: `${order.restaurant.name} · ${currency.format(order.estimated_pay)}`,
            });
        },
        [
            hasActiveOrder,
            rider.cash_on_hand,
            rider.cash_remit_limit,
            rider.current_latitude,
            rider.current_longitude,
        ],
    );

    useEchoPublic<{ id: number }>(
        'orders.pool',
        '.order.pool.taken',
        ({ id }) => {
            const wasVisible = ordersRef.current.some(
                (order) => order.id === id,
            );
            const remaining = ordersRef.current.filter(
                (order) => order.id !== id,
            );
            ordersRef.current = remaining;
            setOrders(remaining);

            if (wasVisible && acceptingOrderIdRef.current !== id) {
                toast.warning('This order is no longer available.');
            }
        },
        [],
    );

    const acceptOrder = (order: PoolOrder) => {
        acceptingOrderIdRef.current = order.id;
        setAcceptingOrderId(order.id);

        router.post(
            `/rider/orders/${order.id}/accept`,
            {},
            {
                preserveScroll: true,
                onError: (errors) => {
                    const message =
                        typeof errors.order === 'string'
                            ? errors.order
                            : 'This order could not be accepted.';
                    if (message.includes('just taken')) {
                        setOrders((current) => {
                            const remaining = current.filter(
                                (item) => item.id !== order.id,
                            );
                            ordersRef.current = remaining;

                            return remaining;
                        });
                    }
                    toast.error(message);
                },
                onFinish: () => {
                    acceptingOrderIdRef.current = null;
                    setAcceptingOrderId(null);
                },
            },
        );
    };

    const missingLocation =
        rider.current_latitude === null || rider.current_longitude === null;

    return (
        <>
            <Head title="Rider order pool" />
            <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
                    <div>
                        <h1 className="text-2xl font-semibold tracking-tight">
                            Delivery order pool
                        </h1>
                        <p className="text-muted-foreground mt-1 text-sm">
                            Cash on hand: {currency.format(rider.cash_on_hand)}{' '}
                            / {currency.format(rider.cash_remit_limit)} remit
                            limit
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
                        Live pool: {connectionStatus}
                    </div>
                </div>

                {missingLocation && (
                    <Alert variant="destructive">
                        <MapPin />
                        <AlertTitle>Current location required</AlertTitle>
                        <AlertDescription>
                            Update your rider location before viewing or
                            accepting nearby orders.
                        </AlertDescription>
                    </Alert>
                )}

                {hasActiveOrder && (
                    <Alert>
                        <Bike />
                        <AlertTitle>One delivery at a time</AlertTitle>
                        <AlertDescription>
                            Available orders remain visible, but acceptance is
                            paused until your active delivery is complete.
                        </AlertDescription>
                    </Alert>
                )}

                {blockedCodOrders > 0 && !hasActiveOrder && (
                    <Alert variant="destructive">
                        <Banknote />
                        <AlertTitle>COD acceptance paused</AlertTitle>
                        <AlertDescription>
                            You are at or over your cash remit limit. Remit cash
                            before accepting the available COD{' '}
                            {blockedCodOrders === 1 ? 'order' : 'orders'}.
                        </AlertDescription>
                    </Alert>
                )}

                <section className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                        <h2 className="text-lg font-semibold">Nearby orders</h2>
                        <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
                            <Radio className="size-3.5" />
                            {orders.length} available
                        </span>
                    </div>
                    <div className="grid gap-4 lg:grid-cols-2">
                        {orders.map((order) => (
                            <Card
                                key={order.id}
                                className={`transition-all duration-500 ${
                                    highlightedIds.has(order.id)
                                        ? 'ring-2 ring-emerald-500 ring-offset-2'
                                        : ''
                                }`}
                            >
                                <CardHeader>
                                    <CardTitle className="flex justify-between gap-3">
                                        <span>{order.restaurant.name}</span>
                                        <span className="text-sm font-normal uppercase">
                                            {order.payment_method}
                                        </span>
                                    </CardTitle>
                                    <p className="text-muted-foreground text-xs">
                                        {order.order_number}
                                    </p>
                                </CardHeader>
                                <CardContent className="space-y-4 text-sm">
                                    <div className="space-y-2">
                                        <div className="flex gap-2">
                                            <Navigation className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                                            <p>
                                                <span className="font-medium">
                                                    {order.pickup_distance_km.toFixed(
                                                        2,
                                                    )}{' '}
                                                    km pickup
                                                </span>
                                                <span className="text-muted-foreground block">
                                                    {order.restaurant.address}
                                                </span>
                                            </p>
                                        </div>
                                        <div className="flex gap-2">
                                            <MapPin className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                                            <p>
                                                <span className="font-medium">
                                                    {order.delivery_distance_km.toFixed(
                                                        2,
                                                    )}{' '}
                                                    km delivery
                                                </span>
                                                {order.delivery_address && (
                                                    <span className="text-muted-foreground block">
                                                        {
                                                            order
                                                                .delivery_address
                                                                .address_line
                                                        }
                                                    </span>
                                                )}
                                            </p>
                                        </div>
                                        {order.estimated_ready_at && (
                                            <div className="flex gap-2">
                                                <Clock3 className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                                                <p>
                                                    Ready around{' '}
                                                    {dateTime.format(
                                                        new Date(
                                                            order.estimated_ready_at,
                                                        ),
                                                    )}
                                                </p>
                                            </div>
                                        )}
                                    </div>

                                    <div className="bg-muted/60 rounded-lg p-3">
                                        <div className="flex items-center justify-between">
                                            <span className="text-muted-foreground">
                                                Estimated pay
                                            </span>
                                            <strong className="text-base">
                                                {currency.format(
                                                    order.estimated_pay,
                                                )}
                                            </strong>
                                        </div>
                                        <p className="text-muted-foreground mt-1 text-xs">
                                            {currency.format(order.base_pay)}{' '}
                                            base +{' '}
                                            {currency.format(
                                                order.distance_pay,
                                            )}{' '}
                                            distance
                                            {order.incentive_amount > 0 &&
                                                ` + ${currency.format(order.incentive_amount)} incentive`}
                                        </p>
                                    </div>

                                    {order.accept_block_reason && (
                                        <p className="text-destructive flex gap-2 text-xs">
                                            <TriangleAlert className="size-4 shrink-0" />
                                            {order.accept_block_reason}
                                        </p>
                                    )}

                                    <Button
                                        className="w-full"
                                        disabled={
                                            order.accept_block_reason !==
                                                null ||
                                            acceptingOrderId !== null
                                        }
                                        onClick={() => acceptOrder(order)}
                                    >
                                        {acceptingOrderId === order.id
                                            ? 'Accepting...'
                                            : 'Accept order'}
                                    </Button>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                    {orders.length === 0 && (
                        <p className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">
                            {missingLocation
                                ? 'Nearby orders will appear after your location is available.'
                                : 'No orders are currently inside your search area. New orders will appear here automatically.'}
                        </p>
                    )}
                </section>

                <section className="space-y-3">
                    <h2 className="text-lg font-semibold">Active delivery</h2>
                    {activeOrders[0] && (
                        <RiderLocationTracker
                            orderId={activeOrders[0].id}
                            initialStatus={activeOrders[0].status}
                        />
                    )}
                    <div className="grid gap-4 lg:grid-cols-2">
                        {activeOrders.map((order) => (
                            <Card key={order.id}>
                                <CardHeader>
                                    <CardTitle>{order.order_number}</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4 text-sm">
                                    <div>
                                        <p className="font-medium">
                                            {order.restaurant.name}
                                        </p>
                                        <p className="text-muted-foreground">
                                            {
                                                order.delivery_address
                                                    .address_line
                                            }
                                        </p>
                                        <p className="mt-1 uppercase">
                                            {order.payment_method} ·{' '}
                                            {currency.format(
                                                Number(order.total_amount),
                                            )}
                                        </p>
                                    </div>

                                    {order.payment_method === 'cod' && (
                                        <label className="flex items-center gap-2 rounded-md border p-3">
                                            <input
                                                type="checkbox"
                                                checked={
                                                    cashCollected[order.id] ??
                                                    false
                                                }
                                                onChange={(event) =>
                                                    setCashCollected(
                                                        (current) => ({
                                                            ...current,
                                                            [order.id]:
                                                                event.target
                                                                    .checked,
                                                        }),
                                                    )
                                                }
                                            />
                                            Cash collected from customer
                                        </label>
                                    )}

                                    <Button
                                        className="w-full"
                                        onClick={() =>
                                            router.patch(
                                                `/rider/orders/${order.id}/complete`,
                                                {
                                                    outcome: 'delivered',
                                                    cash_collected:
                                                        cashCollected[
                                                            order.id
                                                        ] ?? false,
                                                },
                                            )
                                        }
                                    >
                                        Mark delivered
                                    </Button>

                                    <div className="space-y-2 border-t pt-4">
                                        <Input
                                            placeholder="Why could payment/delivery not be completed?"
                                            value={
                                                failureReasons[order.id] ?? ''
                                            }
                                            onChange={(event) =>
                                                setFailureReasons(
                                                    (current) => ({
                                                        ...current,
                                                        [order.id]:
                                                            event.target.value,
                                                    }),
                                                )
                                            }
                                        />
                                        <Button
                                            variant="destructive"
                                            className="w-full"
                                            disabled={
                                                !(
                                                    failureReasons[order.id] ??
                                                    ''
                                                ).trim()
                                            }
                                            onClick={() =>
                                                router.patch(
                                                    `/rider/orders/${order.id}/complete`,
                                                    {
                                                        outcome:
                                                            'failed_delivery',
                                                        cancellation_reason:
                                                            failureReasons[
                                                                order.id
                                                            ],
                                                    },
                                                )
                                            }
                                        >
                                            Report payment or delivery issue
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                    {activeOrders.length === 0 && (
                        <p className="text-muted-foreground text-sm">
                            You have no active delivery.
                        </p>
                    )}
                </section>
            </div>
        </>
    );
}
