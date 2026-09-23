import { Head, Link, router } from '@inertiajs/react';
import {
    ArrowLeft,
    Bike,
    Check,
    Mail,
    MapPin,
    Phone,
    Power,
    ShieldBan,
    Star,
    WalletCards,
} from 'lucide-react';
import ApprovalStatusBadge, {
    type ApprovalStatus,
} from '@/components/admin/approval-status-badge';
import DocumentCard, {
    type ApprovalDocument,
} from '@/components/admin/document-card';
import RejectActionDialog from '@/components/admin/reject-action-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type RecentOrder = {
    id: number;
    order_number: string;
    status: string;
    total_amount: string;
    payment_method: string;
    placed_at: string;
    restaurant: { name: string };
    customer: { user: { name: string } } | null;
};

type Rider = {
    id: number;
    vehicle_type: string;
    plate_number: string | null;
    approval_status: Extract<
        ApprovalStatus,
        'pending' | 'approved' | 'rejected'
    >;
    rejection_reason: string | null;
    availability_status: 'offline' | 'available' | 'busy';
    current_latitude: number | null;
    current_longitude: number | null;
    last_location_at: string | null;
    cash_on_hand: string;
    cash_remit_limit: string;
    payout_method: 'bank' | 'ewallet' | null;
    reviews_avg_rating: number | string | null;
    user: {
        name: string;
        email: string;
        phone: string | null;
        status: 'active' | 'suspended' | 'banned';
    };
    documents: ApprovalDocument[];
    orders: RecentOrder[];
};

type Performance = {
    assigned_orders: number;
    delivered_orders: number;
    declined_offers: number;
    acceptance_rate: number | null;
    cancellation_rate: number | null;
};

const currency = new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
});

