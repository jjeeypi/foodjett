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
    total_amount: string;
    status: 'pending' | 'paid';
    paid_at: string | null;
    rider: { id: number; user: { name: string } };
};

type Filters = { status: string; rider_id: string };

const currency = new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
});

const date = (value: string) => new Date(value).toLocaleDateString();

export default function RiderPayouts({
    payouts,
    filters,
    riders,
}: {
    payouts: PaginatedData<Payout>;
    filters: Filters;
    riders: { id: number; user: { name: string } }[];
}) {
    const [payingId, setPayingId] = useState<number | null>(null);

    const visit = (overrides: Partial<Filters>) => {
        const next = { ...filters, ...overrides };
        router.get(
            '/admin/payouts/riders',
            {
                status: next.status || undefined,
                rider_id: next.rider_id || undefined,
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
            `/admin/payouts/riders/${payout.id}/paid`,
            {},
            {
                preserveScroll: true,
                onFinish: () => setPayingId(null),
            },
        );
    };

    const columns: DataTableColumn<Payout>[] = [
        {
            key: 'rider',
            label: 'Rider',
            render: (payout) => (
                <span className="font-medium">{payout.rider.user.name}</span>
            ),
        },
        {
            key: 'period',
            label: 'Period',
            render: (payout) =>
                `${date(payout.period_start)} – ${date(payout.period_end)}`,
        },
        {
            key: 'amount',
            label: 'Total earned',
            className: 'text-right font-medium tabular-nums',
            render: (payout) => currency.format(Number(payout.total_amount)),
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
            <Head title="Rider payouts" />
            <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
                <FinanceNav />

                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
                    <div>
                        <h2 className="text-2xl font-semibold tracking-tight">
                            Rider payouts
                        </h2>
                        <p className="text-muted-foreground text-sm">
                            Settle rider earnings grouped by delivery period.
                        </p>
                    </div>
                    <GeneratePayoutDialog
                        action="/admin/payouts/riders/generate"
                        subject="rider"
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
                        value={filters.rider_id || 'all'}
                        onValueChange={(value) =>
                            visit({ rider_id: value === 'all' ? '' : value })
                        }
                    >
                        <SelectTrigger className="w-full sm:w-64">
                            <SelectValue placeholder="Rider" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All riders</SelectItem>
                            {riders.map((rider) => (
                                <SelectItem
                                    key={rider.id}
                                    value={String(rider.id)}
                                >
                                    {rider.user.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <DataTable
                    columns={columns}
                    paginated={payouts}
                    rowKey={(payout) => payout.id}
                    emptyMessage="No rider payouts match these filters."
                />
            </div>
        </>
    );
}

RiderPayouts.layout = { title: 'Rider payouts' };
