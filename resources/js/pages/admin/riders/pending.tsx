import { Head, Link, router } from '@inertiajs/react';
import { Bike, Check } from 'lucide-react';
import { useState } from 'react';
import ApprovalStatusBadge from '@/components/admin/approval-status-badge';
import { Pagination, type PaginatedData } from '@/components/admin/data-table';
import DocumentCard, {
    type ApprovalDocument,
} from '@/components/admin/document-card';
import RejectActionDialog from '@/components/admin/reject-action-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type PendingRider = {
    id: number;
    vehicle_type: string;
    plate_number: string | null;
    approval_status: 'pending';
    user: { name: string; email: string; phone: string | null };
    documents: ApprovalDocument[];
};

export default function PendingRiders({
    riders,
}: {
    riders: PaginatedData<PendingRider>;
}) {
    const [approvingId, setApprovingId] = useState<number | null>(null);

    const approve = (rider: PendingRider) => {
        setApprovingId(rider.id);
        router.patch(
            `/admin/riders/${rider.id}/approve`,
            {},
            {
                preserveScroll: true,
                onFinish: () => setApprovingId(null),
            },
        );
    };

    return (
        <>
            <Head title="Pending rider approvals" />
            <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
                    <div>
                        <h2 className="text-2xl font-semibold tracking-tight">
                            Pending rider approvals
                        </h2>
                        <p className="text-muted-foreground text-sm">
                            Review identity, licence, and vehicle documents.
                        </p>
                    </div>
                    <Button variant="outline" asChild>
                        <Link href="/admin/riders">All riders</Link>
                    </Button>
                </div>

                <div className="grid gap-5 xl:grid-cols-2">
                    {riders.data.map((rider) => (
                        <Card key={rider.id}>
                            <CardHeader>
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <CardTitle>{rider.user.name}</CardTitle>
                                        <p className="text-muted-foreground mt-1 flex items-center gap-1 text-sm capitalize">
                                            <Bike className="size-4" />
                                            {rider.vehicle_type.replace(
                                                '_',
                                                ' ',
                                            )}
                                            {rider.plate_number
                                                ? ` · ${rider.plate_number}`
                                                : ''}
                                        </p>
                                    </div>
                                    <ApprovalStatusBadge status="pending" />
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-5">
                                <div className="text-sm">
                                    <p className="font-medium">
                                        {rider.user.name}
                                    </p>
                                    <p className="text-muted-foreground break-all">
                                        {rider.user.email}
                                    </p>
                                    <p className="text-muted-foreground">
                                        {rider.user.phone || 'No phone'}
                                    </p>
                                </div>

                                <div>
                                    <p className="mb-3 text-sm font-medium">
                                        Submitted documents
                                    </p>
                                    {rider.documents.length > 0 ? (
                                        <div className="grid gap-3 sm:grid-cols-2">
                                            {rider.documents.map((document) => (
                                                <DocumentCard
                                                    key={document.id}
                                                    document={document}
                                                    verifyUrl={`/admin/riders/${rider.id}/documents/${document.id}/verify`}
                                                    rejectUrl={`/admin/riders/${rider.id}/documents/${document.id}/reject`}
                                                />
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
                                            No documents have been uploaded.
                                        </p>
                                    )}
                                </div>

                                <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
                                    <Button variant="outline" asChild>
                                        <Link
                                            href={`/admin/riders/${rider.id}`}
                                        >
                                            Full details
                                        </Link>
                                    </Button>
                                    <RejectActionDialog
                                        action={`/admin/riders/${rider.id}/reject`}
                                        subjectName={rider.user.name}
                                        title="Reject rider application"
                                        description={`Explain what ${rider.user.name} needs to correct before approval.`}
                                    />
                                    <Button
                                        onClick={() => approve(rider)}
                                        disabled={approvingId === rider.id}
                                    >
                                        <Check />
                                        {approvingId === rider.id
                                            ? 'Approving…'
                                            : 'Approve'}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {riders.data.length === 0 && (
                    <Card>
                        <CardContent className="text-muted-foreground py-12 text-center text-sm">
                            There are no pending rider applications.
                        </CardContent>
                    </Card>
                )}

                <div className="overflow-hidden rounded-xl border">
                    <Pagination paginated={riders} />
                </div>
            </div>
        </>
    );
}

PendingRiders.layout = { title: 'Pending rider approvals' };
