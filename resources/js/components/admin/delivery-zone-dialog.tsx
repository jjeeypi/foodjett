import { useForm } from '@inertiajs/react';
import { MapPinned, Pencil } from 'lucide-react';
import { useId, useState } from 'react';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export type DeliveryZoneFormRecord = {
    id: number;
    name: string;
    is_active: boolean;
    center_latitude: number | null;
    center_longitude: number | null;
    radius_km: number | null;
    geometry_type: string;
};

export default function DeliveryZoneDialog({
    zone,
}: {
    zone?: DeliveryZoneFormRecord;
}) {
    const [open, setOpen] = useState(false);
    const nameId = useId();
    const latitudeId = useId();
    const longitudeId = useId();
    const radiusId = useId();
    const activeId = useId();
    const form = useForm({
        name: zone?.name ?? '',
        center_latitude: zone?.center_latitude?.toString() ?? '',
        center_longitude: zone?.center_longitude?.toString() ?? '',
        radius_km: zone?.radius_km?.toString() ?? '',
        is_active: zone?.is_active ?? true,
    });

    const close = () => {
        form.clearErrors();
        setOpen(false);
    };

    const submit = () => {
        const options = { preserveScroll: true, onSuccess: close };
        if (zone) {
            form.patch(`/admin/settings/delivery-zones/${zone.id}`, options);
        } else {
            form.post('/admin/settings/delivery-zones', options);
        }
    };

    return (
        <Dialog
            open={open}
            onOpenChange={(next) => (next ? setOpen(true) : close())}
        >
            <DialogTrigger asChild>
                <Button
                    variant={zone ? 'outline' : 'default'}
                    size={zone ? 'sm' : 'default'}
                >
                    {zone ? <Pencil /> : <MapPinned />}
                    {zone ? 'Edit' : 'Add zone'}
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>
                        {zone ? 'Edit delivery zone' : 'Add delivery zone'}
                    </DialogTitle>
                    <DialogDescription>
                        Define a circular service area using its center point
                        and radius.
                        {zone?.geometry_type === 'Polygon' &&
                            ' Saving converts this legacy polygon to a circle.'}
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2 sm:col-span-2">
                        <Label htmlFor={nameId}>Zone name</Label>
                        <Input
                            id={nameId}
                            value={form.data.name}
                            onChange={(event) =>
                                form.setData('name', event.target.value)
                            }
                            placeholder="Central service area"
                        />
                        <InputError message={form.errors.name} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor={latitudeId}>Center latitude</Label>
                        <Input
                            id={latitudeId}
                            type="number"
                            step="any"
                            min="-90"
                            max="90"
                            value={form.data.center_latitude}
                            onChange={(event) =>
                                form.setData(
                                    'center_latitude',
                                    event.target.value,
                                )
                            }
                        />
                        <InputError message={form.errors.center_latitude} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor={longitudeId}>Center longitude</Label>
                        <Input
                            id={longitudeId}
                            type="number"
                            step="any"
                            min="-180"
                            max="180"
                            value={form.data.center_longitude}
                            onChange={(event) =>
                                form.setData(
                                    'center_longitude',
                                    event.target.value,
                                )
                            }
                        />
                        <InputError message={form.errors.center_longitude} />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                        <Label htmlFor={radiusId}>Radius (km)</Label>
                        <Input
                            id={radiusId}
                            type="number"
                            step="0.1"
                            min="0.1"
                            max="100"
                            value={form.data.radius_km}
                            onChange={(event) =>
                                form.setData('radius_km', event.target.value)
                            }
                        />
                        <InputError message={form.errors.radius_km} />
                    </div>
                    <div className="flex items-center gap-2 sm:col-span-2">
                        <Checkbox
                            id={activeId}
                            checked={form.data.is_active}
                            onCheckedChange={(checked) =>
                                form.setData('is_active', checked === true)
                            }
                        />
                        <Label htmlFor={activeId}>
                            Active and available for service checks
                        </Label>
                    </div>
                    <InputError message={form.errors.is_active} />
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={close}>
                        Cancel
                    </Button>
                    <Button onClick={submit} disabled={form.processing}>
                        {form.processing ? 'Saving...' : 'Save zone'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
