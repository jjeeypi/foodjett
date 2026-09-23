import { Head, Link, router } from '@inertiajs/react';
import {
    ArrowLeft,
    Bike,
    LoaderCircle,
    LocateFixed,
    RefreshCw,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Pagination, type PaginatedData } from '@/components/admin/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

type QueueOrder = {
    id: number;
    order_number: string;
    payment_method: 'cod' | 'gcash' | 'card';
    total_amount: string;
    rider_search_started_at: string | null;
    restaurant: {
        name: string;
        address: string;
        latitude: string;
        longitude: string;
    };
    customer: { user: { name: string } } | null;
    pool_offer: {
        escalation_stage:
            | 'admin_alerted'
            | 'customer_notified'
            | 'auto_cancelled';
        search_radius_km: string;
        incentive_amount: string;
        updated_at: string;
    };
};

type NearbyRider = {
    id: number;
    name: string;
    vehicle_type: string;
    plate_number: string | null;
    distance_km: number;
    cash_on_hand: string;
    cash_remit_limit: string;
};

const currency = new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
});

const elapsedMinutes = (startedAt: string | null, now: number) => {
    if (!startedAt) return 'Start time missing';
    const minutes = Math.max(
        0,
        Math.floor((now - new Date(startedAt).getTime()) / 60_000),
    );
    if (minutes < 60) return `${minutes} min`;
    return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
};

