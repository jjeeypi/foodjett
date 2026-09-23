import { Head, Link, router, useForm } from '@inertiajs/react';
import { Check, ExternalLink, FileText, MapPin, X } from 'lucide-react';
import { useState } from 'react';
import { Pagination, type PaginatedData } from '@/components/admin/data-table';
import InputError from '@/components/input-error';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

type RestaurantDocument = {
    id: number;
    type: string;
    file_path: string;
    status: 'pending' | 'verified' | 'rejected';
};

type PendingRestaurant = {
    id: number;
    name: string;
    cuisine_type: string | null;
    address: string;
    created_at: string;
    user: {
        name: string;
        email: string;
        phone: string | null;
    };
    documents: RestaurantDocument[];
};

const documentUrl = (path: string) =>
    path.startsWith('http') ? path : `/storage/${path.replace(/^\/+/, '')}`;

const isImage = (path: string) => /\.(jpe?g|png|gif|webp)$/i.test(path);

export default function PendingRestaurants({
    restaurants,
}: {
    restaurants: PaginatedData<PendingRestaurant>;
}) {
    const [rejectingRestaurant, setRejectingRestaurant] =
        useState<PendingRestaurant | null>(null);
    const [approvingId, setApprovingId] = useState<number | null>(null);
    const rejectForm = useForm({ reason: '' });

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

    const reject = () => {
        if (!rejectingRestaurant) {
            return;
        }

        rejectForm.patch(
            `/admin/restaurants/${rejectingRestaurant.id}/reject`,
            {
                preserveScroll: true,
                onSuccess: () => {
                    rejectForm.reset();
                    setRejectingRestaurant(null);
                },
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
                            Oldest submissions are shown first.
                        </p>
                    </div>
                    <Button variant="outline" asChild>
                        <Link href="/admin/restaurants">All restaurants</Link>
                    </Button>
                </div>

                <div className="grid gap-5 xl:grid-cols-2">
                    {restaurants.data.map((restaurant) => (
                        <Card key={restaurant.id}>
                            <CardHeader className="gap-2">
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <CardTitle>{restaurant.name}</CardTitle>
                                        <p className="text-muted-foreground mt-1 text-sm">
                                            {restaurant.cuisine_type ||
                                                'Cuisine not provided'}
                                        </p>
                                    </div>
                                    <Badge variant="outline">Pending</Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-5">
                                <div className="grid gap-2 text-sm sm:grid-cols-2">
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
                                    <p className="mb-2 text-sm font-medium">
                                        Submitted documents
                                    </p>
                                    {restaurant.documents.length > 0 ? (
                                        <div className="grid gap-3 sm:grid-cols-3">
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
                                                                className="h-28 w-full object-cover"
                                                            />
                                                        ) : (
                                                            <div className="bg-muted flex h-28 items-center justify-center">
                                                                <FileText className="text-muted-foreground size-8" />
                                                            </div>
                                                        )}
                                                        <div className="flex items-center justify-between gap-2 p-2 text-xs capitalize">
                                                            <span>
                                                                {document.type.replaceAll(
                                                                    '_',
                                                                    ' ',
                                                                )}
                                                            </span>
                                                            <ExternalLink className="size-3" />
                                                        </div>
                                                    </a>
                                                ),
                                            )}
                                        </div>
                                    ) : (
                                        <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
                                            No documents have been uploaded.
                                        </p>
                                    )}
                                </div>

                                <div className="flex flex-col gap-2 border-t pt-4 sm:flex-row sm:justify-end">
                                    <Button variant="outline" asChild>
                                        <Link
                                            href={`/admin/restaurants/${restaurant.id}`}
                                        >
                                            Full details
                                        </Link>
                                    </Button>
                                    <Button
                                        variant="destructive"
                                        onClick={() => {
                                            rejectForm.clearErrors();
                                            setRejectingRestaurant(restaurant);
                                        }}
                                    >
                                        <X />
                                        Reject
                                    </Button>
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

            <Dialog
                open={rejectingRestaurant !== null}
                onOpenChange={(open) => {
                    if (!open) {
                        rejectForm.reset();
                        rejectForm.clearErrors();
                        setRejectingRestaurant(null);
                    }
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Reject restaurant application</DialogTitle>
                        <DialogDescription>
                            Explain what {rejectingRestaurant?.name} needs to
                            correct. The reason will be visible on their
                            pending-status page.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2">
                        <Label htmlFor="rejection-reason">
                            Rejection reason
                        </Label>
                        <textarea
                            id="rejection-reason"
                            value={rejectForm.data.reason}
                            onChange={(event) =>
                                rejectForm.setData('reason', event.target.value)
                            }
                            rows={5}
                            className="border-input focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-3"
                            placeholder="Include the missing or invalid requirements…"
                        />
                        <InputError message={rejectForm.errors.reason} />
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setRejectingRestaurant(null)}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={reject}
                            disabled={rejectForm.processing}
                        >
                            {rejectForm.processing
                                ? 'Rejecting…'
                                : 'Reject application'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

PendingRestaurants.layout = {
    title: 'Pending restaurant approvals',
};
