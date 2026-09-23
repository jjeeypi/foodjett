import { Head, router } from '@inertiajs/react';
import { Check } from 'lucide-react';
import { useState } from 'react';
import DataTable, {
    type DataTableColumn,
    type PaginatedData,
} from '@/components/admin/data-table';
import FinanceNav from '@/components/admin/finance-nav';
import FinanceStatusBadge from '@/components/admin/finance-status-badge';
import GeneratePayoutDialog from '@/components/admin/generate-payout-dialog';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

type Payout = {
    id: number;
    period_start: string;
    period_end: string;
    gross_sales: string;
    commission_deducted: string;
    net_amount: string;
    status: 'pending' | 'paid';
    paid_at: string | null;
    restaurant: { id: number; name: string };
};

type Filters = { status: string; restaurant_id: string };

const currency = new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
});

const date = (value: string) => new Date(value).toLocaleDateString();

export default function RestaurantPayouts({
    payouts,
    filters,
    restaurants,
}: {
    payouts: PaginatedData<Payout>;
    filters: Filters;
    restaurants: { id: number; name: string }[];
}) {
    const [payingId, setPayingId] = useState<number | null>(null);

    const visit = (overrides: Partial<Filters>) => {
        const next = { ...filters, ...overrides };
        router.get(
            '/admin/payouts/restaurants',
            {
                status: next.status || undefined,
                restaurant_id: next.restaurant_id || undefined,
            },
            {
                preserveState: true,
                preserveScroll: true,
                replace: true,
                only: ['payouts', 'filters'],
            },
        );
    };

    const markPaid = (payout: Payout) => {
        setPayingId(payout.id);
        router.patch(
            `/admin/payouts/restaurants/${payout.id}/paid`,
            {},
            {
                preserveScroll: true,
                onFinish: () => setPayingId(null),
            },
        );
    };

    const columns: DataTableColumn<Payout>[] = [
        {
            key: 'restaurant',
            label: 'Restaurant',
            render: (payout) => (
                <span className="font-medium">{payout.restaurant.name}</span>
            ),
        },
        {
            key: 'period',
            label: 'Period',
            render: (payout) =>
                `${date(payout.period_start)} – ${date(payout.period_end)}`,
        },
        {
            key: 'gross',
            label: 'Gross sales',
            className: 'text-right tabular-nums',
            render: (payout) => currency.format(Number(payout.gross_sales)),
        },
        {
            key: 'commission',
            label: 'Commission',
            className: 'text-right tabular-nums',
            render: (payout) =>
                currency.format(Number(payout.commission_deducted)),
        },
        {
            key: 'net',
            label: 'Net amount',
            className: 'text-right font-medium tabular-nums',
            render: (payout) => currency.format(Number(payout.net_amount)),
        },
        {
            key: 'status',
            label: 'Status',
            render: (payout) => (
                <div>
                    <FinanceStatusBadge status={payout.status} />
                    {payout.paid_at && (
                        <p className="text-muted-foreground mt-1 text-xs">
                            {new Date(payout.paid_at).toLocaleString()}
                        </p>
                    )}
                </div>
            ),
        },
        {
            key: 'action',
            label: '',
            className: 'text-right',
            render: (payout) =>
                payout.status === 'pending' ? (
                    <Button
                        size="sm"
                        onClick={() => markPaid(payout)}
                        disabled={payingId === payout.id}
                    >
                        <Check />
                        {payingId === payout.id ? 'Saving…' : 'Mark paid'}
                    </Button>
                ) : null,
        },
    ];

    return (
        <>
            <Head title="Restaurant payouts" />
            <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
                <FinanceNav />

                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
                    <div>
                        <h2 className="text-2xl font-semibold tracking-tight">
                            Restaurant payouts
                        </h2>
                        <p className="text-muted-foreground text-sm">
                            Generate settlement periods and record completed
                            restaurant payouts.
                        </p>
                    </div>
                    <GeneratePayoutDialog
                        action="/admin/payouts/restaurants/generate"
                        subject="restaurant"
                    />
                </div>

                <div className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row">
                    <Select
                        value={filters.status || 'all'}
                        onValueChange={(value) =>
                            visit({ status: value === 'all' ? '' : value })
                        }
                    >
                        <SelectTrigger className="w-full sm:w-48">
                            <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All statuses</SelectItem>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="paid">Paid</SelectItem>
                        </SelectContent>
                    </Select>
                    <Select
                        value={filters.restaurant_id || 'all'}
                        onValueChange={(value) =>
                            visit({
                                restaurant_id: value === 'all' ? '' : value,
                            })
                        }
                    >
                        <SelectTrigger className="w-full sm:w-64">
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
                </div>

                <DataTable
                    columns={columns}
                    paginated={payouts}
                    rowKey={(payout) => payout.id}
                    emptyMessage="No restaurant payouts match these filters."
                />
            </div>
        </>
    );
}

RestaurantPayouts.layout = { title: 'Restaurant payouts' };
