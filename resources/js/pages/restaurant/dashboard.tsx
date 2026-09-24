import { Head, Link } from '@inertiajs/react';
import { Clock3, PhilippinePeso, ShoppingBag, Timer } from 'lucide-react';
import OrderStatusBadge, {
    type OrderStatus,
} from '@/components/admin/order-status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
    payment_method: 'cod' | 'gcash' | 'card';
    placed_at: string;
    items_count: number;
    customer: { user: { name: string } } | null;
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
    const prepValue =
        stats.prep_time.actual_minutes === null
            ? `${stats.prep_time.estimated_minutes} min`
            : `${stats.prep_time.actual_minutes} min`;
    const prepDetail =
        stats.prep_time.actual_minutes === null
            ? `Estimated; actual shown after 3 completed preparations`
            : `Estimated ${stats.prep_time.estimated_minutes} min · ${stats.prep_time.sample_size} samples`;

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
                    </div>
                    <Button asChild>
                        <Link href="/restaurant/orders/active">
                            View active orders
                        </Link>
                    </Button>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <StatCard
                        title="Orders today"
                        value={stats.orders_today}
                        icon={ShoppingBag}
                    />
                    <StatCard
                        title="Revenue today"
                        value={currency.format(Number(stats.revenue_today))}
                        icon={PhilippinePeso}
                    />
                    <StatCard
                        title="Awaiting decision"
                        value={stats.pending_orders}
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
                        {recentOrders.length === 0 ? (
                            <p className="text-muted-foreground py-8 text-center text-sm">
                                No orders yet.
                            </p>
                        ) : (
                            <div className="divide-y">
                                {recentOrders.map((order) => (
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
                                                · {order.items_count}{' '}
                                                {order.items_count === 1
                                                    ? 'item'
                                                    : 'items'}{' '}
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
