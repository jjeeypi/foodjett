import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    Banknote,
    Bike,
    Camera,
    CheckCircle2,
    Clock3,
    ExternalLink,
    LoaderCircle,
    MapPin,
    MessageCircle,
    Navigation,
    PackageCheck,
    Phone,
    Store,
    TriangleAlert,
    Utensils,
} from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import ChatThread, {
    type ChatConversation,
    type ChatMessage,
} from '@/components/chat/chat-thread';
import OrderStatusBadge, {
    type CustomerOrderStatus,
} from '@/components/customer/order-status-badge';
import OrderTrackingMap, {
    type RiderLocation,
} from '@/components/customer/order-tracking-map';
import RiderLocationTracker from '@/components/rider/rider-location-tracker';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type OrderItem = {
    id: number;
    name: string;
    variant: string | null;
    quantity: number;
    special_instructions: string | null;
    addons: Array<{ name: string }>;
};

type ActiveOrder = {
    id: number;
    order_number: string;
    status: CustomerOrderStatus;
    restaurant: {
        name: string;
        address: string;
        latitude: number;
        longitude: number;
    };
    customer: { name: string; phone: string | null };
    delivery_address: {
        label: string;
        address_line: string;
        landmark: string | null;
        delivery_instructions: string | null;
        latitude: number;
        longitude: number;
    };
    items: OrderItem[];
    customer_notes: string | null;
    payment_method: 'cod' | 'gcash' | 'card';
    cash_to_collect: number | null;
    estimated_ready_at: string | null;
    rider_arrived_restaurant_at: string | null;
    unreachable_available_at: string | null;
    can_cancel: boolean;
    rider_location: RiderLocation | null;
};

type MessagePage = {
    data: ChatMessage[];
    next_page_url: string | null;
};

const currency = new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
});

const time = new Intl.DateTimeFormat('en-PH', {
    hour: 'numeric',
    minute: '2-digit',
});

const actionByStatus: Partial<
    Record<CustomerOrderStatus, { label: string; next: CustomerOrderStatus }>
> = {
    rider_assigned: {
        label: "I've arrived at the restaurant",
        next: 'at_restaurant',
    },
    at_restaurant: { label: 'Confirm pickup', next: 'picked_up' },
    picked_up: { label: 'Start delivery', next: 'on_the_way' },
    on_the_way: { label: "I've arrived at the customer", next: 'arrived' },
    arrived: { label: 'Confirm delivery', next: 'delivered' },
};

const issueTypes = [
    ['restaurant_delay', 'Restaurant delay'],
    ['missing_item', 'Missing item'],
    ['wrong_item', 'Wrong item'],
    ['spilled_food', 'Spilled food'],
    ['accident', 'Accident'],
    ['unsafe_location', 'Unsafe location'],
    ['customer_unreachable', 'Customer unreachable'],
] as const;

