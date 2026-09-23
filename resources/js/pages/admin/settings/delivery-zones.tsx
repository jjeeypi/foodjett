import { Head, router } from '@inertiajs/react';
import { Power, Trash2 } from 'lucide-react';
import { useState } from 'react';
import DataTable, {
    type DataTableColumn,
    type PaginatedData,
} from '@/components/admin/data-table';
import DeliveryZoneDialog, {
    type DeliveryZoneFormRecord,
} from '@/components/admin/delivery-zone-dialog';
import SettingsNav from '@/components/admin/settings-nav';
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

export default function DeliveryZones({
    zones,
}: {
    zones: PaginatedData<DeliveryZoneFormRecord>;
}) {
    const [deleting, setDeleting] = useState<DeliveryZoneFormRecord | null>(
        null,
    );
    const [busyId, setBusyId] = useState<number | null>(null);

    const columns: DataTableColumn<DeliveryZoneFormRecord>[] = [
        {
            key: 'name',
            label: 'Zone',
            render: (zone) => (
                <div>
                    <p className="font-medium">{zone.name}</p>
                    {zone.geometry_type !== 'circle' && (
                        <p className="text-muted-foreground text-xs">
                            Legacy {zone.geometry_type}
                        </p>
                    )}
                </div>
            ),
        },
        {
            key: 'center',
            label: 'Center (lat, lng)',
            render: (zone) =>
                zone.center_latitude === null || zone.center_longitude === null
                    ? 'Unavailable'
                    : `${zone.center_latitude.toFixed(6)}, ${zone.center_longitude.toFixed(6)}`,
        },
        {
            key: 'radius',
            label: 'Radius',
            render: (zone) =>
                zone.radius_km === null
                    ? 'Unavailable'
                    : `${zone.radius_km} km`,
        },
        {
            key: 'status',
            label: 'Status',
            render: (zone) => (
                <Badge
                    variant="outline"
                    className={
                        zone.is_active
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300'
                            : 'text-muted-foreground'
                    }
                >
                    {zone.is_active ? 'Active' : 'Inactive'}
                </Badge>
            ),
        },
        {
            key: 'actions',
            label: '',
            className: 'text-right',
            render: (zone) => (
                <div className="flex justify-end gap-2">
                    <Button
                        size="sm"
                        variant="outline"
                        disabled={busyId === zone.id}
                        onClick={() => {
                            setBusyId(zone.id);
                            router.patch(
                                `/admin/settings/delivery-zones/${zone.id}/toggle`,
                                {},
                                {
                                    preserveScroll: true,
                                    onFinish: () => setBusyId(null),
                                },
                            );
                        }}
                    >
                        <Power /> {zone.is_active ? 'Disable' : 'Enable'}
                    </Button>
                    <DeliveryZoneDialog zone={zone} />
                    <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => setDeleting(zone)}
                    >
                        <Trash2 /> Delete
                    </Button>
                </div>
            ),
        },
    ];

    return (
        <>
            <Head title="Delivery zones" />
            <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
                <SettingsNav />
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
                    <div>
                        <h2 className="text-2xl font-semibold tracking-tight">
                            Delivery zones
                        </h2>
                        <p className="text-muted-foreground text-sm">
                            Maintain circular service areas with latitude,
                            longitude, and radius.
                        </p>
                    </div>
                    <DeliveryZoneDialog />
                </div>

                <DataTable
                    columns={columns}
                    paginated={zones}
                    rowKey={(zone) => zone.id}
                    emptyMessage="No delivery zones have been configured."
                />
            </div>

            <Dialog
                open={deleting !== null}
                onOpenChange={(open) => !open && setDeleting(null)}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete delivery zone?</DialogTitle>
                        <DialogDescription>
                            {deleting
                                ? `${deleting.name} will be permanently removed.`
                                : 'This delivery zone will be permanently removed.'}
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
                            onClick={() => {
                                if (!deleting) return;
                                setBusyId(deleting.id);
                                router.delete(
                                    `/admin/settings/delivery-zones/${deleting.id}`,
                                    {
                                        preserveScroll: true,
                                        onSuccess: () => setDeleting(null),
                                        onFinish: () => setBusyId(null),
                                    },
                                );
                            }}
                            disabled={
                                deleting !== null && busyId === deleting.id
                            }
                        >
                            Delete zone
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

DeliveryZones.layout = { title: 'Delivery zones' };
