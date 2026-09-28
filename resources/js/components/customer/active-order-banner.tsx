import { Link } from '@inertiajs/react';
import { useEcho } from '@laravel/echo-react';
import { useEffect, useRef, useState } from 'react';
import OrderStatusBadge, {
    terminalOrderStatuses,
    type CustomerOrderStatus,
} from '@/components/customer/order-status-badge';

type ActiveOrder = {
    id: number;
    order_number: string;
    status: CustomerOrderStatus;
    show_url: string;
};

type StatusUpdate = {
    event_id: string;
    id: number;
    status: CustomerOrderStatus;
};

export default function ActiveOrderBanner({ order }: { order: ActiveOrder }) {
    const [current, setCurrent] = useState<ActiveOrder | null>(order);
    const processedEvents = useRef(new Set<string>());

    useEffect(() => setCurrent(order), [order]);

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
            setCurrent((activeOrder) =>
                activeOrder === null || terminalOrderStatuses.has(update.status)
                    ? null
                    : { ...activeOrder, status: update.status },
            );
        },
        [order.id],
    );

    if (current === null) return null;

    return (
        <Link
            href={current.show_url}
            className="bg-primary text-primary-foreground flex min-h-9 items-center justify-center gap-2 px-4 py-1.5 text-center text-xs font-medium sm:text-sm"
        >
            <span className="size-2 animate-pulse rounded-full bg-white" />
            <span>Order {current.order_number}</span>
            <OrderStatusBadge
                status={current.status}
                className="border-white/40 bg-white/15 text-white"
            />
            <span className="underline underline-offset-2">View order</span>
        </Link>
    );
}