export default function RiderActive({
    order,
    conversation,
    messages,
    waitingCompensationThresholdMinutes,
}: {
    order: ActiveOrder | null;
    conversation: ChatConversation | null;
    messages: MessagePage | null;
    waitingCompensationThresholdMinutes: number;
}) {
    const { auth } = usePage().props;
    const [now, setNow] = useState(Date.now());
    const [processing, setProcessing] = useState(false);
    const [pickupOpen, setPickupOpen] = useState(false);
    const [pickupCode, setPickupCode] = useState('');
    const [deliveryOpen, setDeliveryOpen] = useState(false);
    const [proof, setProof] = useState<File | null>(null);
    const [cashCollected, setCashCollected] = useState(false);
    const [issueOpen, setIssueOpen] = useState(false);
    const [issueType, setIssueType] = useState('restaurant_delay');
    const [issueDescription, setIssueDescription] = useState('');
    const [cancelOpen, setCancelOpen] = useState(false);
    const [cancelReason, setCancelReason] = useState('');
    const [failedOpen, setFailedOpen] = useState(false);
    const [failedReason, setFailedReason] = useState('');
    const [chatOpen, setChatOpen] = useState(false);

    useEffect(() => {
        if (order?.status !== 'at_restaurant' && order?.status !== 'arrived') {
            return;
        }

        const timer = window.setInterval(() => setNow(Date.now()), 1000);
        return () => window.clearInterval(timer);
    }, [order?.status]);

    const waitingMinutes = useMemo(() => {
        if (!order?.rider_arrived_restaurant_at) return 0;

        return Math.max(
            0,
            Math.floor(
                (now - new Date(order.rider_arrived_restaurant_at).getTime()) /
                    60_000,
            ),
        );
    }, [now, order?.rider_arrived_restaurant_at]);

    const unreachableSeconds = order?.unreachable_available_at
        ? Math.max(
              0,
              Math.ceil(
                  (new Date(order.unreachable_available_at).getTime() - now) /
                      1000,
              ),
          )
        : 0;

    if (order === null) {
        return (
            <>
                <Head title="Active delivery" />
                <div className="flex flex-1 items-center px-4 py-8 sm:px-6">
                    <Card className="w-full">
                        <CardContent className="flex min-h-72 flex-col items-center justify-center px-6 text-center">
                            <div className="bg-muted mb-4 flex size-14 items-center justify-center rounded-full">
                                <Bike className="text-muted-foreground size-7" />
                            </div>
                            <h1 className="text-xl font-semibold">
                                No active delivery
                            </h1>
                            <p className="text-muted-foreground mt-2 max-w-sm text-sm">
                                Check the Pool for nearby orders ready to be
                                accepted.
                            </p>
                            <Button asChild className="mt-5 min-h-11">
                                <Link href="/rider/orders">
                                    <Navigation /> Check the Pool
                                </Link>
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </>
        );
    }

    const action = actionByStatus[order.status];
    const navigatingToRestaurant = ['rider_assigned', 'at_restaurant'].includes(
        order.status,
    );
    const destination = navigatingToRestaurant
        ? order.restaurant
        : order.delivery_address;
    const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${destination.latitude},${destination.longitude}`;
    const wazeUrl = `https://waze.com/ul?ll=${destination.latitude},${destination.longitude}&navigate=yes`;

    const post = (
        url: string,
        data: Record<string, string | boolean | File | null>,
        options?: { onSuccess?: () => void },
    ) => {
        router.post(url, data, {
            preserveScroll: true,
            forceFormData: Object.values(data).some(
                (value) => value instanceof File,
            ),
            onStart: () => setProcessing(true),
            onSuccess: () => {
                options?.onSuccess?.();
                toast.success('Delivery updated.');
            },
            onError: (errors) => {
                const message = Object.values(errors).find(
                    (error): error is string => typeof error === 'string',
                );
                toast.error(message ?? 'The action could not be completed.');
            },
            onFinish: () => setProcessing(false),
        });
    };

    const advance = () => {
        if (!action || processing) return;

        if (action.next === 'picked_up') {
            setPickupOpen(true);
            return;
        }
        if (action.next === 'delivered') {
            setDeliveryOpen(true);
            return;
        }

        post('/rider/active/advance', { next_status: action.next });
    };

    const confirmPickup = (event: FormEvent) => {
        event.preventDefault();
        post(
            '/rider/active/advance',
            { next_status: 'picked_up', pickup_code: pickupCode },
            {
                onSuccess: () => {
                    setPickupOpen(false);
                    setPickupCode('');
                },
            },
        );
    };

    const confirmDelivery = (event: FormEvent) => {
        event.preventDefault();
        post(
            '/rider/active/advance',
            {
                next_status: 'delivered',
                proof_of_delivery: proof,
                cash_collected: cashCollected,
            },
            { onSuccess: () => setDeliveryOpen(false) },
        );
    };

    const reportIssue = (event: FormEvent) => {
        event.preventDefault();
        post(
            '/rider/active/issues',
            {
                issue_type: issueType,
                description: issueDescription,
            },
            {
                onSuccess: () => {
                    setIssueOpen(false);
                    setIssueDescription('');
                },
            },
        );
    };

    const cancelDelivery = (event: FormEvent) => {
        event.preventDefault();
        post(
            '/rider/active/cancel',
            { reason: cancelReason },
            { onSuccess: () => setCancelOpen(false) },
        );
    };

    const markFailed = (event: FormEvent) => {
        event.preventDefault();
        post(
            '/rider/active/failed',
            { reason: failedReason },
            { onSuccess: () => setFailedOpen(false) },
        );
    };

    return (
        <>
            <Head title={`Active ${order.order_number}`} />
            <div className="flex flex-1 flex-col gap-4 px-4 py-5 sm:px-6">
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                            Active delivery
                        </p>
                        <h1 className="truncate text-xl font-semibold">
                            {order.order_number}
                        </h1>
                    </div>
                    <OrderStatusBadge status={order.status} />
                </div>

                <RiderLocationTracker
                    orderId={order.id}
                    initialStatus={order.status}
                />

                {order.payment_method === 'cod' && (
                    <Alert className="border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40">
                        <Banknote />
                        <AlertTitle>Cash on delivery</AlertTitle>
                        <AlertDescription>
                            Collect exactly{' '}
                            <strong>
                                {currency.format(order.cash_to_collect ?? 0)}
                            </strong>{' '}
                            before confirming delivery.
                        </AlertDescription>
                    </Alert>
                )}

                <Card>
                    <CardHeader className="pb-3">
                        <div className="flex items-start gap-3">
                            <div className="bg-muted flex size-10 shrink-0 items-center justify-center rounded-lg">
                                <Store className="size-5" />
                            </div>
                            <div className="min-w-0">
                                <CardTitle className="text-base">
                                    {order.restaurant.name}
                                </CardTitle>
                                <CardDescription className="mt-1">
                                    {order.restaurant.address}
                                </CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {order.estimated_ready_at && (
                            <div className="bg-muted/60 flex items-center justify-between rounded-lg px-3 py-2 text-sm">
                                <span className="text-muted-foreground">
                                    Estimated ready
                                </span>
                                <span className="font-medium">
                                    {time.format(
                                        new Date(order.estimated_ready_at),
                                    )}
                                </span>
                            </div>
                        )}

                        <div className="bg-muted/60 flex items-center justify-between rounded-lg px-3 py-2 text-sm">
                            <span className="text-muted-foreground">
                                Payment method
                            </span>
                            <span className="font-medium uppercase">
                                {order.payment_method}
                            </span>
                        </div>

                        {order.status === 'at_restaurant' && (
                            <div className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                                <span className="flex items-center gap-2">
                                    <Clock3 className="size-4" /> Waiting{' '}
                                    {waitingMinutes}m
                                </span>
                                {waitingMinutes >=
                                    waitingCompensationThresholdMinutes && (
                                    <Badge className="bg-emerald-600 text-white">
                                        Waiting pay applies
                                    </Badge>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>

                <OrderTrackingMap
                    restaurant={order.restaurant}
                    delivery={{
                        latitude: order.delivery_address.latitude,
                        longitude: order.delivery_address.longitude,
                        address: order.delivery_address.address_line,
                    }}
                    rider={order.rider_location}
                />

                <div className="grid grid-cols-2 gap-3">
                    <Button variant="outline" className="min-h-11" asChild>
                        <a
                            href={googleMapsUrl}
                            target="_blank"
                            rel="noreferrer"
                        >
                            <MapPin /> Google Maps
                        </a>
                    </Button>
                    <Button variant="outline" className="min-h-11" asChild>
                        <a href={wazeUrl} target="_blank" rel="noreferrer">
                            <ExternalLink /> Waze
                        </a>
                    </Button>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                            <Utensils className="size-4" /> Order details
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {order.items.map((item) => (
                            <div
                                key={item.id}
                                className="border-border/70 border-b pb-3 last:border-0 last:pb-0"
                            >
                                <div className="flex gap-3">
                                    <span className="bg-muted flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold">
                                        {item.quantity}
                                    </span>
                                    <div className="min-w-0">
                                        <p className="font-medium">
                                            {item.name}
                                        </p>
                                        {item.variant && (
                                            <p className="text-muted-foreground text-sm">
                                                {item.variant}
                                            </p>
                                        )}
                                        {item.addons.length > 0 && (
                                            <p className="text-muted-foreground text-sm">
                                                Add-ons:{' '}
                                                {item.addons
                                                    .map((addon) => addon.name)
                                                    .join(', ')}
                                            </p>
                                        )}
                                        {item.special_instructions && (
                                            <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
                                                Note:{' '}
                                                {item.special_instructions}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">
                            Delivery address
                        </CardTitle>
                        <CardDescription>
                            {order.customer.name} ·{' '}
                            {order.delivery_address.label}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                        <p className="font-medium">
                            {order.delivery_address.address_line}
                        </p>
                        {order.delivery_address.landmark && (
                            <p>
                                <span className="text-muted-foreground">
                                    Landmark:{' '}
                                </span>
                                {order.delivery_address.landmark}
                            </p>
                        )}
                        {order.delivery_address.delivery_instructions && (
                            <p>
                                <span className="text-muted-foreground">
                                    Delivery instructions:{' '}
                                </span>
                                {order.delivery_address.delivery_instructions}
                            </p>
                        )}
                        {order.customer_notes && (
                            <p className="rounded-lg bg-amber-50 p-3 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
                                Customer note: {order.customer_notes}
                            </p>
                        )}
                        <div className="grid grid-cols-2 gap-3 pt-1">
                            {conversation && messages && (
                                <Dialog
                                    open={chatOpen}
                                    onOpenChange={setChatOpen}
                                >
                                    <DialogTrigger asChild>
                                        <Button
                                            variant="outline"
                                            className="min-h-11"
                                        >
                                            <MessageCircle /> Message
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent className="max-h-[92dvh] max-w-2xl overflow-y-auto p-3 sm:p-6">
                                        <DialogHeader className="sr-only">
                                            <DialogTitle>
                                                Contact customer
                                            </DialogTitle>
                                            <DialogDescription>
                                                Order-scoped customer chat.
                                            </DialogDescription>
                                        </DialogHeader>
                                        <ChatThread
                                            conversation={conversation}
                                            initialMessages={messages}
                                            currentUserId={auth.user.id}
                                            contextLabel="Customer chat"
                                        />
                                    </DialogContent>
                                </Dialog>
                            )}
                            {order.customer.phone && (
                                <Button
                                    variant="outline"
                                    className="min-h-11"
                                    asChild
                                >
                                    <a href={`tel:${order.customer.phone}`}>
                                        <Phone /> Call
                                    </a>
                                </Button>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {order.status === 'arrived' && (
                    <Card className="border-amber-300 dark:border-amber-900">
                        <CardHeader>
                            <CardTitle className="text-base">
                                Customer unreachable?
                            </CardTitle>
                            <CardDescription>
                                Try calling and messaging first. Failed delivery
                                leaves COD payment pending for admin review.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Dialog
                                open={failedOpen}
                                onOpenChange={setFailedOpen}
                            >
                                <DialogTrigger asChild>
                                    <Button
                                        variant="destructive"
                                        className="min-h-11 w-full"
                                        disabled={unreachableSeconds > 0}
                                    >
                                        {unreachableSeconds > 0
                                            ? `Wait ${formatCountdown(unreachableSeconds)}`
                                            : 'Mark delivery failed'}
                                    </Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <form onSubmit={markFailed}>
                                        <DialogHeader>
                                            <DialogTitle>
                                                Mark delivery failed?
                                            </DialogTitle>
                                            <DialogDescription>
                                                This creates a customer
                                                unreachable report for admin
                                                follow-up.
                                            </DialogDescription>
                                        </DialogHeader>
                                        <div className="space-y-2 py-4">
                                            <Label htmlFor="failed-reason">
                                                What happened?
                                            </Label>
                                            <textarea
                                                id="failed-reason"
                                                className="border-input min-h-28 w-full rounded-md border p-3 text-sm"
                                                value={failedReason}
                                                onChange={(event) =>
                                                    setFailedReason(
                                                        event.target.value,
                                                    )
                                                }
                                                maxLength={1000}
                                                required
                                            />
                                        </div>
                                        <DialogFooter>
                                            <DialogClose asChild>
                                                <Button variant="outline">
                                                    Keep trying
                                                </Button>
                                            </DialogClose>
                                            <Button
                                                type="submit"
                                                variant="destructive"
                                                disabled={
                                                    processing ||
                                                    !failedReason.trim()
                                                }
                                            >
                                                Confirm failed delivery
                                            </Button>
                                        </DialogFooter>
                                    </form>
                                </DialogContent>
                            </Dialog>
                        </CardContent>
                    </Card>
                )}

                <div className="grid grid-cols-2 gap-3">
                    <IssueDialog
                        open={issueOpen}
                        onOpenChange={setIssueOpen}
                        issueType={issueType}
                        setIssueType={setIssueType}
                        description={issueDescription}
                        setDescription={setIssueDescription}
                        processing={processing}
                        onSubmit={reportIssue}
                    />
                    {order.can_cancel && (
                        <CancelDialog
                            open={cancelOpen}
                            onOpenChange={setCancelOpen}
                            reason={cancelReason}
                            setReason={setCancelReason}
                            processing={processing}
                            onSubmit={cancelDelivery}
                        />
                    )}
                </div>

                {action && (
                    <div className="bg-background/95 sticky bottom-[calc(5rem+env(safe-area-inset-bottom))] z-20 -mx-4 border-y px-4 py-3 shadow-lg backdrop-blur sm:-mx-6 sm:px-6">
                        <Button
                            className="min-h-12 w-full text-base"
                            onClick={advance}
                            disabled={processing}
                        >
                            {processing ? (
                                <LoaderCircle className="animate-spin" />
                            ) : action.next === 'delivered' ? (
                                <CheckCircle2 />
                            ) : (
                                <PackageCheck />
                            )}
                            {action.label}
                        </Button>
                    </div>
                )}
            </div>

            <Dialog open={pickupOpen} onOpenChange={setPickupOpen}>
                <DialogContent>
                    <form onSubmit={confirmPickup}>
                        <DialogHeader>
                            <DialogTitle>Confirm restaurant pickup</DialogTitle>
                            <DialogDescription>
                                Ask the restaurant for the four-character pickup
                                code before leaving.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-2 py-5">
                            <Label htmlFor="pickup-code">Pickup code</Label>
                            <Input
                                id="pickup-code"
                                value={pickupCode}
                                onChange={(event) =>
                                    setPickupCode(
                                        event.target.value.toUpperCase(),
                                    )
                                }
                                maxLength={20}
                                autoCapitalize="characters"
                                className="h-12 text-center text-lg tracking-[0.35em] uppercase"
                                required
                            />
                        </div>
                        <DialogFooter>
                            <DialogClose asChild>
                                <Button variant="outline">Cancel</Button>
                            </DialogClose>
                            <Button
                                type="submit"
                                disabled={processing || !pickupCode.trim()}
                            >
                                Confirm pickup
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={deliveryOpen} onOpenChange={setDeliveryOpen}>
                <DialogContent>
                    <form onSubmit={confirmDelivery}>
                        <DialogHeader>
                            <DialogTitle>Confirm delivery</DialogTitle>
                            <DialogDescription>
                                Take a clear photo showing that the order was
                                handed over or left at the agreed location.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-5">
                            <div className="space-y-2">
                                <Label htmlFor="delivery-proof">
                                    Proof of delivery photo
                                </Label>
                                <Input
                                    id="delivery-proof"
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp"
                                    capture="environment"
                                    onChange={(event) =>
                                        setProof(
                                            event.target.files?.[0] ?? null,
                                        )
                                    }
                                    required
                                />
                                <p className="text-muted-foreground text-xs">
                                    JPG, PNG, or WebP up to 10 MB.
                                </p>
                            </div>
                            {order.payment_method === 'cod' && (
                                <label className="flex min-h-12 items-center gap-3 rounded-lg border p-3 text-sm font-medium">
                                    <input
                                        type="checkbox"
                                        className="size-5"
                                        checked={cashCollected}
                                        onChange={(event) =>
                                            setCashCollected(
                                                event.target.checked,
                                            )
                                        }
                                    />
                                    Cash collected —{' '}
                                    {currency.format(
                                        order.cash_to_collect ?? 0,
                                    )}
                                </label>
                            )}
                        </div>
                        <DialogFooter>
                            <DialogClose asChild>
                                <Button variant="outline">Not yet</Button>
                            </DialogClose>
                            <Button
                                type="submit"
                                disabled={
                                    processing ||
                                    proof === null ||
                                    (order.payment_method === 'cod' &&
                                        !cashCollected)
                                }
                            >
                                <Camera /> Confirm delivery
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </>
    );
}

function IssueDialog({
    open,
    onOpenChange,
    issueType,
    setIssueType,
    description,
    setDescription,
    processing,
    onSubmit,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    issueType: string;
    setIssueType: (value: string) => void;
    description: string;
    setDescription: (value: string) => void;
    processing: boolean;
    onSubmit: (event: FormEvent) => void;
}) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogTrigger asChild>
                <Button variant="outline" className="min-h-11">
                    <TriangleAlert /> Report issue
                </Button>
            </DialogTrigger>
            <DialogContent>
                <form onSubmit={onSubmit}>
                    <DialogHeader>
                        <DialogTitle>Report an issue</DialogTitle>
                        <DialogDescription>
                            Send an operational issue to the admin team without
                            ending the delivery.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-5">
                        <div className="space-y-2">
                            <Label htmlFor="issue-type">Issue</Label>
                            <select
                                id="issue-type"
                                className="border-input bg-background h-11 w-full rounded-md border px-3 text-sm"
                                value={issueType}
                                onChange={(event) =>
                                    setIssueType(event.target.value)
                                }
                            >
                                {issueTypes.map(([value, label]) => (
                                    <option key={value} value={value}>
                                        {label}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="issue-description">Details</Label>
                            <textarea
                                id="issue-description"
                                className="border-input min-h-28 w-full rounded-md border p-3 text-sm"
                                value={description}
                                onChange={(event) =>
                                    setDescription(event.target.value)
                                }
                                maxLength={2000}
                                required
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button variant="outline">Cancel</Button>
                        </DialogClose>
                        <Button
                            type="submit"
                            disabled={processing || !description.trim()}
                        >
                            Submit report
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function CancelDialog({
    open,
    onOpenChange,
    reason,
    setReason,
    processing,
    onSubmit,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    reason: string;
    setReason: (value: string) => void;
    processing: boolean;
    onSubmit: (event: FormEvent) => void;
}) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogTrigger asChild>
                <Button variant="destructive" className="min-h-11">
                    Cancel delivery
                </Button>
            </DialogTrigger>
            <DialogContent>
                <form onSubmit={onSubmit}>
                    <DialogHeader>
                        <DialogTitle>Cancel this delivery?</DialogTitle>
                        <DialogDescription>
                            Rider cancellation is only available before pickup
                            and will be recorded for admin review.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2 py-5">
                        <Label htmlFor="cancel-reason">Reason</Label>
                        <textarea
                            id="cancel-reason"
                            className="border-input min-h-28 w-full rounded-md border p-3 text-sm"
                            value={reason}
                            onChange={(event) => setReason(event.target.value)}
                            maxLength={1000}
                            required
                        />
                    </div>
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button variant="outline">Keep delivery</Button>
                        </DialogClose>
                        <Button
                            type="submit"
                            variant="destructive"
                            disabled={processing || !reason.trim()}
                        >
                            Confirm cancellation
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function formatCountdown(totalSeconds: number): string {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
