import { Head, router } from '@inertiajs/react';
import { Search } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import DataTable, {
    type DataTableColumn,
    type PaginatedData,
} from '@/components/admin/data-table';
import FinanceNav from '@/components/admin/finance-nav';
import FinanceStatusBadge from '@/components/admin/finance-status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

type Remittance = {
    id: number;
    amount: string;
    status: 'pending' | 'confirmed';
    reference_note: string | null;
    created_at: string;
    remitted_at: string | null;
    rider: {
        cash_on_hand: string;
        user: { name: string; email: string };
    };
};

type Props = {
    remittances: PaginatedData<Remittance>;
    filters: {
        search: string;
        status: 'pending' | 'confirmed' | 'all';
    };
};

const currency = new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
});

export default function CashRemittances({ remittances, filters }: Props) {
    const [search, setSearch] = useState(filters.search);
    const [status, setStatus] = useState(filters.status);
    const [confirmingId, setConfirmingId] = useState<number | null>(null);
    const isFirstSearchRender = useRef(true);

    const visit = (nextSearch: string, nextStatus: string) => {
        router.get(
            '/admin/remittances',
            { search: nextSearch || undefined, status: nextStatus },
            {
                preserveState: true,
                preserveScroll: true,
                replace: true,
                only: ['remittances', 'filters'],
            },
        );
    };

    useEffect(() => {
        if (isFirstSearchRender.current) {
            isFirstSearchRender.current = false;
            return;
        }

        const timeout = window.setTimeout(() => visit(search, status), 350);
        return () => window.clearTimeout(timeout);
        // Status is submitted immediately by its change handler.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search]);

    const columns: DataTableColumn<Remittance>[] = [
        {
            key: 'rider',
            label: 'Rider',
            render: (remittance) => (
                <div>
                    <p className="font-medium">{remittance.rider.user.name}</p>
                    <p className="text-muted-foreground text-xs">
                        {remittance.rider.user.email}
                    </p>
                </div>
            ),
        },
        {
            key: 'amount',
            label: 'Amount',
            className: 'text-right font-medium tabular-nums',
            render: (remittance) => currency.format(Number(remittance.amount)),
        },
        {
            key: 'cash',
            label: 'Current cash on hand',
            className: 'text-right tabular-nums',
            render: (remittance) =>
                currency.format(Number(remittance.rider.cash_on_hand)),
        },
        {
            key: 'reference',
            label: 'Reference note',
            render: (remittance) => remittance.reference_note || '—',
        },
        {
            key: 'submitted',
            label: 'Submitted',
            render: (remittance) =>
                new Date(remittance.created_at).toLocaleString(),
        },
        {
            key: 'status',
            label: 'Status',
            render: (remittance) => (
                <div>
                    <FinanceStatusBadge status={remittance.status} />
                    {remittance.remitted_at && (
                        <p className="text-muted-foreground mt-1 text-xs">
                            {new Date(remittance.remitted_at).toLocaleString()}
                        </p>
                    )}
                </div>
            ),
        },
        {
            key: 'actions',
            label: '',
            className: 'text-right',
            render: (remittance) =>
                remittance.status === 'pending' ? (
                    <Button
                        size="sm"
                        disabled={confirmingId === remittance.id}
                        onClick={() => {
                            setConfirmingId(remittance.id);
                            router.patch(
                                `/admin/remittances/${remittance.id}/confirm`,
                                {},
                                {
                                    preserveScroll: true,
                                    onFinish: () => setConfirmingId(null),
                                },
                            );
                        }}
                    >
                        {confirmingId === remittance.id
                            ? 'Confirming…'
                            : 'Confirm'}
                    </Button>
                ) : null,
        },
    ];

    return (
        <>
            <Head title="Cash remittances" />
            <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
                <FinanceNav />

                <div>
                    <h2 className="text-2xl font-semibold tracking-tight">
                        Cash remittances
                    </h2>
                    <p className="text-muted-foreground text-sm">
                        Confirm only after matching the rider's deposit or cash
                        handover.
                    </p>
                </div>

                <div className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row">
                    <div className="relative flex-1 sm:max-w-md">
                        <Search className="text-muted-foreground pointer-events-none absolute top-2.5 left-3 size-4" />
                        <Input
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Search rider name or email…"
                            className="pl-9"
                        />
                    </div>
                    <Select
                        value={status}
                        onValueChange={(value: Props['filters']['status']) => {
                            setStatus(value);
                            visit(search, value);
                        }}
                    >
                        <SelectTrigger className="w-full sm:w-44">
                            <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="confirmed">Confirmed</SelectItem>
                            <SelectItem value="all">All statuses</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <DataTable
                    columns={columns}
                    paginated={remittances}
                    rowKey={(remittance) => remittance.id}
                    emptyMessage="No remittances match these filters."
                />
            </div>
        </>
    );
}

CashRemittances.layout = { title: 'Cash remittances' };
