import { Head, Link, router, useForm } from '@inertiajs/react';
import {
    ArrowLeft,
    Check,
    Clock3,
    Mail,
    MapPin,
    Phone,
    Power,
    ShieldBan,
    Star,
    Utensils,
} from 'lucide-react';
import ApprovalStatusBadge, {
    type ApprovalStatus,
} from '@/components/admin/approval-status-badge';
import DocumentCard, {
    type ApprovalDocument,
} from '@/components/admin/document-card';
import InputError from '@/components/input-error';
import RejectActionDialog from '@/components/admin/reject-action-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type OperatingHour = {
    id: number;
    day_of_week: number;
    opens_at: string;
    closes_at: string;
};

type MenuCategory = {
    id: number;
    name: string;
    menu_items_count: number;
};

type RecentOrder = {
    id: number;
    order_number: string;
    status: string;
    total_amount: string;
    payment_method: string;
    placed_at: string;
    customer: { user: { name: string } } | null;
};

type Restaurant = {
    id: number;
    name: string;
    description: string | null;
    cuisine_type: string | null;
    address: string;
    latitude: number;
    longitude: number;
    default_prep_time_minutes: number;
    min_order_amount: string;
    commission_rate: string;
    approval_status: Extract<
        ApprovalStatus,
        'pending' | 'approved' | 'rejected'
    >;
    rejection_reason: string | null;
    operating_status: 'open' | 'closed' | 'temporarily_closed';
    reviews_avg_rating: number | string | null;
    created_at: string;
    user: {
        name: string;
        email: string;
        phone: string | null;
        status: 'active' | 'suspended' | 'banned';
    };
    documents: ApprovalDocument[];
    operating_hours: OperatingHour[];
    menu_categories: MenuCategory[];
    orders: RecentOrder[];
};

type Props = {
    restaurant: Restaurant;
    menuSummary: { category_count: number; item_count: number };
    prepTimeAccuracy: {
        sample_size: number;
        on_time_count: number;
        on_time_percentage: number | null;
        average_variance_minutes: number | null;
    };
};

const currency = new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
});

const dayNames = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
];

const formatTime = (time: string) =>
    new Date(`2000-01-01T${time}`).toLocaleTimeString([], {
        hour: 'numeric',
        minute: '2-digit',
    });

