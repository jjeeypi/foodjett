import { Head, Link, router } from '@inertiajs/react';
import { Search } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import ApprovalStatusBadge, {
    type ApprovalStatus,
} from '@/components/admin/approval-status-badge';
import DataTable, {
    type DataTableColumn,
    type PaginatedData,
} from '@/components/admin/data-table';
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

type Rider = {
    id: number;
    vehicle_type: string;
    approval_status: Extract<
        ApprovalStatus,
        'pending' | 'approved' | 'rejected'
    >;
    availability_status: 'offline' | 'available' | 'busy';
    cash_on_hand: string;
    reviews_avg_rating: number | string | null;
    user: {
        name: string;
        email: string;
        status: 'active' | 'suspended' | 'banned';
    };
};

type Props = {
    riders: PaginatedData<Rider>;
    filters: { search: string; approval_status: string };
};

const currency = new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
});

export default function RidersIndex({ riders, filters }: Props) {
    const [search, setSearch] = useState(filters.search);
    const [approvalStatus, setApprovalStatus] = useState(
        filters.approval_status || 'all',
    );
    const firstRender = useRef(true);

    const visit = (nextSearch: string, nextStatus: string) => {
        router.get(
            '/admin/riders',
            {
                search: nextSearch || undefined,
                approval_status: nextStatus === 'all' ? undefined : nextStatus,
            },
            {
                preserveState: true,
                preserveScroll: true,
                replace: true,
                only: ['riders', 'filters'],
            },
        );
    };

    useEffect(() => {
        if (firstRender.current) {
            firstRender.current = false;

            return;
        }

        const timeout = window.setTimeout(
            () => visit(search, approvalStatus),
            350,
        );

        return () => window.clearTimeout(timeout);
        // Status changes are submitted immediately by the select handler.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search]);

    const columns: DataTableColumn<Rider>[] = [
        {
            key: 'name',
            label: 'Rider',
            render: (rider) => (
                <div>
                    <p className="font-medium">{rider.user.name}</p>
                    <p className="text-muted-foreground text-xs">
                        {rider.user.email}
                    </p>
                </div>
            ),
        },
        {
            key: 'vehicle',
            label: 'Vehicle',
            render: (rider) => (
                <span className="capitalize">
                    {rider.vehicle_type.replace('_', ' ')}
                </span>
            ),
        },
        {
            key: 'approval',
            label: 'Approval',
            render: (rider) => (
                <ApprovalStatusBadge status={rider.approval_status} />
            ),
        },
        {
            key: 'availability',
            label: 'Availability',
            render: (rider) => (
                <Badge variant="outline" className="capitalize">
                    {rider.availability_status}
                </Badge>
            ),
        },
        {
            key: 'rating',
            label: 'Rating',
            render: (rider) =>
                rider.reviews_avg_rating === null
                    ? 'No reviews'
                    : `${Number(rider.reviews_avg_rating).toFixed(1)} / 5`,
        },
        {
            key: 'cash',
            label: 'Cash on hand',
            className: 'text-right',
            render: (rider) => currency.format(Number(rider.cash_on_hand)),
        },
    ];

    return (
        <>
            <Head title="Riders" />
            <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
                    <div>
                        <h2 className="text-2xl font-semibold tracking-tight">
                            Riders
                        </h2>
                        <p className="text-muted-foreground text-sm">
                            Select a row to review the rider profile.
                        </p>
                    </div>
                    <Button variant="outline" asChild>
                        <Link href="/admin/riders/pending">
                            Pending approvals
                        </Link>
                    </Button>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                    <div className="relative flex-1 sm:max-w-md">
                        <Search className="text-muted-foreground pointer-events-none absolute top-2.5 left-3 size-4" />
                        <Input
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Search rider name…"
                            className="pl-9"
                        />
                    </div>
                    <Select
                        value={approvalStatus}
                        onValueChange={(value) => {
                            setApprovalStatus(value);
                            visit(search, value);
                        }}
                    >
                        <SelectTrigger className="w-full sm:w-48">
                            <SelectValue placeholder="Approval status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All statuses</SelectItem>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="approved">Approved</SelectItem>
                            <SelectItem value="rejected">Rejected</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <DataTable
                    columns={columns}
                    paginated={riders}
                    rowKey={(rider) => rider.id}
                    rowHref={(rider) => `/admin/riders/${rider.id}`}
                    emptyMessage="No riders match these filters."
                />
            </div>
        </>
    );
}

RidersIndex.layout = { title: 'Riders' };
