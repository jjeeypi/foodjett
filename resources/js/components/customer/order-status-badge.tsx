import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export type CustomerOrderStatus =
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

export const terminalOrderStatuses = new Set<CustomerOrderStatus>([
    'delivered',
    'rejected_by_restaurant',
    'cancelled_by_customer',
    'cancelled_by_restaurant',
    'cancelled_no_rider',
    'cancelled_by_admin',
    'failed_delivery',
]);

export const orderStatusLabel: Record<CustomerOrderStatus, string> = {
    placed: 'Order placed',
    accepted: 'Restaurant accepted',
    preparing: 'Preparing your order',
    ready: 'Ready for pickup',
    finding_rider: 'Finding a rider',
    rider_assigned: 'Rider assigned',
    at_restaurant: 'Rider at restaurant',
    picked_up: 'Picked up',
    on_the_way: 'On the way',
    arrived: 'Rider has arrived',
    delivered: 'Delivered',
    rejected_by_restaurant: 'Restaurant declined',
    cancelled_by_customer: 'Cancelled by you',
    cancelled_by_restaurant: 'Cancelled by restaurant',
    cancelled_no_rider: 'Cancelled — no rider',
    cancelled_by_admin: 'Cancelled by support',
    failed_delivery: 'Delivery failed',
};

const styles: Record<CustomerOrderStatus, string> = {
    placed: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-300',
    accepted:
        'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300',
    preparing:
        'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300',
    ready: 'border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-900 dark:bg-cyan-950/40 dark:text-cyan-300',
    finding_rider:
        'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300',
    rider_assigned:
        'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-300',
    at_restaurant:
        'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-300',
    picked_up:
        'border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-300',
    on_the_way:
        'border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-300',
    arrived:
        'border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-900 dark:bg-purple-950/40 dark:text-purple-300',
    delivered:
        'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300',
    rejected_by_restaurant:
        'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300',
    cancelled_by_customer:
        'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300',
    cancelled_by_restaurant:
        'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300',
    cancelled_no_rider:
        'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300',
    cancelled_by_admin:
        'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300',
    failed_delivery:
        'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300',
};

export default function OrderStatusBadge({
    status,
    className,
}: {
    status: CustomerOrderStatus;
    className?: string;
}) {
    return (
        <Badge
            variant="outline"
            className={cn('whitespace-nowrap', styles[status], className)}
        >
            {orderStatusLabel[status]}
        </Badge>
    );
}
