import { Head, Link, usePage } from '@inertiajs/react';
import { useConnectionStatus, useEcho } from '@laravel/echo-react';
import {
    BellRing,
    Clock3,
    PhilippinePeso,
    ShoppingBag,
    Timer,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import OrderStatusBadge, {
    type OrderStatus,
} from '@/components/admin/order-status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { playNewOrderSound } from '@/lib/notification-sound';
import type { LucideIcon } from 'lucide-react';

type Stats = {
    orders_today: number;
    revenue_today: number;
    pending_orders: number;
    prep_time: {
        sample_size: number;
        actual_minutes: number | null;
        estimated_minutes: number;
    };
};

type RecentOrder = {
    id: number;
    order_number: string;
    status: OrderStatus;
    total_amount: string;
    payment_method?: 'cod' | 'gcash' | 'card';
    placed_at: string;
    items_count: number | null;
    customer: { user: { name: string } } | null;
};

type OrderPlacedPayload = {
    id: number;
    order_number: string;
    restaurant_id: number;
    customer_name: string;
    total_amount: string;
    placed_at: string;
};

const currency = new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
});

function StatCard({
    title,
    value,
    detail,
    icon: Icon,
}: {
    title: string;
    value: string | number;
    detail?: string;
    icon: LucideIcon;
}) {
    return (
        <Card>
            <CardContent className="flex items-start justify-between gap-4 pt-6">
                <div>
                    <p className="text-muted-foreground text-sm">{title}</p>
                    <p className="mt-1 text-2xl font-semibold tabular-nums">
                        {value}
                    </p>
                    {detail && (
                        <p className="text-muted-foreground mt-1 text-xs">
                            {detail}
                        </p>
                    )}
                </div>
                <div className="bg-muted rounded-lg p-3">
                    <Icon className="size-5" />
                </div>
            </CardContent>
        </Card>
    );
}

