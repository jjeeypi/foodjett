import { Head, Link, router } from '@inertiajs/react';
import { ExternalLink } from 'lucide-react';
import { useState } from 'react';
import DataTable, {
    type DataTableColumn,
    type PaginatedData,
} from '@/components/admin/data-table';
import FinanceNav from '@/components/admin/finance-nav';
import FinanceStatusBadge, {
    type FinanceStatus,
} from '@/components/admin/finance-status-badge';
import RefundPaymentDialog from '@/components/admin/refund-payment-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

type Payment = {
    id: number;
    method: 'cod' | 'gcash' | 'card';
    status: FinanceStatus;
    amount: string;
    refunded_amount: string;
    transaction_reference: string | null;
    paid_at: string | null;
    created_at: string;
    order: {
        id: number;
        order_number: string;
        restaurant: { name: string };
        customer: { user: { name: string } } | null;
    };
};

type Filters = {
    method: string;
    status: string;
    date_from: string;
    date_to: string;
};

const currency = new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
});

export default function Transactions({
    payments,
    filters,
}: {
    payments: PaginatedData<Payment>;
    filters: Filters;
}) {
    const [method, setMethod] = useState(filters.method || 'all');
    const [status, setStatus] = useState(filters.status || 'all');
    const [dateFrom, setDateFrom] = useState(filters.date_from);
    const [dateTo, setDateTo] = useState(filters.date_to);

    const visit = (overrides: Partial<Filters> = {}) => {
        const next = {
            method: method === 'all' ? '' : method,
            status: status === 'all' ? '' : status,
            date_from: dateFrom,
            date_to: dateTo,
            ...overrides,
        };

        router.get(
            '/admin/transactions',
            {
                method: next.method || undefined,
                status: next.status || undefined,
                date_from: next.date_from || undefined,
                date_to: next.date_to || undefined,
            },
            {
                preserveState: true,
                preserveScroll: true,
                replace: true,
                only: ['payments', 'filters'],
            },
        );
    };

    const reset = () => {
        setMethod('all');
        setStatus('all');
        setDateFrom('');
        setDateTo('');
        router.get('/admin/transactions', {}, { replace: true });
    };

    const columns: DataTableColumn<Payment>[] = [
        {
            key: 'order',
            label: 'Order',
            render: (payment) => (
                <div>
                    <p className="font-medium">{payment.order.order_number}</p>
                    <p className="text-muted-foreground text-xs">
                        {payment.order.restaurant.name}
                    </p>
                </div>
            ),
        },
        {
            key: 'customer',
            label: 'Customer',
            render: (payment) =>
                payment.order.customer?.user.name || 'Customer',
        },
        {
            key: 'method',
            label: 'Method',
            render: (payment) => (
                <Badge variant="outline" className="uppercase">
                    {payment.method}
                </Badge>
            ),
        },
        {
            key: 'status',
            label: 'Status',
            render: (payment) => <FinanceStatusBadge status={payment.status} />,
        },
        {
            key: 'amount',
            label: 'Amount',
            className: 'text-right tabular-nums',
            render: (payment) => currency.format(Number(payment.amount)),
        },
        {
            key: 'refunded',
            label: 'Refunded',
            className: 'text-right tabular-nums',
            render: (payment) =>
                currency.format(Number(payment.refunded_amount)),
        },
        {
            key: 'reference',
            label: 'Reference',
            render: (payment) => (
                <span className="font-mono text-xs">
                    {payment.transaction_reference || '—'}
                </span>
            ),
        },
        {
            key: 'paid_at',
            label: 'Paid at',
            render: (payment) =>
                payment.paid_at
                    ? new Date(payment.paid_at).toLocaleString()
                    : '—',
        },
        {
            key: 'actions',
            label: '',
            className: 'text-right',
            render: (payment) => (
                <div className="flex justify-end gap-2">
                    <Button size="sm" variant="ghost" asChild>
                        <Link href={`/admin/orders/${payment.order.id}`}>
                            <ExternalLink /> View order
                        </Link>
                    </Button>
                    {(payment.status === 'paid' ||
                        payment.status === 'partially_refunded') && (
                        <RefundPaymentDialog
                            paymentId={payment.id}
                            orderNumber={payment.order.order_number}
                            amount={Number(payment.amount)}
                            refundedAmount={Number(payment.refunded_amount)}
                        />
                    )}
                </div>
            ),
        },
    ];

    return (
        <>
            <Head title="Transactions" />
            <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
                <FinanceNav />

                <div>
                    <h2 className="text-2xl font-semibold tracking-tight">
                        Transactions
                    </h2>
                    <p className="text-muted-foreground text-sm">
                        Review payments and record partial or full refunds.
                    </p>
                </div>

                <div className="grid gap-3 rounded-xl border p-4 sm:grid-cols-2 xl:grid-cols-4">
                    <Select
                        value={method}
                        onValueChange={(value) => {
                            setMethod(value);
                            visit({ method: value === 'all' ? '' : value });
                        }}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Payment method" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All methods</SelectItem>
                            <SelectItem value="cod">COD</SelectItem>
                            <SelectItem value="gcash">GCash</SelectItem>
                            <SelectItem value="card">Card</SelectItem>
                        </SelectContent>
                    </Select>
                    <Select
                        value={status}
                        onValueChange={(value) => {
                            setStatus(value);
                            visit({ status: value === 'all' ? '' : value });
                        }}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Payment status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All statuses</SelectItem>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="paid">Paid</SelectItem>
                            <SelectItem value="partially_refunded">
                                Partially refunded
                            </SelectItem>
                            <SelectItem value="refunded">Refunded</SelectItem>
                            <SelectItem value="failed">Failed</SelectItem>
                        </SelectContent>
                    </Select>
                    <Input
                        type="date"
                        aria-label="Payments from date"
                        value={dateFrom}
                        onChange={(event) => setDateFrom(event.target.value)}
                    />
                    <Input
                        type="date"
                        aria-label="Payments through date"
                        min={dateFrom || undefined}
                        value={dateTo}
                        onChange={(event) => setDateTo(event.target.value)}
                    />
                    <div className="flex gap-2 sm:col-span-2 xl:col-span-4 xl:justify-end">
                        <Button variant="ghost" onClick={reset}>
                            Reset
                        </Button>
                        <Button onClick={() => visit()}>Apply dates</Button>
                    </div>
                </div>

                <DataTable
                    columns={columns}
                    paginated={payments}
                    rowKey={(payment) => payment.id}
                    emptyMessage="No transactions match these filters."
                />
            </div>
        </>
    );
}

Transactions.layout = { title: 'Transactions' };
