import { Head, Link } from '@inertiajs/react';
import {
    ChevronRight,
    LoaderCircle,
    PackageOpen,
    RefreshCcw,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import CardPagination from '@/components/customer/card-pagination';
import OrderStatusBadge, {
    type CustomerOrderStatus,
} from '@/components/customer/order-status-badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useCart, type AddCartItem } from '@/contexts/cart-context';
import { cn } from '@/lib/utils';
import type { Paginated } from '@/types/customer-catalog';

type OrderRow = {
    id: number;
    order_number: string;
    restaurant: { name: string; logo_url: string | null };
    placed_at: string;
    item_count: number;
    total_amount: number;
    status: CustomerOrderStatus;
    can_reorder: boolean;
    show_url: string;
};

type ReorderResponse = {
    items: AddCartItem[];
    price_changed: boolean;
};

const money = new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
});
const dateTime = new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
});

const csrfToken = () =>
    document
        .querySelector<HTMLMetaElement>('meta[name="csrf-token"]')
        ?.getAttribute('content') ?? '';

export default function OrdersIndex({
    orders,
    tab,
}: {
    orders: Paginated<OrderRow>;
    tab: 'active' | 'past';
}) {
    const { addItems } = useCart();
    const [reordering, setReordering] = useState<number | null>(null);

    const reorder = async (order: OrderRow) => {
        setReordering(order.id);

        try {
            const response = await fetch(
                `/customer/orders/${order.id}/reorder`,
                {
                    method: 'POST',
                    credentials: 'same-origin',
                    headers: {
                        Accept: 'application/json',
                        'X-CSRF-TOKEN': csrfToken(),
                    },
                },
            );
            const body = (await response.json()) as
                | ReorderResponse
                | { message?: string; errors?: Record<string, string[]> };

            if (!response.ok || !('items' in body)) {
                const message =
                    'errors' in body
                        ? Object.values(body.errors ?? {}).flat()[0]
                        : 'message' in body
                          ? body.message
                          : undefined;
                toast.error(message ?? 'This order cannot be reordered.');
                return;
            }

            if (!addItems(body.items)) return;

            toast.success('Items added to your cart.', {
                description: body.price_changed
                    ? 'One or more prices changed; current prices were applied.'
                    : 'Availability and current prices were checked.',
            });
        } catch {
            toast.error('Could not prepare this reorder. Please try again.');
        } finally {
            setReordering(null);
        }
    };

    return (
        <>
            <Head title="Your orders" />
            <div className="mx-auto w-full max-w-5xl px-4 py-6 md:px-6 md:py-8">
                <div>
                    <h1 className="text-3xl font-semibold tracking-tight">
                        Your orders
                    </h1>
                    <p className="text-muted-foreground mt-1 text-sm">
                        Track current deliveries and revisit previous meals.
                    </p>
                </div>

                <div className="mt-6 flex w-fit rounded-lg border p-1">
                    {(['active', 'past'] as const).map((value) => (
                        <Link
                            key={value}
                            href={`/customer/orders?tab=${value}`}
                            preserveState
                            className={cn(
                                'rounded-md px-4 py-2 text-sm font-medium capitalize transition-colors',
                                tab === value
                                    ? 'bg-primary text-primary-foreground'
                                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                            )}
                        >
                            {value}
                        </Link>
                    ))}
                </div>

                <div className="mt-6 space-y-3">
                    {orders.data.map((order) => (
                        <Card key={order.id} className="py-0">
                            <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
                                <Link
                                    href={order.show_url}
                                    className="flex min-w-0 flex-1 items-center gap-4 rounded-lg focus-visible:ring-2 focus-visible:outline-none"
                                >
                                    <Avatar className="size-12 rounded-xl">
                                        {order.restaurant.logo_url && (
                                            <AvatarImage
                                                src={order.restaurant.logo_url}
                                                alt={order.restaurant.name}
                                                className="object-cover"
                                            />
                                        )}
                                        <AvatarFallback className="rounded-xl">
                                            {order.restaurant.name
                                                .split(' ')
                                                .map((part) => part[0])
                                                .join('')
                                                .slice(0, 2)
                                                .toUpperCase()}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <h2 className="truncate font-semibold">
                                                {order.restaurant.name}
                                            </h2>
                                            <OrderStatusBadge
                                                status={order.status}
                                            />
                                        </div>
                                        <p className="text-muted-foreground mt-1 text-sm">
                                            {order.order_number} ·{' '}
                                            {order.item_count}{' '}
                                            {order.item_count === 1
                                                ? 'item'
                                                : 'items'}
                                        </p>
                                        <p className="text-muted-foreground mt-0.5 text-xs">
                                            {dateTime.format(
                                                new Date(order.placed_at),
                                            )}
                                        </p>
                                    </div>
                                    <div className="hidden shrink-0 items-center gap-3 sm:flex">
                                        <strong>
                                            {money.format(order.total_amount)}
                                        </strong>
                                        <ChevronRight className="text-muted-foreground size-5" />
                                    </div>
                                </Link>

                                <div className="flex items-center justify-between gap-3 border-t pt-3 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-4">
                                    <strong className="sm:hidden">
                                        {money.format(order.total_amount)}
                                    </strong>
                                    {order.can_reorder && (
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            disabled={reordering === order.id}
                                            onClick={() => void reorder(order)}
                                        >
                                            {reordering === order.id ? (
                                                <LoaderCircle className="animate-spin" />
                                            ) : (
                                                <RefreshCcw />
                                            )}
                                            Reorder
                                        </Button>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    ))}

                    {orders.data.length === 0 && (
                        <div className="rounded-xl border border-dashed py-16 text-center">
                            <PackageOpen className="text-muted-foreground mx-auto size-10" />
                            <h2 className="mt-4 font-semibold">
                                {tab === 'active'
                                    ? 'No active orders'
                                    : 'No past orders yet'}
                            </h2>
                            <p className="text-muted-foreground mt-1 text-sm">
                                {tab === 'active'
                                    ? 'Your next order will appear here while it is being prepared and delivered.'
                                    : 'Delivered and cancelled orders will appear here.'}
                            </p>
                            <Button className="mt-5" asChild>
                                <Link href="/customer/foods">Browse foods</Link>
                            </Button>
                        </div>
                    )}
                </div>

                <CardPagination paginated={orders} />
            </div>
        </>
    );
}
