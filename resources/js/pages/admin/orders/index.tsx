import { Head, Link, router } from '@inertiajs/react';
import { Search, TriangleAlert } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import DataTable, {
    type DataTableColumn,
    type PaginatedData,
} from '@/components/admin/data-table';
import OrderStatusBadge, {
    type OrderStatus,
} from '@/components/admin/order-status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

type OrderRow = {
    id: number;
    order_number: string;
    status: OrderStatus;
    total_amount: string;
    payment_method: 'cod' | 'gcash' | 'card';
    placed_at: string;
    restaurant: { id: number; name: string };
    customer: { user: { name: string } } | null;
    rider: { user: { name: string } } | null;
};

type Filters = {
    search: string;
    status: string;
    restaurant_id: string;
    date_from: string;
    date_to: string;
};

type Props = {
    orders: PaginatedData<OrderRow>;
    filters: Filters;
    restaurants: { id: number; name: string }[];
    statuses: OrderStatus[];
};

const currency = new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
});

export default function OrdersIndex({
    orders,
    filters,
    restaurants,
    statuses,
}: Props) {
    const [search, setSearch] = useState(filters.search);
    const [status, setStatus] = useState(filters.status || 'all');
    const [restaurantId, setRestaurantId] = useState(
        filters.restaurant_id || 'all',
    );
    const [dateFrom, setDateFrom] = useState(filters.date_from);
    const [dateTo, setDateTo] = useState(filters.date_to);
    const firstRender = useRef(true);

    const visit = (overrides: Partial<Filters> = {}) => {
        const next = {
            search,
            status: status === 'all' ? '' : status,
            restaurant_id: restaurantId === 'all' ? '' : restaurantId,
            date_from: dateFrom,
            date_to: dateTo,
            ...overrides,
        };

        router.get(
            '/admin/orders',
            {
                search: next.search || undefined,
                status: next.status || undefined,
                restaurant_id: next.restaurant_id || undefined,
                date_from: next.date_from || undefined,
                date_to: next.date_to || undefined,
            },
            {
                preserveState: true,
                preserveScroll: true,
                replace: true,
                only: ['orders', 'filters'],
            },
        );
    };

    useEffect(() => {
        if (firstRender.current) {
            firstRender.current = false;
            return;
        }

        const timeout = window.setTimeout(() => visit(), 350);
        return () => window.clearTimeout(timeout);
        // Other filters are submitted by their controls.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search]);

    const reset = () => {
        setSearch('');
        setStatus('all');
        setRestaurantId('all');
        setDateFrom('');
        setDateTo('');
        router.get('/admin/orders', {}, { replace: true });
    };

    const columns: DataTableColumn<OrderRow>[] = [
        {
            key: 'order',
            label: 'Order',
            render: (order) => (
                <div>
                    <p className="font-medium">{order.order_number}</p>
                    <p className="text-muted-foreground text-xs">
                        {new Date(order.placed_at).toLocaleString()}
                    </p>
                </div>
            ),
        },
        {
            key: 'restaurant',
            label: 'Restaurant',
            render: (order) => order.restaurant.name,
        },
        {
            key: 'customer',
            label: 'Customer',
            render: (order) => order.customer?.user.name || 'Customer',
        },
        {
            key: 'rider',
            label: 'Rider',
            render: (order) => order.rider?.user.name || '—',
        },
        {
            key: 'status',
            label: 'Status',
            render: (order) => <OrderStatusBadge status={order.status} />,
        },
        {
            key: 'payment',
            label: 'Payment',
            render: (order) => (
                <span className="uppercase">{order.payment_method}</span>
            ),
        },
        {
            key: 'total',
            label: 'Total',
            className: 'text-right tabular-nums',
            render: (order) => currency.format(Number(order.total_amount)),
        },
    ];

    return (
        <>
            <Head title="Orders" />
            <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
                    <div>
                        <h2 className="text-2xl font-semibold tracking-tight">
                            All orders
                        </h2>
                        <p className="text-muted-foreground text-sm">
                            Search and inspect every order across the platform.
                        </p>
                    </div>
                    <Button variant="outline" asChild>
                        <Link href="/admin/orders/unassigned">
                            <TriangleAlert /> Unassigned queue
                        </Link>
                    </Button>
                </div>

                <div className="grid gap-3 rounded-xl border p-4 md:grid-cols-2 xl:grid-cols-6">
                    <div className="relative md:col-span-2">
                        <Search className="text-muted-foreground pointer-events-none absolute top-2.5 left-3 size-4" />
                        <Input
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Search order number…"
                            className="pl-9"
                        />
                    </div>
                    <Select
                        value={status}
                        onValueChange={(value) => {
                            setStatus(value);
                            visit({ status: value === 'all' ? '' : value });
                        }}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All statuses</SelectItem>
                            {statuses.map((option) => (
                                <SelectItem key={option} value={option}>
                                    {option.replaceAll('_', ' ')}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Select
                        value={restaurantId}
                        onValueChange={(value) => {
                            setRestaurantId(value);
                            visit({
                                restaurant_id: value === 'all' ? '' : value,
                            });
                        }}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Restaurant" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All restaurants</SelectItem>
                            {restaurants.map((restaurant) => (
                                <SelectItem
                                    key={restaurant.id}
                                    value={String(restaurant.id)}
                                >
                                    {restaurant.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Input
                        type="date"
                        aria-label="Orders from date"
                        value={dateFrom}
                        onChange={(event) => setDateFrom(event.target.value)}
                    />
                    <Input
                        type="date"
                        aria-label="Orders through date"
                        value={dateTo}
                        min={dateFrom || undefined}
                        onChange={(event) => setDateTo(event.target.value)}
                    />
                    <div className="flex gap-2 md:col-span-2 xl:col-span-6 xl:justify-end">
                        <Button variant="ghost" onClick={reset}>
                            Reset
                        </Button>
                        <Button onClick={() => visit()}>Apply dates</Button>
                    </div>
                </div>

                <DataTable
                    columns={columns}
                    paginated={orders}
                    rowKey={(order) => order.id}
                    rowHref={(order) => `/admin/orders/${order.id}`}
                    emptyMessage="No orders match these filters."
                />
            </div>
        </>
    );
}

OrdersIndex.layout = { title: 'Orders' };