export default function RiderShow({
    rider,
    performance,
}: {
    rider: Rider;
    performance: Performance;
}) {
    const suspended = rider.user.status === 'suspended';
    const cashPercent = Math.min(
        100,
        (Number(rider.cash_on_hand) / Number(rider.cash_remit_limit || 1)) *
            100,
    );

    const approve = () => {
        router.patch(`/admin/riders/${rider.id}/approve`);
    };

    const toggleSuspension = () => {
        router.patch(
            `/admin/riders/${rider.id}/suspension`,
            { action: suspended ? 'reactivate' : 'suspend' },
            { preserveScroll: true },
        );
    };

    return (
        <>
            <Head title={rider.user.name} />
            <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
                <div>
                    <Button variant="ghost" size="sm" className="mb-3" asChild>
                        <Link href="/admin/riders">
                            <ArrowLeft /> Back to riders
                        </Link>
                    </Button>
                    <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                        <div>
                            <div className="flex flex-wrap items-center gap-2">
                                <h2 className="text-2xl font-semibold tracking-tight">
                                    {rider.user.name}
                                </h2>
                                <ApprovalStatusBadge
                                    status={rider.approval_status}
                                />
                                <Badge variant="outline" className="capitalize">
                                    Account {rider.user.status}
                                </Badge>
                            </div>
                            <p className="text-muted-foreground mt-1 text-sm capitalize">
                                {rider.vehicle_type.replace('_', ' ')}
                                {rider.plate_number
                                    ? ` · ${rider.plate_number}`
                                    : ''}
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {rider.approval_status === 'pending' && (
                                <>
                                    <RejectActionDialog
                                        action={`/admin/riders/${rider.id}/reject`}
                                        subjectName={rider.user.name}
                                        title="Reject rider application"
                                    />
                                    <Button onClick={approve}>
                                        <Check /> Approve
                                    </Button>
                                </>
                            )}
                            {rider.user.status !== 'banned' && (
                                <Button
                                    variant={
                                        suspended ? 'default' : 'destructive'
                                    }
                                    onClick={toggleSuspension}
                                >
                                    {suspended ? <Power /> : <ShieldBan />}
                                    {suspended ? 'Reactivate' : 'Suspend'}
                                </Button>
                            )}
                        </div>
                    </div>
                </div>

                {rider.rejection_reason && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
                        <p className="font-medium">
                            Application rejection reason
                        </p>
                        <p className="mt-1">{rider.rejection_reason}</p>
                    </div>
                )}

                <div className="grid gap-6 xl:grid-cols-3">
                    <div className="space-y-6 xl:col-span-2">
                        <Card>
                            <CardHeader>
                                <CardTitle>Profile</CardTitle>
                            </CardHeader>
                            <CardContent className="grid gap-5 text-sm sm:grid-cols-2">
                                <div className="space-y-3">
                                    <p className="flex items-center gap-2 break-all">
                                        <Mail className="text-muted-foreground size-4" />
                                        {rider.user.email}
                                    </p>
                                    <p className="flex items-center gap-2">
                                        <Phone className="text-muted-foreground size-4" />
                                        {rider.user.phone || 'No phone'}
                                    </p>
                                    <p className="flex items-center gap-2 capitalize">
                                        <Bike className="text-muted-foreground size-4" />
                                        {rider.vehicle_type.replace('_', ' ')}
                                        {rider.plate_number
                                            ? ` · ${rider.plate_number}`
                                            : ''}
                                    </p>
                                </div>
                                <dl className="grid grid-cols-2 gap-4">
                                    <div>
                                        <dt className="text-muted-foreground text-xs">
                                            Availability
                                        </dt>
                                        <dd className="mt-1 capitalize">
                                            {rider.availability_status}
                                        </dd>
                                    </div>
                                    <div>
                                        <dt className="text-muted-foreground text-xs">
                                            Payout method
                                        </dt>
                                        <dd className="mt-1 capitalize">
                                            {rider.payout_method ||
                                                'Not configured'}
                                        </dd>
                                    </div>
                                    <div className="col-span-2">
                                        <dt className="text-muted-foreground flex items-center gap-1 text-xs">
                                            <MapPin className="size-3" /> Last
                                            location
                                        </dt>
                                        <dd className="mt-1">
                                            {rider.current_latitude !== null &&
                                            rider.current_longitude !== null
                                                ? `${rider.current_latitude}, ${rider.current_longitude}`
                                                : 'No location reported'}
                                        </dd>
                                        {rider.last_location_at && (
                                            <dd className="text-muted-foreground text-xs">
                                                {new Date(
                                                    rider.last_location_at,
                                                ).toLocaleString()}
                                            </dd>
                                        )}
                                    </div>
                                </dl>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Documents</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {rider.documents.length > 0 ? (
                                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
                                    <p className="text-muted-foreground text-sm">
                                        No documents have been uploaded.
                                    </p>
                                )}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Delivery history</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {rider.orders.length > 0 ? (
                                    <div className="overflow-x-auto rounded-lg border">
                                        <table className="w-full text-left text-sm">
                                            <thead className="bg-muted/50 text-muted-foreground border-b text-xs uppercase">
                                                <tr>
                                                    <th className="px-3 py-2">
                                                        Order
                                                    </th>
                                                    <th className="px-3 py-2">
                                                        Restaurant
                                                    </th>
                                                    <th className="px-3 py-2">
                                                        Customer
                                                    </th>
                                                    <th className="px-3 py-2">
                                                        Status
                                                    </th>
                                                    <th className="px-3 py-2 text-right">
                                                        Total
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y">
                                                {rider.orders.map((order) => (
                                                    <tr key={order.id}>
                                                        <td className="px-3 py-2 font-medium">
                                                            {order.order_number}
                                                        </td>
                                                        <td className="px-3 py-2">
                                                            {
                                                                order.restaurant
                                                                    .name
                                                            }
                                                        </td>
                                                        <td className="px-3 py-2">
                                                            {order.customer
                                                                ?.user.name ||
                                                                'Customer'}
                                                        </td>
                                                        <td className="px-3 py-2 capitalize">
                                                            {order.status.replaceAll(
                                                                '_',
                                                                ' ',
                                                            )}
                                                        </td>
                                                        <td className="px-3 py-2 text-right tabular-nums">
                                                            {currency.format(
                                                                Number(
                                                                    order.total_amount,
                                                                ),
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <p className="text-muted-foreground text-sm">
                                        No assigned orders for this rider.
                                    </p>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    <aside className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <WalletCards className="size-5" /> COD cash
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="flex items-end justify-between gap-3">
                                    <div>
                                        <p className="text-2xl font-semibold">
                                            {currency.format(
                                                Number(rider.cash_on_hand),
                                            )}
                                        </p>
                                        <p className="text-muted-foreground text-xs">
                                            on hand
                                        </p>
                                    </div>
                                    <p className="text-muted-foreground text-sm">
                                        Limit{' '}
                                        {currency.format(
                                            Number(rider.cash_remit_limit),
                                        )}
                                    </p>
                                </div>
                                <div className="bg-muted h-2 overflow-hidden rounded-full">
                                    <div
                                        className="bg-primary h-full rounded-full"
                                        style={{ width: `${cashPercent}%` }}
                                    />
                                </div>
                                {Number(rider.cash_on_hand) >=
                                    Number(rider.cash_remit_limit) && (
                                    <p className="text-sm text-amber-700 dark:text-amber-300">
                                        COD acceptance is blocked until cash is
                                        remitted.
                                    </p>
                                )}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Performance</CardTitle>
                            </CardHeader>
                            <CardContent className="grid grid-cols-2 gap-3 text-center">
                                <div className="bg-muted rounded-lg p-3">
                                    <p className="text-2xl font-semibold">
                                        {performance.acceptance_rate === null
                                            ? '—'
                                            : `${performance.acceptance_rate}%`}
                                    </p>
                                    <p className="text-muted-foreground text-xs">
                                        Acceptance
                                    </p>
                                </div>
                                <div className="bg-muted rounded-lg p-3">
                                    <p className="text-2xl font-semibold">
                                        {performance.cancellation_rate === null
                                            ? '—'
                                            : `${performance.cancellation_rate}%`}
                                    </p>
                                    <p className="text-muted-foreground text-xs">
                                        Cancellation
                                    </p>
                                </div>
                                <div className="bg-muted rounded-lg p-3">
                                    <p className="text-2xl font-semibold">
                                        {performance.delivered_orders}
                                    </p>
                                    <p className="text-muted-foreground text-xs">
                                        Delivered
                                    </p>
                                </div>
                                <div className="bg-muted rounded-lg p-3">
                                    <p className="text-2xl font-semibold">
                                        {performance.declined_offers}
                                    </p>
                                    <p className="text-muted-foreground text-xs">
                                        Declined/expired
                                    </p>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Star className="size-5" /> Rating
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-3xl font-semibold">
                                    {rider.reviews_avg_rating === null
                                        ? '—'
                                        : Number(
                                              rider.reviews_avg_rating,
                                          ).toFixed(1)}
                                </p>
                                <p className="text-muted-foreground text-sm">
                                    {rider.reviews_avg_rating === null
                                        ? 'No reviews yet'
                                        : 'out of 5'}
                                </p>
                            </CardContent>
                        </Card>
                    </aside>
                </div>
            </div>
        </>
    );
}

RiderShow.layout = { title: 'Rider details' };
