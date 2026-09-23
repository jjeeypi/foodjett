import { Head, Link } from '@inertiajs/react';
import { ArrowLeft, CheckCircle2, ExternalLink, X } from 'lucide-react';
import TextActionDialog from '@/components/admin/text-action-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type Report = {
    id: number;
    order_id: number;
    against: 'restaurant' | 'rider' | 'customer' | 'platform';
    type: string;
    description: string;
    status: 'open' | 'under_review' | 'resolved' | 'rejected';
    resolution: string | null;
    resolved_at: string | null;
    created_at: string;
    updated_at: string;
    reported_by: {
        name: string;
        email: string;
        role: string;
    };
    resolved_by_admin: { user: { name: string } } | null;
    order: {
        id: number;
        order_number: string;
        status: string;
        total_amount: string;
        restaurant: { name: string };
        customer: { user: { name: string } } | null;
        rider: { user: { name: string } } | null;
    };
};

const formatDate = (value: string | null) =>
    value ? new Date(value).toLocaleString() : '—';

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div>
            <dt className="text-muted-foreground text-xs">{label}</dt>
            <dd className="mt-1 text-sm break-words">{value || '—'}</dd>
        </div>
    );
}

export default function ReportShow({ report }: { report: Report }) {
    const closed = report.status === 'resolved' || report.status === 'rejected';

    return (
        <>
            <Head title={`Report #${report.id}`} />
            <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
                <div>
                    <Button variant="ghost" size="sm" className="mb-3" asChild>
                        <Link href="/admin/orders/reports">
                            <ArrowLeft /> Back to reports
                        </Link>
                    </Button>
                    <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                        <div>
                            <div className="flex flex-wrap items-center gap-2">
                                <h2 className="text-2xl font-semibold tracking-tight">
                                    Report #{report.id}
                                </h2>
                                <Badge variant="outline" className="capitalize">
                                    {report.status.replaceAll('_', ' ')}
                                </Badge>
                            </div>
                            <p className="text-muted-foreground mt-1 text-sm capitalize">
                                {report.type.replaceAll('_', ' ')} against{' '}
                                {report.against}
                            </p>
                        </div>
                        {!closed && (
                            <div className="flex flex-wrap gap-2">
                                <TextActionDialog
                                    action={`/admin/orders/reports/${report.id}/reject`}
                                    field="resolution"
                                    title="Reject this report"
                                    description="Explain why no corrective action will be taken."
                                    fieldLabel="Decision note"
                                    placeholder="State why this report is being rejected…"
                                    triggerLabel="Reject"
                                    submitLabel="Reject report"
                                    processingLabel="Rejecting…"
                                    variant="destructive"
                                    triggerIcon={<X />}
                                />
                                <TextActionDialog
                                    action={`/admin/orders/reports/${report.id}/resolve`}
                                    field="resolution"
                                    title="Resolve this report"
                                    description="Record the investigation outcome and any corrective action taken."
                                    fieldLabel="Resolution"
                                    placeholder="Describe how this report was resolved…"
                                    triggerLabel="Resolve"
                                    submitLabel="Resolve report"
                                    processingLabel="Resolving…"
                                    triggerIcon={<CheckCircle2 />}
                                />
                            </div>
                        )}
                    </div>
                </div>

                <div className="grid gap-6 lg:grid-cols-3">
                    <div className="space-y-6 lg:col-span-2">
                        <Card>
                            <CardHeader>
                                <CardTitle>Report</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-5">
                                <dl className="grid gap-5 sm:grid-cols-2">
                                    <Detail
                                        label="Reported by"
                                        value={`${report.reported_by.name} (${report.reported_by.role})`}
                                    />
                                    <Detail
                                        label="Reporter email"
                                        value={report.reported_by.email}
                                    />
                                    <Detail
                                        label="Against"
                                        value={report.against}
                                    />
                                    <Detail
                                        label="Type"
                                        value={report.type.replaceAll('_', ' ')}
                                    />
                                    <Detail
                                        label="Submitted"
                                        value={formatDate(report.created_at)}
                                    />
                                    <Detail
                                        label="Last updated"
                                        value={formatDate(report.updated_at)}
                                    />
                                </dl>
                                <div className="border-t pt-5">
                                    <p className="text-muted-foreground text-xs">
                                        Description
                                    </p>
                                    <p className="mt-2 text-sm whitespace-pre-wrap">
                                        {report.description}
                                    </p>
                                </div>
                            </CardContent>
                        </Card>

                        {report.resolution && (
                            <Card>
                                <CardHeader>
                                    <CardTitle>Decision</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <p className="text-sm whitespace-pre-wrap">
                                        {report.resolution}
                                    </p>
                                    <dl className="grid gap-4 border-t pt-4 sm:grid-cols-2">
                                        <Detail
                                            label="Handled by"
                                            value={
                                                report.resolved_by_admin?.user
                                                    .name || 'Administrator'
                                            }
                                        />
                                        <Detail
                                            label="Closed at"
                                            value={formatDate(
                                                report.resolved_at,
                                            )}
                                        />
                                    </dl>
                                </CardContent>
                            </Card>
                        )}
                    </div>

                    <aside>
                        <Card>
                            <CardHeader>
                                <CardTitle>Related order</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div>
                                    <p className="font-semibold">
                                        {report.order.order_number}
                                    </p>
                                    <p className="text-muted-foreground text-sm capitalize">
                                        {report.order.status.replaceAll(
                                            '_',
                                            ' ',
                                        )}
                                    </p>
                                </div>
                                <dl className="grid grid-cols-2 gap-4">
                                    <Detail
                                        label="Restaurant"
                                        value={report.order.restaurant.name}
                                    />
                                    <Detail
                                        label="Customer"
                                        value={
                                            report.order.customer?.user.name ||
                                            'Customer'
                                        }
                                    />
                                    <Detail
                                        label="Rider"
                                        value={
                                            report.order.rider?.user.name ||
                                            'Not assigned'
                                        }
                                    />
                                    <Detail
                                        label="Total"
                                        value={new Intl.NumberFormat('en-PH', {
                                            style: 'currency',
                                            currency: 'PHP',
                                        }).format(
                                            Number(report.order.total_amount),
                                        )}
                                    />
                                </dl>
                                <Button
                                    className="w-full"
                                    variant="outline"
                                    asChild
                                >
                                    <Link
                                        href={`/admin/orders/${report.order.id}`}
                                    >
                                        Open order <ExternalLink />
                                    </Link>
                                </Button>
                            </CardContent>
                        </Card>
                    </aside>
                </div>
            </div>
        </>
    );
}

ReportShow.layout = { title: 'Order report' };