export default function UnassignedOrders({
    orders,
}: {
    orders: PaginatedData<QueueOrder>;
}) {
    const [now, setNow] = useState(Date.now());
    const [selectedOrder, setSelectedOrder] = useState<QueueOrder | null>(null);
    const [riders, setRiders] = useState<NearbyRider[]>([]);
    const [selectedRiderId, setSelectedRiderId] = useState<number | null>(null);
    const [loadingRiders, setLoadingRiders] = useState(false);
    const [assigning, setAssigning] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const clock = window.setInterval(() => setNow(Date.now()), 30_000);
        const poll = window.setInterval(
            () =>
                router.reload({
                    only: ['orders'],
                }),
            20_000,
        );

        return () => {
            window.clearInterval(clock);
            window.clearInterval(poll);
        };
    }, []);

    const closeDialog = () => {
        setSelectedOrder(null);
        setRiders([]);
        setSelectedRiderId(null);
        setError(null);
    };

    const viewRiders = async (order: QueueOrder) => {
        setSelectedOrder(order);
        setRiders([]);
        setSelectedRiderId(null);
        setError(null);
        setLoadingRiders(true);

        try {
            const response = await fetch(
                `/admin/orders/${order.id}/nearby-riders`,
                { headers: { Accept: 'application/json' } },
            );
            if (!response.ok) {
                throw new Error(
                    response.status === 409
                        ? 'This order is no longer waiting for a rider.'
                        : 'Nearby riders could not be loaded.',
                );
            }
            const payload = (await response.json()) as {
                riders: NearbyRider[];
            };
            setRiders(payload.riders);
        } catch (caught) {
            setError(
                caught instanceof Error
                    ? caught.message
                    : 'Nearby riders could not be loaded.',
            );
        } finally {
            setLoadingRiders(false);
        }
    };

    const assignRider = () => {
        if (!selectedOrder || !selectedRiderId) return;
        setAssigning(true);
        setError(null);
        router.patch(
            `/admin/orders/${selectedOrder.id}/assign-rider`,
            { rider_id: selectedRiderId },
            {
                preserveScroll: true,
                onSuccess: closeDialog,
                onError: (errors) =>
                    setError(
                        String(
                            errors.rider_id ||
                                'The rider could not be assigned.',
                        ),
                    ),
                onFinish: () => setAssigning(false),
            },
        );
    };

    return (
        <>
            <Head title="Unassigned orders" />
            <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
                <div>
                    <Button variant="ghost" size="sm" className="mb-3" asChild>
                        <Link href="/admin/orders">
                            <ArrowLeft /> Back to all orders
                        </Link>
                    </Button>
                    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
                        <div>
                            <h2 className="text-2xl font-semibold tracking-tight">
                                Unassigned orders
                            </h2>
                            <p className="text-muted-foreground text-sm">
                                Escalated rider searches that need human
                                intervention.
                            </p>
                        </div>
                        <p className="text-muted-foreground flex items-center gap-2 text-xs">
                            <RefreshCw className="size-3.5" /> Refreshes every
                            20 seconds
                        </p>
                    </div>
                </div>

                <div className="space-y-3">
                    {orders.data.map((order) => (
                        <Card key={order.id}>
                            <CardContent className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1.5fr)_repeat(4,minmax(100px,1fr))_auto] lg:items-center">
                                <div>
                                    <Link
                                        href={`/admin/orders/${order.id}`}
                                        className="font-semibold hover:underline"
                                    >
                                        {order.order_number}
                                    </Link>
                                    <p className="text-muted-foreground mt-1 text-sm">
                                        {order.restaurant.name} →{' '}
                                        {order.customer?.user.name ||
                                            'Customer'}
                                    </p>
                                    <p className="text-muted-foreground text-xs">
                                        {order.restaurant.address}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-muted-foreground text-xs">
                                        Searching
                                    </p>
                                    <p className="font-medium text-amber-700 dark:text-amber-300">
                                        {elapsedMinutes(
                                            order.rider_search_started_at,
                                            now,
                                        )}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-muted-foreground text-xs">
                                        Escalation
                                    </p>
                                    <Badge
                                        variant="outline"
                                        className="mt-1 capitalize"
                                    >
                                        {order.pool_offer.escalation_stage.replaceAll(
                                            '_',
                                            ' ',
                                        )}
                                    </Badge>
                                </div>
                                <div>
                                    <p className="text-muted-foreground text-xs">
                                        Radius
                                    </p>
                                    <p className="font-medium">
                                        {order.pool_offer.search_radius_km} km
                                    </p>
                                </div>
                                <div>
                                    <p className="text-muted-foreground text-xs">
                                        Incentive
                                    </p>
                                    <p className="font-medium">
                                        {currency.format(
                                            Number(
                                                order.pool_offer
                                                    .incentive_amount,
                                            ),
                                        )}
                                    </p>
                                </div>
                                <Button onClick={() => void viewRiders(order)}>
                                    <LocateFixed /> View nearby riders
                                </Button>
                            </CardContent>
                        </Card>
                    ))}

                    {orders.data.length === 0 && (
                        <div className="rounded-xl border border-dashed px-6 py-14 text-center">
                            <p className="font-medium">The queue is clear.</p>
                            <p className="text-muted-foreground mt-1 text-sm">
                                No escalated rider searches need attention right
                                now.
                            </p>
                        </div>
                    )}
                </div>

                <div className="overflow-hidden rounded-xl border">
                    <Pagination paginated={orders} />
                </div>
            </div>

            <Dialog
                open={selectedOrder !== null}
                onOpenChange={(open) => !open && closeDialog()}
            >
                <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>
                            Assign a rider to {selectedOrder?.order_number}
                        </DialogTitle>
                        <DialogDescription>
                            Approved, active, and available riders are sorted by
                            straight-line distance from the restaurant. COD
                            orders hide riders who have reached their cash remit
                            limit.
                        </DialogDescription>
                    </DialogHeader>

                    {loadingRiders ? (
                        <div className="text-muted-foreground flex items-center justify-center gap-2 py-12 text-sm">
                            <LoaderCircle className="size-4 animate-spin" />
                            Finding riders…
                        </div>
                    ) : riders.length > 0 ? (
                        <div className="space-y-2">
                            {riders.map((rider) => (
                                <button
                                    key={rider.id}
                                    type="button"
                                    onClick={() => setSelectedRiderId(rider.id)}
                                    className={cn(
                                        'hover:bg-muted/50 flex w-full items-center justify-between gap-4 rounded-lg border p-4 text-left transition-colors',
                                        selectedRiderId === rider.id &&
                                            'border-primary bg-primary/5 ring-primary/20 ring-2',
                                    )}
                                >
                                    <div className="flex items-center gap-3">
                                        <span className="bg-muted flex size-9 items-center justify-center rounded-full">
                                            <Bike className="size-4" />
                                        </span>
                                        <div>
                                            <p className="font-medium">
                                                {rider.name}
                                            </p>
                                            <p className="text-muted-foreground text-xs capitalize">
                                                {rider.vehicle_type.replaceAll(
                                                    '_',
                                                    ' ',
                                                )}
                                                {rider.plate_number
                                                    ? ` · ${rider.plate_number}`
                                                    : ''}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-medium tabular-nums">
                                            {rider.distance_km.toFixed(2)} km
                                        </p>
                                        {selectedOrder?.payment_method ===
                                            'cod' && (
                                            <p className="text-muted-foreground text-xs">
                                                Cash{' '}
                                                {currency.format(
                                                    Number(rider.cash_on_hand),
                                                )}{' '}
                                                /{' '}
                                                {currency.format(
                                                    Number(
                                                        rider.cash_remit_limit,
                                                    ),
                                                )}
                                            </p>
                                        )}
                                    </div>
                                </button>
                            ))}
                        </div>
                    ) : (
                        !error && (
                            <div className="rounded-lg border border-dashed px-6 py-10 text-center">
                                <p className="font-medium">
                                    No eligible riders found.
                                </p>
                                <p className="text-muted-foreground mt-1 text-sm">
                                    Availability, approval, account status,
                                    location, and COD cash limits are all
                                    enforced.
                                </p>
                            </div>
                        )
                    )}

                    {error && (
                        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                            {error}
                        </p>
                    )}

                    <DialogFooter>
                        <Button variant="outline" onClick={closeDialog}>
                            Cancel
                        </Button>
                        <Button
                            onClick={assignRider}
                            disabled={!selectedRiderId || assigning}
                        >
                            {assigning ? (
                                <LoaderCircle className="animate-spin" />
                            ) : (
                                <Bike />
                            )}
                            {assigning ? 'Assigning…' : 'Assign rider'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

UnassignedOrders.layout = { title: 'Unassigned orders' };