export default function RestaurantShow({
    restaurant,
    menuSummary,
    prepTimeAccuracy,
}: Props) {
    const suspended = restaurant.user.status === 'suspended';
    const commissionForm = useForm({
        commission_rate: restaurant.commission_rate,
    });

    const approve = () => {
        router.patch(`/admin/restaurants/${restaurant.id}/approve`);
    };

    const toggleSuspension = () => {
        router.patch(
            `/admin/restaurants/${restaurant.id}/suspension`,
            { action: suspended ? 'reactivate' : 'suspend' },
            { preserveScroll: true },
        );
    };

    const updateCommission = () => {
        commissionForm.patch(`/admin/restaurants/${restaurant.id}/commission`, {
            preserveScroll: true,
        });
    };

    return (
        <>
            <Head title={restaurant.name} />
            <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
                <div>
                    <Button variant="ghost" size="sm" className="mb-3" asChild>
                        <Link href="/admin/restaurants">
                            <ArrowLeft /> Back to restaurants
                        </Link>
                    </Button>
                    <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                        <div>
                            <div className="flex flex-wrap items-center gap-2">
                                <h2 className="text-2xl font-semibold tracking-tight">
                                    {restaurant.name}
                                </h2>
                                <ApprovalStatusBadge
                                    status={restaurant.approval_status}
                                />
                                <Badge variant="outline" className="capitalize">
                                    Account {restaurant.user.status}
                                </Badge>
                            </div>
                            <p className="text-muted-foreground mt-1 text-sm">
                                {restaurant.cuisine_type ||
                                    'Cuisine not provided'}
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {restaurant.approval_status === 'pending' && (
                                <>
                                    <RejectActionDialog
                                        action={`/admin/restaurants/${restaurant.id}/reject`}
                                        subjectName={restaurant.name}
                                        title="Reject restaurant application"
                                    />
                                    <Button onClick={approve}>
                                        <Check /> Approve
                                    </Button>
                                </>
                            )}
                            {restaurant.user.status !== 'banned' && (
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

                {restaurant.rejection_reason && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
                        <p className="font-medium">
                            Application rejection reason
                        </p>
                        <p className="mt-1">{restaurant.rejection_reason}</p>
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
                                    <div>
                                        <p className="text-muted-foreground text-xs">
                                            Owner
                                        </p>
                                        <p className="font-medium">
                                            {restaurant.user.name}
                                        </p>
                                    </div>
                                    <p className="flex items-center gap-2 break-all">
                                        <Mail className="text-muted-foreground size-4" />
                                        {restaurant.user.email}
                                    </p>
                                    <p className="flex items-center gap-2">
                                        <Phone className="text-muted-foreground size-4" />
                                        {restaurant.user.phone || 'No phone'}
                                    </p>
                                    <p className="flex items-start gap-2">
                                        <MapPin className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                                        {restaurant.address}
                                    </p>
                                </div>
                                <dl className="grid grid-cols-2 gap-4">
                                    <div>
                                        <dt className="text-muted-foreground text-xs">
                                            Operating
                                        </dt>
                                        <dd className="mt-1 capitalize">
                                            {restaurant.operating_status.replace(
                                                '_',
                                                ' ',
                                            )}
                                        </dd>
                                    </div>
                                    <div>
                                        <dt className="text-muted-foreground text-xs">
                                            Default prep
                                        </dt>
                                        <dd className="mt-1">
                                            {
                                                restaurant.default_prep_time_minutes
                                            }{' '}
                                            minutes
                                        </dd>
                                    </div>
                                    <div>
                                        <dt className="text-muted-foreground text-xs">
                                            Minimum order
                                        </dt>
                                        <dd className="mt-1">
                                            {currency.format(
                                                Number(
                                                    restaurant.min_order_amount,
                                                ),
                                            )}
                                        </dd>
                                    </div>
                                    <div>
                                        <dt className="text-muted-foreground text-xs">
                                            Coordinates
                                        </dt>
                                        <dd className="mt-1 font-mono text-xs">
                                            {restaurant.latitude},{' '}
                                            {restaurant.longitude}
                                        </dd>
                                    </div>
                                </dl>
                                {restaurant.description && (
                                    <p className="text-muted-foreground sm:col-span-2">
                                        {restaurant.description}
                                    </p>
                                )}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Documents</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {restaurant.documents.length > 0 ? (
                                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
                                    <p className="text-muted-foreground text-sm">
                                        No documents have been uploaded.
                                    </p>
                                )}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Operating hours</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {restaurant.operating_hours.length > 0 ? (
                                    <div className="divide-y rounded-lg border">
                                        {restaurant.operating_hours.map(
                                            (hour) => (
                                                <div
                                                    key={hour.id}
                                                    className="flex justify-between gap-4 px-3 py-2 text-sm"
                                                >
                                                    <span>
                                                        {
                                                            dayNames[
                                                                hour.day_of_week
                                                            ]
                                                        }
                                                    </span>
                                                    <span className="text-muted-foreground">
                                                        {formatTime(
                                                            hour.opens_at,
                                                        )}{' '}
                                                        –{' '}
                                                        {formatTime(
                                                            hour.closes_at,
                                                        )}
                                                    </span>
                                                </div>
                                            ),
                                        )}
                                    </div>
                                ) : (
                                    <p className="text-muted-foreground text-sm">
                                        No operating hours configured.
                                    </p>
                                )}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Recent orders</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {restaurant.orders.length > 0 ? (
                                    <div className="overflow-x-auto rounded-lg border">
                                        <table className="w-full text-left text-sm">
                                            <thead className="bg-muted/50 text-muted-foreground border-b text-xs uppercase">
                                                <tr>
                                                    <th className="px-3 py-2">
                                                        Order
                                                    </th>
                                                    <th className="px-3 py-2">
                                                        Customer
                                                    </th>
                                                    <th className="px-3 py-2">
                                                        Status
                                                    </th>
                                                    <th className="px-3 py-2">
                                                        Payment
                                                    </th>
                                                    <th className="px-3 py-2 text-right">
                                                        Total
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y">
                                                {restaurant.orders.map(
                                                    (order) => (
                                                        <tr key={order.id}>
                                                            <td className="px-3 py-2 font-medium">
                                                                {
                                                                    order.order_number
                                                                }
                                                            </td>
                                                            <td className="px-3 py-2">
                                                                {order.customer
                                                                    ?.user
                                                                    .name ||
                                                                    'Customer'}
                                                            </td>
                                                            <td className="px-3 py-2 capitalize">
                                                                {order.status.replaceAll(
                                                                    '_',
                                                                    ' ',
                                                                )}
                                                            </td>
                                                            <td className="px-3 py-2 uppercase">
                                                                {
                                                                    order.payment_method
                                                                }
                                                            </td>
                                                            <td className="px-3 py-2 text-right tabular-nums">
                                                                {currency.format(
                                                                    Number(
                                                                        order.total_amount,
                                                                    ),
                                                                )}
                                                            </td>
                                                        </tr>
                                                    ),
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <p className="text-muted-foreground text-sm">
                                        No orders for this restaurant.
                                    </p>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    <aside className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Commission rate</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <form
                                    className="space-y-3"
                                    onSubmit={(event) => {
                                        event.preventDefault();
                                        updateCommission();
                                    }}
                                >
                                    <Label htmlFor="commission-rate">
                                        Platform commission (%)
                                    </Label>
                                    <div className="flex gap-2">
                                        <Input
                                            id="commission-rate"
                                            type="number"
                                            min="0"
                                            max="100"
                                            step="0.01"
                                            value={
                                                commissionForm.data
                                                    .commission_rate
                                            }
                                            onChange={(event) =>
                                                commissionForm.setData(
                                                    'commission_rate',
                                                    event.target.value,
                                                )
                                            }
                                        />
                                        <Button
                                            type="submit"
                                            disabled={commissionForm.processing}
                                        >
                                            Save
                                        </Button>
                                    </div>
                                    <InputError
                                        message={
                                            commissionForm.errors
                                                .commission_rate
                                        }
                                    />
                                </form>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Utensils className="size-5" /> Menu
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="grid grid-cols-2 gap-3 text-center">
                                    <div className="bg-muted rounded-lg p-3">
                                        <p className="text-2xl font-semibold">
                                            {menuSummary.category_count}
                                        </p>
                                        <p className="text-muted-foreground text-xs">
                                            Categories
                                        </p>
                                    </div>
                                    <div className="bg-muted rounded-lg p-3">
                                        <p className="text-2xl font-semibold">
                                            {menuSummary.item_count}
                                        </p>
                                        <p className="text-muted-foreground text-xs">
                                            Items
                                        </p>
                                    </div>
                                </div>
                                {restaurant.menu_categories.map((category) => (
                                    <div
                                        key={category.id}
                                        className="flex justify-between gap-3 text-sm"
                                    >
                                        <span>{category.name}</span>
                                        <span className="text-muted-foreground">
                                            {category.menu_items_count}
                                        </span>
                                    </div>
                                ))}
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
                                    {restaurant.reviews_avg_rating === null
                                        ? '—'
                                        : Number(
                                              restaurant.reviews_avg_rating,
                                          ).toFixed(1)}
                                </p>
                                <p className="text-muted-foreground text-sm">
                                    {restaurant.reviews_avg_rating === null
                                        ? 'No reviews yet'
                                        : 'out of 5'}
                                </p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Clock3 className="size-5" /> Prep accuracy
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                <p className="text-3xl font-semibold">
                                    {prepTimeAccuracy.on_time_percentage ===
                                    null
                                        ? '—'
                                        : `${prepTimeAccuracy.on_time_percentage}%`}
                                </p>
                                <p className="text-muted-foreground text-sm">
                                    {prepTimeAccuracy.sample_size === 0
                                        ? 'No completed prep samples.'
                                        : `${prepTimeAccuracy.on_time_count} of ${prepTimeAccuracy.sample_size} ready by the estimate.`}
                                </p>
                                {prepTimeAccuracy.average_variance_minutes !==
                                    null && (
                                    <p className="text-sm">
                                        Average:{' '}
                                        {prepTimeAccuracy.average_variance_minutes >
                                        0
                                            ? `${prepTimeAccuracy.average_variance_minutes} min late`
                                            : prepTimeAccuracy.average_variance_minutes <
                                                0
                                              ? `${Math.abs(prepTimeAccuracy.average_variance_minutes)} min early`
                                              : 'on time'}
                                    </p>
                                )}
                            </CardContent>
                        </Card>
                    </aside>
                </div>
            </div>
        </>
    );
}

RestaurantShow.layout = { title: 'Restaurant details' };
