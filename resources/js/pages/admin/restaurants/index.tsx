import { Head, Link, router } from '@inertiajs/react';
import { Eye, Search } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
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

type Restaurant = {
    id: number;
    name: string;
    cuisine_type: string | null;
    approval_status: 'pending' | 'approved' | 'rejected';
    operating_status: 'open' | 'closed' | 'temporarily_closed';
    reviews_avg_rating: number | string | null;
    user: {
        name: string;
        email: string;
        status: 'active' | 'suspended' | 'banned';
    };
};

type Props = {
    restaurants: PaginatedData<Restaurant>;
    filters: {
        search: string;
        approval_status: string;
    };
};

const statusClass = (status: string) => {
    if (status === 'approved' || status === 'open' || status === 'active') {
        return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300';
    }

    if (status === 'pending') {
        return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300';
    }

    return 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300';
};

export default function RestaurantsIndex({ restaurants, filters }: Props) {
    const [search, setSearch] = useState(filters.search);
    const [approvalStatus, setApprovalStatus] = useState(
        filters.approval_status || 'all',
    );
    const isFirstSearchRender = useRef(true);

    const visit = (nextSearch: string, nextStatus: string) => {
        router.get(
            '/admin/restaurants',
            {
                search: nextSearch || undefined,
                approval_status: nextStatus === 'all' ? undefined : nextStatus,
            },
            {
                preserveState: true,
                preserveScroll: true,
                replace: true,
                only: ['restaurants', 'filters'],
            },
        );
    };

    useEffect(() => {
        if (isFirstSearchRender.current) {
            isFirstSearchRender.current = false;

            return;
        }

        const timeout = window.setTimeout(() => {
            visit(search, approvalStatus);
        }, 350);

        return () => window.clearTimeout(timeout);
        // The status is submitted immediately by its change handler.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search]);

    const columns: DataTableColumn<Restaurant>[] = [
        {
            key: 'name',
            label: 'Restaurant',
            render: (restaurant) => (
                <div>
                    <p className="font-medium">{restaurant.name}</p>
                    <p className="text-muted-foreground text-xs">
                        {restaurant.user.email}
                    </p>
                </div>
            ),
        },
        {
            key: 'cuisine',
            label: 'Cuisine',
            render: (restaurant) => restaurant.cuisine_type || '—',
        },
        {
            key: 'approval',
            label: 'Approval',
            render: (restaurant) => (
                <Badge
                    variant="outline"
                    className={statusClass(restaurant.approval_status)}
                >
                    {restaurant.approval_status}
                </Badge>
            ),
        },
        {
            key: 'operating',
            label: 'Operating',
            render: (restaurant) => (
                <Badge
                    variant="outline"
                    className={statusClass(restaurant.operating_status)}
                >
                    {restaurant.operating_status.replace('_', ' ')}
                </Badge>
            ),
        },
        {
            key: 'rating',
            label: 'Rating',
            render: (restaurant) =>
                restaurant.reviews_avg_rating === null
                    ? 'No reviews'
                    : `${Number(restaurant.reviews_avg_rating).toFixed(1)} / 5`,
        },
        {
            key: 'actions',
            label: '',
            className: 'text-right',
            render: (restaurant) => (
                <Button variant="outline" size="sm" asChild>
                    <Link href={`/admin/restaurants/${restaurant.id}`}>
                        <Eye />
                        View
                    </Link>
                </Button>
            ),
        },
    ];

    return (
        <>
            <Head title="Restaurants" />
            <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
                    <div>
                        <h2 className="text-2xl font-semibold tracking-tight">
                            Restaurants
                        </h2>
                        <p className="text-muted-foreground text-sm">
                            Review restaurant accounts, approval, and operating
                            status.
                        </p>
                    </div>
                    <Button variant="outline" asChild>
                        <Link href="/admin/restaurants/pending">
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
                            placeholder="Search restaurant, owner, or email…"
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
                    paginated={restaurants}
                    rowKey={(restaurant) => restaurant.id}
                    emptyMessage="No restaurants match these filters."
                />
            </div>
        </>
    );
}

RestaurantsIndex.layout = {
    title: 'Restaurants',
};
