import { Head, Link, router } from '@inertiajs/react';
import { ImageIcon, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import DataTable, {
    type DataTableColumn,
    type PaginatedData,
} from '@/components/admin/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

type MenuItem = {
    id: number;
    name: string;
    photo_url: string | null;
    base_price: string;
    is_available: boolean;
    is_featured: boolean;
    available_from: string | null;
    available_until: string | null;
    category: { id: number; name: string };
};

type Filters = { search: string; category_id: string; availability: string };

const currency = new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
});

export default function MenuItems({
    items,
    categories,
    filters,
}: {
    items: PaginatedData<MenuItem>;
    categories: { id: number; name: string }[];
    filters: Filters;
}) {
    const [search, setSearch] = useState(filters.search);
    const [categoryId, setCategoryId] = useState(filters.category_id || 'all');
    const [availability, setAvailability] = useState(
        filters.availability || 'all',
    );
    const [busyId, setBusyId] = useState<number | null>(null);
    const [deleting, setDeleting] = useState<MenuItem | null>(null);
    const firstRender = useRef(true);

    const visit = (overrides: Partial<Filters> = {}) => {
        const next = {
            search,
            category_id: categoryId === 'all' ? '' : categoryId,
            availability: availability === 'all' ? '' : availability,
            ...overrides,
        };
        router.get(
            '/restaurant/menu/items',
            {
                search: next.search || undefined,
                category_id: next.category_id || undefined,
                availability: next.availability || undefined,
            },
            {
                preserveState: true,
                preserveScroll: true,
                replace: true,
                only: ['items', 'filters'],
            },
        );
    };

    useEffect(() => {
        if (firstRender.current) {
            firstRender.current = false;
            return;
        }
        const timeout = window.setTimeout(() => visit({ search }), 350);
        return () => window.clearTimeout(timeout);
        // Select filters submit immediately.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search]);

    const columns: DataTableColumn<MenuItem>[] = [
        {
            key: 'item',
            label: 'Item',
            render: (item) => (
                <div className="flex items-center gap-3">
                    {item.photo_url ? (
                        <img
                            src={item.photo_url}
                            alt=""
                            className="size-11 rounded-lg border object-cover"
                        />
                    ) : (
                        <div className="bg-muted text-muted-foreground flex size-11 items-center justify-center rounded-lg border">
                            <ImageIcon className="size-4" />
                        </div>
                    )}
                    <div>
                        <p className="font-medium">{item.name}</p>
                        {item.is_featured && (
                            <Badge variant="secondary" className="mt-1">
                                Featured
                            </Badge>
                        )}
                    </div>
                </div>
            ),
        },
        {
            key: 'category',
            label: 'Category',
            render: (item) => item.category.name,
        },
        {
            key: 'price',
            label: 'Base price',
            className: 'text-right font-medium tabular-nums',
            render: (item) => currency.format(Number(item.base_price)),
        },
        {
            key: 'availability',
            label: 'Availability',
            render: (item) => (
                <Button
                    size="sm"
                    variant={item.is_available ? 'outline' : 'secondary'}
                    disabled={busyId === item.id}
                    onClick={() => {
                        setBusyId(item.id);
                        router.patch(
                            `/restaurant/menu/items/${item.id}/availability`,
                            { is_available: !item.is_available },
                            {
                                preserveState: true,
                                preserveScroll: true,
                                only: ['items'],
                                onFinish: () => setBusyId(null),
                            },
                        );
                    }}
                >
                    {busyId === item.id
                        ? 'Updating...'
                        : item.is_available
                          ? 'Available'
                          : 'Sold out'}
                </Button>
            ),
        },
        {
            key: 'actions',
            label: '',
            className: 'text-right',
            render: (item) => (
                <div className="flex justify-end gap-2">
                    <Button size="sm" variant="outline" asChild>
                        <Link href={`/restaurant/menu/items/${item.id}/edit`}>
                            <Pencil /> Edit
                        </Link>
                    </Button>
                    <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => setDeleting(item)}
                    >
                        <Trash2 /> Delete
                    </Button>
                </div>
            ),
        },
    ];

    return (
        <>
            <Head title="Menu items" />
            <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
                    <div>
                        <h2 className="text-2xl font-semibold tracking-tight">
                            Menu items
                        </h2>
                        <p className="text-muted-foreground text-sm">
                            Manage prices, options, schedules, and sold-out
                            status.
                        </p>
                    </div>
                    <Button asChild>
                        <Link href="/restaurant/menu/items/create">
                            <Plus /> Add item
                        </Link>
                    </Button>
                </div>

                <div className="flex flex-col gap-3 rounded-xl border p-4 lg:flex-row">
                    <div className="relative flex-1 lg:max-w-md">
                        <Search className="text-muted-foreground pointer-events-none absolute top-2.5 left-3 size-4" />
                        <Input
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Search menu items..."
                            className="pl-9"
                        />
                    </div>
                    <Select
                        value={categoryId}
                        onValueChange={(value) => {
                            setCategoryId(value);
                            visit({
                                category_id: value === 'all' ? '' : value,
                            });
                        }}
                    >
                        <SelectTrigger className="w-full lg:w-56">
                            <SelectValue placeholder="Category" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All categories</SelectItem>
                            {categories.map((category) => (
                                <SelectItem
                                    key={category.id}
                                    value={String(category.id)}
                                >
                                    {category.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Select
                        value={availability}
                        onValueChange={(value) => {
                            setAvailability(value);
                            visit({
                                availability: value === 'all' ? '' : value,
                            });
                        }}
                    >
                        <SelectTrigger className="w-full lg:w-48">
                            <SelectValue placeholder="Availability" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">
                                All availability
                            </SelectItem>
                            <SelectItem value="available">Available</SelectItem>
                            <SelectItem value="unavailable">
                                Sold out
                            </SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <DataTable
                    columns={columns}
                    paginated={items}
                    rowKey={(item) => item.id}
                    emptyMessage="No menu items match these filters."
                />
            </div>

            <Dialog
                open={deleting !== null}
                onOpenChange={(open) => !open && setDeleting(null)}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete {deleting?.name}?</DialogTitle>
                        <DialogDescription>
                            Items with order history are kept for accurate
                            receipts and will only be marked sold out. Items
                            without history are permanently deleted.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setDeleting(null)}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            disabled={
                                deleting !== null && busyId === deleting.id
                            }
                            onClick={() => {
                                if (!deleting) return;
                                setBusyId(deleting.id);
                                router.delete(
                                    `/restaurant/menu/items/${deleting.id}`,
                                    {
                                        preserveScroll: true,
                                        onSuccess: () => setDeleting(null),
                                        onFinish: () => setBusyId(null),
                                    },
                                );
                            }}
                        >
                            Delete item
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

MenuItems.layout = { title: 'Menu items' };
