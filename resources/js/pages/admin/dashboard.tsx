import { Head, Link } from '@inertiajs/react';
import {
    AlertTriangle,
    Bike,
    Clock3,
    PhilippinePeso,
    ShieldCheck,
    ShoppingBag,
    Store,
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { LucideIcon } from 'lucide-react';

type Stats = {
    orders_today: number;
    revenue_today: number | string;
    active_restaurants: number;
    active_riders: number;
    pending_approvals: number;
};

type Activity = {
    id: number;
    type: 'restaurant_application' | 'rider_application' | 'order_report';
    title: string;
    detail: string;
    occurred_at: string | null;
    href: string;
};

type Props = {
    stats: Stats;
    unassignedOrdersCount: number;
    recentActivity: Activity[];
};

const currency = new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
});

function StatCard({
    title,
    value,
    icon: Icon,
}: {
    title: string;
    value: string | number;
    icon: LucideIcon;
}) {
    return (
        <Card>
            <CardContent className="flex items-center justify-between gap-4 pt-6">
                <div>
                    <p className="text-muted-foreground text-sm">{title}</p>
                    <p className="mt-1 text-2xl font-semibold tabular-nums">
                        {value}
                    </p>
                </div>
                <div className="bg-muted rounded-lg p-3">
                    <Icon className="size-5" />
                </div>
            </CardContent>
        </Card>
    );
}

export default function AdminDashboard({
    stats,
    unassignedOrdersCount,
    recentActivity,
}: Props) {
    return (
        <>
            <Head title="Admin dashboard" />
            <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
                <div>
                    <h2 className="text-2xl font-semibold tracking-tight">
                        Dashboard
                    </h2>
                    <p className="text-muted-foreground text-sm">
                        Today’s marketplace activity and items needing
                        attention.
                    </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
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
                        title="Active restaurants"
                        value={stats.active_restaurants}
                        icon={Store}
                    />
                    <StatCard
                        title="Active riders"
                        value={stats.active_riders}
                        icon={Bike}
                    />
                    <StatCard
                        title="Pending approvals"
                        value={stats.pending_approvals}
                        icon={ShieldCheck}
                    />
                </div>

                {unassignedOrdersCount > 0 && (
                    <Alert className="border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
                        <AlertTriangle />
                        <AlertTitle>
                            Rider assignment needs attention
                        </AlertTitle>
                        <AlertDescription>
                            <p>
                                {unassignedOrdersCount}{' '}
                                {unassignedOrdersCount === 1
                                    ? 'order has'
                                    : 'orders have'}{' '}
                                reached the admin-alert stage.
                            </p>
                            <Link
                                href="/admin/orders/unassigned"
                                className="font-medium underline underline-offset-4"
                            >
                                Review unassigned orders
                            </Link>
                        </AlertDescription>
                    </Alert>
                )}

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Clock3 className="size-5" />
                            Recent activity
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {recentActivity.length > 0 ? (
                            <div className="divide-y">
                                {recentActivity.map((activity) => (
                                    <Link
                                        key={`${activity.type}-${activity.id}`}
                                        href={activity.href}
                                        className="hover:bg-muted/50 flex items-center justify-between gap-4 py-3 transition-colors"
                                    >
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-medium">
                                                {activity.title}
                                            </p>
                                            <p className="text-muted-foreground text-xs capitalize">
                                                {activity.detail}
                                            </p>
                                        </div>
                                        <time className="text-muted-foreground shrink-0 text-xs">
                                            {activity.occurred_at
                                                ? new Date(
                                                      activity.occurred_at,
                                                  ).toLocaleDateString()
                                                : '—'}
                                        </time>
                                    </Link>
                                ))}
                            </div>
                        ) : (
                            <p className="text-muted-foreground text-sm">
                                No recent applications or order reports.
                            </p>
                        )}
                    </CardContent>
                </Card>
            </div>
        </>
    );
}

AdminDashboard.layout = {
    title: 'Dashboard',
};
