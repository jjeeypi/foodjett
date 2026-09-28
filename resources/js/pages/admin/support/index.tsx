import { Head, router } from '@inertiajs/react';
import DataTable, {
    type DataTableColumn,
    type PaginatedData,
} from '@/components/admin/data-table';
import { Badge } from '@/components/ui/badge';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

type TicketStatus = 'open' | 'in_progress' | 'closed';

type TicketRow = {
    id: number;
    customer: { name: string; email: string | null };
    subject: string;
    message: string;
    status: TicketStatus;
    created_at: string;
    update_url: string;
};

const statusLabels: Record<TicketStatus, string> = {
    open: 'Open',
    in_progress: 'In progress',
    closed: 'Closed',
};

const date = new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
});

export default function AdminSupport({
    tickets,
    filters,
}: {
    tickets: PaginatedData<TicketRow>;
    filters: { status: TicketStatus | null };
}) {
    const columns: DataTableColumn<TicketRow>[] = [
        {
            key: 'customer',
            label: 'Customer',
            render: (ticket) => (
                <div>
                    <p className="font-medium">{ticket.customer.name}</p>
                    <p className="text-muted-foreground text-xs">
                        {ticket.customer.email ?? 'Anonymized account'}
                    </p>
                </div>
            ),
        },
        {
            key: 'ticket',
            label: 'Ticket',
            render: (ticket) => (
                <div className="max-w-md">
                    <p className="font-medium">{ticket.subject}</p>
                    <p className="text-muted-foreground mt-1 line-clamp-2 text-xs">
                        {ticket.message}
                    </p>
                </div>
            ),
        },
        {
            key: 'created',
            label: 'Created',
            render: (ticket) => date.format(new Date(ticket.created_at)),
        },
        {
            key: 'status',
            label: 'Status',
            render: (ticket) => (
                <Badge
                    variant="outline"
                    className={cn(
                        ticket.status === 'open' && 'text-amber-700',
                        ticket.status === 'in_progress' && 'text-blue-700',
                        ticket.status === 'closed' && 'text-muted-foreground',
                    )}
                >
                    {statusLabels[ticket.status]}
                </Badge>
            ),
        },
        {
            key: 'action',
            label: 'Update',
            render: (ticket) => (
                <select
                    value={ticket.status}
                    onClick={(event) => event.stopPropagation()}
                    onChange={(event) =>
                        router.patch(
                            ticket.update_url,
                            { status: event.target.value },
                            { preserveScroll: true },
                        )
                    }
                    className="border-input bg-background h-9 rounded-md border px-2 text-sm"
                    aria-label={`Update ticket ${ticket.id} status`}
                >
                    <option value="open">Open</option>
                    <option value="in_progress">In progress</option>
                    <option value="closed">Closed</option>
                </select>
            ),
        },
    ];

    return (
        <>
            <Head title="Support tickets" />
            <div className="space-y-6 p-4 md:p-6">
                <div>
                    <h2 className="text-2xl font-semibold tracking-tight">
                        Support tickets
                    </h2>
                    <p className="text-muted-foreground mt-1 text-sm">
                        Review general customer support requests and update
                        their status.
                    </p>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Filters</CardTitle>
                        <CardDescription>
                            Narrow the queue by its current workflow status.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="max-w-xs space-y-2">
                        <Label htmlFor="support-status-filter">Status</Label>
                        <select
                            id="support-status-filter"
                            value={filters.status ?? ''}
                            onChange={(event) =>
                                router.get(
                                    '/admin/support',
                                    event.target.value
                                        ? { status: event.target.value }
                                        : {},
                                    { preserveState: true, replace: true },
                                )
                            }
                            className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm"
                        >
                            <option value="">All statuses</option>
                            <option value="open">Open</option>
                            <option value="in_progress">In progress</option>
                            <option value="closed">Closed</option>
                        </select>
                    </CardContent>
                </Card>

                <DataTable
                    columns={columns}
                    paginated={tickets}
                    rowKey={(ticket) => ticket.id}
                    emptyMessage="No support tickets match this filter."
                />
            </div>
        </>
    );
}

AdminSupport.layout = { title: 'Support tickets' };
