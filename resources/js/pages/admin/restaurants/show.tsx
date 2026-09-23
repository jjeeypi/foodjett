import { Head, Link, router } from '@inertiajs/react';
import {
    ArrowLeft,
    Check,
    Clock3,
    ExternalLink,
    FileText,
    Mail,
    MapPin,
    Phone,
    Power,
    ShieldBan,
    Star,
    Utensils,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type RestaurantDocument = {
    id: number;
    type: string;
    file_path: string;
    status: 'pending' | 'verified' | 'rejected';
};

type MenuItem = {
    id: number;
    name: string;
    base_price: string;
    is_available: boolean;
};

type MenuCategory = {
    id: number;
    name: string;
    menu_items: MenuItem[];
};

type RecentOrder = {
    id: number;
    order_number: string;
    status: string;
    total_amount: string;
    payment_method: string;
    placed_at: string;
    customer: {
        user: { name: string } | null;
    } | null;
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
    approval_status: 'pending' | 'approved' | 'rejected';
    rejection_reason: string | null;
    operating_status: 'open' | 'closed' | 'temporarily_closed';
    reviews_avg_rating: number | string | null;
    created_at: string;
    user: {
        name: string;
        email: string;
        phone: string | null;
        status: 'active' | 'suspended' | 'banned';
        created_at: string;
    };
    documents: RestaurantDocument[];
    menu_categories: MenuCategory[];
    orders: RecentOrder[];
};

type PrepTimeAccuracy = {
    sample_size: number;
    on_time_count: number;
    percentage: number | null;
};

const currency = new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
});

const documentUrl = (path: string) =>
    path.startsWith('http') ? path : `/storage/${path.replace(/^\/+/, '')}`;

const isImage = (path: string) => /\.(jpe?g|png|gif|webp)$/i.test(path);

const statusClass = (status: string) => {
    if (
        ['approved', 'active', 'open', 'verified', 'delivered'].includes(status)
    ) {
        return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300';
    }

    if (['pending', 'placed', 'preparing', 'finding_rider'].includes(status)) {
        return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300';
    }

    return '';
};