export default function RestaurantDashboard({
    stats,
    recentOrders,
}: {
    stats: Stats;
    recentOrders: RecentOrder[];
}) {
    const restaurantId = usePage().props.restaurantContext?.id ?? 0;
    const connectionStatus = useConnectionStatus();
    const [dashboardStats, setDashboardStats] = useState(stats);
    const [visibleOrders, setVisibleOrders] = useState(recentOrders);
    const [latestOrder, setLatestOrder] = useState<OrderPlacedPayload | null>(
        null,
    );
    const knownOrderIds = useRef(
        new Set(recentOrders.map((order) => order.id)),
    );
    const alertTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEcho<OrderPlacedPayload>(
        `restaurant.${restaurantId}.orders`,
        '.order.placed',
        (order) => {
            if (
                order.restaurant_id !== restaurantId ||
                knownOrderIds.current.has(order.id)
            ) {
                return;
            }

            knownOrderIds.current.add(order.id);
            const realtimeOrder: RecentOrder = {
                id: order.id,
                order_number: order.order_number,
                status: 'placed',
                total_amount: order.total_amount,
                placed_at: order.placed_at,
                items_count: null,
                customer: { user: { name: order.customer_name } },
            };

            setVisibleOrders((current) =>
                [realtimeOrder, ...current].slice(0, 8),
            );
            setDashboardStats((current) => ({
                ...current,
                orders_today:
                    new Date(order.placed_at).toDateString() ===
                    new Date().toDateString()
                        ? current.orders_today + 1
                        : current.orders_today,
                pending_orders: current.pending_orders + 1,
            }));
            setLatestOrder(order);
            toast.success(`New order ${order.order_number}!`, {
                description: `${order.customer_name} · ${currency.format(Number(order.total_amount))}`,
            });
            void playNewOrderSound();

            if (alertTimer.current !== null) {
                clearTimeout(alertTimer.current);
            }

            alertTimer.current = setTimeout(() => setLatestOrder(null), 15000);
        },
        [restaurantId],
    );

    useEffect(
        () => () => {
            if (alertTimer.current !== null) {
                clearTimeout(alertTimer.current);
            }
        },
        [],
    );

    const prepValue =
        dashboardStats.prep_time.actual_minutes === null
            ? `${dashboardStats.prep_time.estimated_minutes} min`
            : `${dashboardStats.prep_time.actual_minutes} min`;
    const prepDetail =
        dashboardStats.prep_time.actual_minutes === null
            ? 'Estimated; actual shown after 3 completed preparations'
            : `Estimated ${dashboardStats.prep_time.estimated_minutes} min · ${dashboardStats.prep_time.sample_size} samples`;

    return (
        <>
            <Head title="Restaurant dashboard" />
            <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
                    <div>
                        <h2 className="text-2xl font-semibold tracking-tight">
                            Dashboard
                        </h2>
                        <p className="text-muted-foreground text-sm">
                            Today&apos;s orders, earnings, and kitchen
                            performance.
                        </p>
                        <p className="text-muted-foreground mt-1 flex items-center gap-1.5 text-xs">
                            <span
                                className={`size-2 rounded-full ${
                                    connectionStatus === 'connected'
                                        ? 'bg-emerald-500'
                                        : connectionStatus === 'failed'
                                          ? 'bg-red-500'
                                          : 'bg-amber-500'
                                }`}
                            />
                            Live alerts: {connectionStatus}
                        </p>
                    </div>
                    <Button asChild>
                        <Link href="/restaurant/orders/active">
                            View active orders
                        </Link>
                    </Button>
                </div>

                {latestOrder && (
                    <div
                        role="status"
                        className="flex flex-col justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-950 sm:flex-row sm:items-center dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
                    >
                        <div className="flex items-start gap-3">
                            <BellRing className="mt-0.5 size-5 shrink-0" />
                            <div>
                                <p className="font-semibold">
                                    New order {latestOrder.order_number}!
                                </p>
                                <p className="text-sm opacity-80">
                                    {latestOrder.customer_name} ·{' '}
                                    {currency.format(
                                        Number(latestOrder.total_amount),
                                    )}
                                </p>
                            </div>
                        </div>
                        <Button asChild size="sm">
                            <Link href="/restaurant/orders/active">
                                Review order
                            </Link>
                        </Button>
                    </div>
                )}

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <StatCard
                        title="Orders today"
                        value={dashboardStats.orders_today}
                        icon={ShoppingBag}
                    />
                    <StatCard
                        title="Revenue today"
                        value={currency.format(
                            Number(dashboardStats.revenue_today),
                        )}
                        icon={PhilippinePeso}
                    />
                    <StatCard
                        title="Awaiting decision"
                        value={dashboardStats.pending_orders}
                        detail="Placed orders needing accept or reject"
                        icon={Clock3}
                    />
                    <StatCard
                        title="Average prep time"
                        value={prepValue}
                        detail={prepDetail}
                        icon={Timer}
                    />
                </div>

                <Card>
                    <CardHeader className="flex-row items-center justify-between">
                        <CardTitle>Recent orders</CardTitle>
                        <Button variant="outline" size="sm" asChild>
                            <Link href="/restaurant/orders/history">
                                Order history
                            </Link>
                        </Button>
                    </CardHeader>
                    <CardContent>
                        {visibleOrders.length === 0 ? (
                            <p className="text-muted-foreground py-8 text-center text-sm">
                                No orders yet.
                            </p>
                        ) : (
                            <div className="divide-y">
                                {visibleOrders.map((order) => (
                                    <div
                                        key={order.id}
                                        className="flex flex-col justify-between gap-3 py-3 sm:flex-row sm:items-center"
                                    >
                                        <div className="min-w-0">
                                            <p className="font-medium">
                                                {order.order_number}
                                            </p>
                                            <p className="text-muted-foreground text-xs">
                                                {order.customer?.user.name ??
                                                    'Customer'}{' '}
                                                ·{' '}
                                                {order.items_count === null
                                                    ? 'Just arrived'
                                                    : `${order.items_count} ${
                                                          order.items_count ===
                                                          1
                                                              ? 'item'
                                                              : 'items'
                                                      }`}{' '}
                                                ·{' '}
                                                {new Date(
                                                    order.placed_at,
                                                ).toLocaleString()}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="font-medium tabular-nums">
                                                {currency.format(
                                                    Number(order.total_amount),
                                                )}
                                            </span>
                                            <OrderStatusBadge
                                                status={order.status}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </>
    );
}

RestaurantDashboard.layout = { title: 'Dashboard' };
