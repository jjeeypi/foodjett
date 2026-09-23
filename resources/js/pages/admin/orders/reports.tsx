import { Head, router } from '@inertiajs/react';
import DataTable, {
    type DataTableColumn,
    type PaginatedData,
} from '@/components/admin/data-table';
import { Badge } from '@/components/ui/badge';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

type ReportStatus = 'open' | 'under_review' | 'resolved' | 'rejected';

type ReportRow = {
    id: number;
    against: 'restaurant' | 'rider' | 'customer' | 'platform';
    type:
        | 'missing_item'
        | 'wrong_item'
        | 'late_delivery'
        | 'no_show_rider'
        | 'rude_behavior'
        | 'customer_unreachable'
        | 'accident'
        | 'other';
    status: ReportStatus;
    created_at: string;
    order: { id: number; order_number: string };
    reported_by: { id: number; name: string };
};

type Filters = { status: string; type: string; against: string };

const statusStyle: Record<ReportStatus, string> = {
    open: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300',
    under_review:
        'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300',
    resolved:
        'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300',
    rejected:
        'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300',
};

export default function OrderReports({
    reports,
    filters,
}: {
    reports: PaginatedData<ReportRow>;
    filters: Filters;
}) {
    const visit = (overrides: Partial<Filters>) => {
        const next = { ...filters, ...overrides };
        router.get(
            '/admin/orders/reports',
            {
                status: next.status || undefined,
                type: next.type || undefined,
                against: next.against || undefined,
            },
            {
                preserveState: true,
                preserveScroll: true,
                replace: true,
                only: ['reports', 'filters'],
            },
        );
    };

    const columns: DataTableColumn<ReportRow>[] = [
        {
            key: 'order',
            label: 'Order',
            render: (report) => (
                <div>
                    <p className="font-medium">{report.order.order_number}</p>
                    <p className="text-muted-foreground text-xs">
                        {new Date(report.created_at).toLocaleString()}
                    </p>
                </div>
            ),
        },
        {
            key: 'against',
            label: 'Against',
            render: (report) => (
                <span className="capitalize">{report.against}</span>
            ),
        },
        {
            key: 'type',
            label: 'Type',
            render: (report) => (
                <span className="capitalize">
                    {report.type.replaceAll('_', ' ')}
                </span>
            ),
        },
        {
            key: 'status',
            label: 'Status',
            render: (report) => (
                <Badge
                    variant="outline"
                    className={cn('capitalize', statusStyle[report.status])}
                >
                    {report.status.replaceAll('_', ' ')}
                </Badge>
            ),
        },
        {
            key: 'reported_by',
            label: 'Reported by',
            render: (report) => report.reported_by.name,
        },
    ];

    return (
        <>
            <Head title="Order reports" />
            <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
                <div>
                    <h2 className="text-2xl font-semibold tracking-tight">
                        Order reports
                    </h2>
                    <p className="text-muted-foreground text-sm">
                        Review and resolve disputes raised against an order
                        party.
                    </p>
                </div>

                <div className="grid gap-3 rounded-xl border p-4 sm:grid-cols-3">
                    <Select
                        value={filters.status || 'all'}
                        onValueChange={(value) =>
                            visit({ status: value === 'all' ? '' : value })
                        }
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All statuses</SelectItem>
                            <SelectItem value="open">Open</SelectItem>
                            <SelectItem value="under_review">
                                Under review
                            </SelectItem>
                            <SelectItem value="resolved">Resolved</SelectItem>
                            <SelectItem value="rejected">Rejected</SelectItem>
                        </SelectContent>
                    </Select>
                    <Select
                        value={filters.type || 'all'}
                        onValueChange={(value) =>
                            visit({ type: value === 'all' ? '' : value })
                        }
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Report type" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">
                                All report types
                            </SelectItem>
                            {[
                                'missing_item',
                                'wrong_item',
                                'late_delivery',
                                'no_show_rider',
                                'rude_behavior',
                                'customer_unreachable',
                                'accident',
                                'other',
                            ].map((type) => (
                                <SelectItem key={type} value={type}>
                                    {type.replaceAll('_', ' ')}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Select
                        value={filters.against || 'all'}
                        onValueChange={(value) =>
                            visit({ against: value === 'all' ? '' : value })
                        }
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Against" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Against anyone</SelectItem>
                            <SelectItem value="restaurant">
                                Restaurant
                            </SelectItem>
                            <SelectItem value="rider">Rider</SelectItem>
                            <SelectItem value="customer">Customer</SelectItem>
                            <SelectItem value="platform">Platform</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <DataTable
                    columns={columns}
                    paginated={reports}
                    rowKey={(report) => report.id}
                    rowHref={(report) => `/admin/orders/reports/${report.id}`}
                    emptyMessage="No order reports match these filters."
                />
            </div>
        </>
    );
}

OrderReports.layout = { title: 'Order reports' };
