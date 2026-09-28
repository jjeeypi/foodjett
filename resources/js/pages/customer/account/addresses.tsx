import { Head, router, useForm } from '@inertiajs/react';
import { MapPin, Pencil, Plus, Star, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import AddressForm, {
    emptyAddress,
    type AddressFormValues,
} from '@/components/customer/address-form';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';

type Address = AddressFormValues & {
    id: number;
    is_default: boolean;
    can_delete: boolean;
};

export default function Addresses({
    addresses,
    mapFallback,
}: {
    addresses: Address[];
    mapFallback: { latitude: number; longitude: number };
}) {
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState<Address | null>(null);
    const form = useForm<AddressFormValues>(emptyAddress(mapFallback));

    const openCreate = () => {
        setEditing(null);
        form.setData(emptyAddress(mapFallback));
        form.clearErrors();
        setOpen(true);
    };

    const openEdit = (address: Address) => {
        setEditing(address);
        form.setData({
            label: address.label,
            address_line: address.address_line,
            landmark: address.landmark ?? '',
            delivery_instructions: address.delivery_instructions ?? '',
            latitude: address.latitude,
            longitude: address.longitude,
        });
        form.clearErrors();
        setOpen(true);
    };

    const save = () => {
        const options = {
            preserveScroll: true,
            onSuccess: () => {
                setOpen(false);
                setEditing(null);
                form.reset();
            },
        };

        if (editing) {
            form.patch(`/customer/account/addresses/${editing.id}`, options);
        } else {
            form.post('/customer/account/addresses', options);
        }
    };

    const errors = Object.values(form.errors).filter(
        (error): error is string => typeof error === 'string',
    );

    return (
        <>
            <Head title="Addresses" />
            <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-6 md:py-8">
                <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                    <div>
                        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
                            Delivery addresses
                        </h1>
                        <p className="text-muted-foreground mt-1 text-sm">
                            Save delivery locations and choose the default used
                            at checkout.
                        </p>
                    </div>
                    <Button onClick={openCreate}>
                        <Plus /> Add address
                    </Button>
                </div>

                {addresses.length === 0 ? (
                    <Card className="border-dashed">
                        <CardContent className="flex min-h-64 flex-col items-center justify-center gap-3 text-center">
                            <MapPin className="text-muted-foreground size-9" />
                            <div>
                                <p className="font-medium">
                                    No saved addresses
                                </p>
                                <p className="text-muted-foreground mt-1 text-sm">
                                    Your first address will automatically become
                                    the default.
                                </p>
                            </div>
                            <Button onClick={openCreate}>Add an address</Button>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2">
                        {addresses.map((address) => (
                            <Card
                                key={address.id}
                                className={
                                    address.is_default
                                        ? 'border-primary/50 ring-primary/10 ring-2'
                                        : undefined
                                }
                            >
                                <CardHeader>
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <CardTitle className="flex items-center gap-2 text-lg">
                                                {address.label}
                                                {address.is_default && (
                                                    <Badge>
                                                        <Star className="size-3 fill-current" />
                                                        Default
                                                    </Badge>
                                                )}
                                            </CardTitle>
                                            <CardDescription className="mt-1">
                                                {address.address_line}
                                            </CardDescription>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => openEdit(address)}
                                            aria-label={`Edit ${address.label}`}
                                        >
                                            <Pencil />
                                        </Button>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <dl className="space-y-2 text-sm">
                                        {address.landmark && (
                                            <div>
                                                <dt className="text-muted-foreground text-xs">
                                                    Landmark
                                                </dt>
                                                <dd>{address.landmark}</dd>
                                            </div>
                                        )}
                                        {address.delivery_instructions && (
                                            <div>
                                                <dt className="text-muted-foreground text-xs">
                                                    Delivery instructions
                                                </dt>
                                                <dd>
                                                    {
                                                        address.delivery_instructions
                                                    }
                                                </dd>
                                            </div>
                                        )}
                                    </dl>
                                    <div className="flex flex-wrap gap-2 border-t pt-4">
                                        {!address.is_default && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() =>
                                                    router.patch(
                                                        `/customer/account/addresses/${address.id}/default`,
                                                        {},
                                                        {
                                                            preserveScroll: true,
                                                        },
                                                    )
                                                }
                                            >
                                                <Star /> Set as default
                                            </Button>
                                        )}
                                        <DeleteAddressDialog
                                            address={address}
                                        />
                                    </div>
                                    {!address.can_delete && (
                                        <p className="text-muted-foreground text-xs">
                                            This address is preserved because it
                                            is linked to order history.
                                        </p>
                                    )}
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>
                            {editing ? 'Edit address' : 'Add an address'}
                        </DialogTitle>
                        <DialogDescription>
                            Position the pin at the exact delivery entrance.
                            Addresses outside coverage can still be saved, but
                            checkout will warn you.
                        </DialogDescription>
                    </DialogHeader>
                    <AddressForm
                        value={form.data}
                        fallback={mapFallback}
                        onChange={(value) => form.setData(value)}
                        onSubmit={save}
                        onCancel={() => setOpen(false)}
                        errors={errors}
                        processing={form.processing}
                        submitLabel={editing ? 'Save changes' : 'Save address'}
                        idPrefix={
                            editing ? `edit-${editing.id}` : 'new-address'
                        }
                    />
                </DialogContent>
            </Dialog>
        </>
    );
}

function DeleteAddressDialog({ address }: { address: Address }) {
    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button
                    variant="ghost"
                    size="sm"
                    disabled={!address.can_delete}
                >
                    <Trash2 /> Delete
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Delete {address.label}?</DialogTitle>
                    <DialogDescription>
                        If this is your default, another saved address will be
                        promoted automatically.
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button variant="outline">Keep address</Button>
                    </DialogClose>
                    <Button
                        variant="destructive"
                        onClick={() =>
                            router.delete(
                                `/customer/account/addresses/${address.id}`,
                                {
                                    preserveScroll: true,
                                    onError: (errors) =>
                                        toast.error(
                                            typeof errors.address === 'string'
                                                ? errors.address
                                                : 'This address could not be deleted.',
                                        ),
                                },
                            )
                        }
                    >
                        Delete address
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
