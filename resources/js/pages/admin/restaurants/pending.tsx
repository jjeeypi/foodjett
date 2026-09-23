import { Head, Link, router } from '@inertiajs/react';
import { Check, MapPin } from 'lucide-react';
import { useState } from 'react';
import ApprovalStatusBadge from '@/components/admin/approval-status-badge';
import { Pagination, type PaginatedData } from '@/components/admin/data-table';
import DocumentCard, {
    type ApprovalDocument,
} from '@/components/admin/document-card';
import RejectActionDialog from '@/components/admin/reject-action-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type PendingRestaurant = {
    id: number;
    name: string;
    cuisine_type: string | null;
    address: string;
    approval_status: 'pending';
    user: { name: string; email: string; phone: string | null };
    documents: ApprovalDocument[];
};

export default function PendingRestaurants({
    restaurants,
}: {
    restaurants: PaginatedData<PendingRestaurant>;
}) {
    const [approvingId, setApprovingId] = useState<number | null>(null);

    const approve = (restaurant: PendingRestaurant) => {
        setApprovingId(restaurant.id);
        router.patch(
            `/admin/restaurants/${restaurant.id}/approve`,
            {},
            {
                preserveScroll: true,
                onFinish: () => setApprovingId(null),
            },
        );
    };

    return (
        <>
            <Head title="Pending restaurant approvals" />
            <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
                    <div>
                        <h2 className="text-2xl font-semibold tracking-tight">
                            Pending restaurant approvals
                        </h2>
                        <p className="text-muted-foreground text-sm">
                            Review the oldest applications first.
                        </p>
                    </div>
                    <Button variant="outline" asChild>
                        <Link href="/admin/restaurants">All restaurants</Link>
                    </Button>
                </div>

                <div className="grid gap-5 xl:grid-cols-2">
                    {restaurants.data.map((restaurant) => (
                        <Card key={restaurant.id}>
                            <CardHeader>
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <CardTitle>{restaurant.name}</CardTitle>
                                        <p className="text-muted-foreground mt-1 text-sm">
                                            {restaurant.cuisine_type ||
                                                'Cuisine not provided'}
                                        </p>
                                    </div>
                                    <ApprovalStatusBadge status="pending" />
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-5">
                                <div className="grid gap-4 text-sm sm:grid-cols-2">
                                    <div>
                                        <p className="text-muted-foreground text-xs">
                                            Owner
                                        </p>
                                        <p className="font-medium">
                                            {restaurant.user.name}
                                        </p>
                                        <p className="text-muted-foreground break-all">
                                            {restaurant.user.email}
                                        </p>
                                        <p className="text-muted-foreground">
                                            {restaurant.user.phone ||
                                                'No phone'}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-muted-foreground flex items-center gap-1 text-xs">
                                            <MapPin className="size-3" />{' '}
                                            Address
                                        </p>
                                        <p>{restaurant.address}</p>
                                    </div>
                                </div>

                                <div>
                                    <p className="mb-3 text-sm font-medium">
                                        Submitted documents
                                    </p>
                                    {restaurant.documents.length > 0 ? (
                                        <div className="grid gap-3 sm:grid-cols-2">
                                            {restaurant.documents.map(
                                                (document) => (
                                                    <DocumentCard
                                                        key={document.id}
                                                        document={document}
                                                        verifyUrl={`/admin/restaurants/${restaurant.id}/documents/${document.id}/verify`}
                                                        rejectUrl={`/admin/restaurants/${restaurant.id}/documents/${document.id}/reject`}
                                                    />
                                                ),
                                            )}
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
                                            href={`/admin/restaurants/${restaurant.id}`}
                                        >
                                            Full details
                                        </Link>
                                    </Button>
                                    <RejectActionDialog
                                        action={`/admin/restaurants/${restaurant.id}/reject`}
                                        subjectName={restaurant.name}
                                        title="Reject restaurant application"
                                        description={`Explain what ${restaurant.name} needs to correct before approval.`}
                                    />
                                    <Button
                                        onClick={() => approve(restaurant)}
                                        disabled={approvingId === restaurant.id}
                                    >
                                        <Check />
                                        {approvingId === restaurant.id
                                            ? 'Approving…'
                                            : 'Approve'}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {restaurants.data.length === 0 && (
                    <Card>
                        <CardContent className="text-muted-foreground py-12 text-center text-sm">
                            There are no pending restaurant applications.
                        </CardContent>
                    </Card>
                )}

                <div className="overflow-hidden rounded-xl border">
                    <Pagination paginated={restaurants} />
                </div>
            </div>
        </>
    );
}

PendingRestaurants.layout = { title: 'Pending restaurant approvals' };