export default function RestaurantShow({
    restaurant,
    prepTimeAccuracy,
}: {
    restaurant: Restaurant;
    prepTimeAccuracy: PrepTimeAccuracy;
}) {
    const suspended = restaurant.user.status !== 'active';

    const updateSuspension = () => {
        router.patch(
            `/admin/restaurants/${restaurant.id}/suspension`,
            { action: suspended ? 'reactivate' : 'suspend' },
            { preserveScroll: true },
        );
    };

    const approve = () => {
        router.patch(
            `/admin/restaurants/${restaurant.id}/approve`,
            {},
            { preserveScroll: true },
        );
    };

    return (
        <>
            <Head title={restaurant.name} />
            <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
                <div>
                    <Button variant="ghost" size="sm" className="mb-3" asChild>
                        <Link href="/admin/restaurants">
                            <ArrowLeft />
                            Back to restaurants
                        </Link>
                    </Button>
                    <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                        <div>
                            <div className="flex flex-wrap items-center gap-2">
                                <h2 className="text-2xl font-semibold tracking-tight">
                                    {restaurant.name}
                                </h2>
                                <Badge
                                    variant="outline"
                                    className={statusClass(
                                        restaurant.approval_status,
                                    )}
                                >
                                    {restaurant.approval_status}
                                </Badge>
                                <Badge
                                    variant="outline"
                                    className={statusClass(
                                        restaurant.user.status,
                                    )}
                                >
                                    Account {restaurant.user.status}
                                </Badge>
                            </div>
                            <p className="text-muted-foreground mt-1 text-sm">
                                {restaurant.cuisine_type ||
                                    'Cuisine not provided'}{' '}
                                · Member since{' '}
                                {new Date(
                                    restaurant.created_at,
                                ).toLocaleDateString()}
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {restaurant.approval_status === 'pending' && (
                                <Button onClick={approve}>
                                    <Check />
                                    Approve
                                </Button>
                            )}
                            <Button
                                variant={suspended ? 'default' : 'destructive'}
                                onClick={updateSuspension}
                            >
                                {suspended ? <Power /> : <ShieldBan />}
                                {suspended
                                    ? 'Reactivate account'
                                    : 'Suspend account'}
                            </Button>
                        </div>
                    </div>
                </div>

                {restaurant.rejection_reason && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
                        <p className="font-medium">Rejection reason</p>
                        <p className="mt-1">{restaurant.rejection_reason}</p>
                    </div>
                )}

                <div className="grid gap-6 xl:grid-cols-3">
                    <div className="space-y-6 xl:col-span-2">
                        <Card>
                            <CardHeader>
                                <CardTitle>Restaurant profile</CardTitle>
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
                                    <div className="flex items-center gap-2">
                                        <Mail className="text-muted-foreground size-4" />
                                        <span className="break-all">
                                            {restaurant.user.email}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Phone className="text-muted-foreground size-4" />
                                        <span>
                                            {restaurant.user.phone ||
                                                'No phone'}
                                        </span>
                                    </div>
                                    <div className="flex items-start gap-2">
                                        <MapPin className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                                        <span>{restaurant.address}</span>
                                    </div>
                                </div>
                                <dl className="grid grid-cols-2 gap-4">
                                    <div>
                                        <dt className="text-muted-foreground text-xs">
                                            Operating status
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
                                            Default prep time
                                        </dt>
                                        <dd className="mt-1">
                                            {
                                                restaurant.default_prep_time_minutes
                                            }{' '}
                                            min
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
                                            Commission
                                        </dt>
                                        <dd className="mt-1">
                                            {Number(
                                                restaurant.commission_rate,
                                            ).toFixed(2)}
                                            %
                                        </dd>
                                    </div>
                                    <div className="col-span-2">
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
                                <CardTitle className="flex items-center gap-2">
                                    <FileText className="size-5" />
                                    Documents
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                {restaurant.documents.length > 0 ? (
                                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                        {restaurant.documents.map(
                                            (document) => (
                                                <a
                                                    key={document.id}
                                                    href={documentUrl(
                                                        document.file_path,
                                                    )}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="hover:bg-muted/50 overflow-hidden rounded-lg border transition-colors"
                                                >
                                                    {isImage(
                                                        document.file_path,
                                                    ) ? (
                                                        <img
                                                            src={documentUrl(
                                                                document.file_path,
                                                            )}
                                                            alt={document.type.replace(
                                                                '_',
                                                                ' ',
                                                            )}
                                                            className="h-32 w-full object-cover"
                                                        />
                                                    ) : (
                                                        <div className="bg-muted flex h-32 items-center justify-center">
                                                            <FileText className="text-muted-foreground size-8" />
                                                        </div>
                                                    )}
                                                    <div className="flex items-center justify-between gap-3 p-3">
                                                        <div>
                                                            <p className="text-sm font-medium capitalize">
                                                                {document.type.replaceAll(
                                                                    '_',
                                                                    ' ',
                                                                )}
                                                            </p>
                                                            <p className="text-muted-foreground text-xs capitalize">
                                                                {
                                                                    document.status
                                                                }
                                                            </p>
                                                        </div>
                                                        <ExternalLink className="size-4" />
                                                    </div>
                                                </a>
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
                                <CardTitle className="flex items-center gap-2">
                                    <Utensils className="size-5" />
                                    Menu preview
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-5">
                                {restaurant.menu_categories.length > 0 ? (
                                    restaurant.menu_categories.map(
                                        (category) => (
                                            <div key={category.id}>
                                                <h3 className="mb-2 text-sm font-semibold">
                                                    {category.name}
                                                </h3>
                                                <div className="divide-y rounded-lg border">
                                                    {category.menu_items.map(
                                                        (item) => (
                                                            <div
                                                                key={item.id}
                                                                className="flex items-center justify-between gap-4 px-3 py-2 text-sm"
                                                            >
                                                                <span>
                                                                    {item.name}
                                                                    {!item.is_available && (
                                                                        <span className="text-muted-foreground ml-2 text-xs">
                                                                            Unavailable
                                                                        </span>
                                                                    )}
                                                                </span>
                                                                <span className="tabular-nums">
                                                                    {currency.format(
                                                                        Number(
                                                                            item.base_price,
                                                                        ),
                                                                    )}
                                                                </span>
                                                            </div>
                                                        ),
                                                    )}
                                                    {category.menu_items
                                                        .length === 0 && (
                                                        <p className="text-muted-foreground px-3 py-4 text-sm">
                                                            No menu items in
                                                            this category.
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        ),
                                    )
                                ) : (
                                    <p className="text-muted-foreground text-sm">
                                        This restaurant has not created a menu
                                        yet.
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
                                                                    ?.name ||
                                                                    'Customer'}
                                                            </td>
                                                            <td className="px-3 py-2">
                                                                <Badge
                                                                    variant="outline"
                                                                    className={statusClass(
                                                                        order.status,
                                                                    )}
                                                                >
                                                                    {order.status.replaceAll(
                                                                        '_',
                                                                        ' ',
                                                                    )}
                                                                </Badge>
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
                                        No orders have been placed with this
                                        restaurant.
                                    </p>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    <div className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Star className="size-5" />
                                    Rating
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
                                    <Clock3 className="size-5" />
                                    Prep-time accuracy
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-3xl font-semibold">
                                    {prepTimeAccuracy.percentage === null
                                        ? '—'
                                        : `${prepTimeAccuracy.percentage}%`}
                                </p>
                                <p className="text-muted-foreground mt-1 text-sm">
                                    {prepTimeAccuracy.sample_size === 0
                                        ? 'No completed prep-time samples yet.'
                                        : `${prepTimeAccuracy.on_time_count} of ${prepTimeAccuracy.sample_size} orders ready by the estimate.`}
                                </p>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </>
    );
}

RestaurantShow.layout = {
    title: 'Restaurant details',
};
