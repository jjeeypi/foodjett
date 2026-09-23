import { Head, router } from '@inertiajs/react';
import { useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

type Order = {
    id: number;
    order_number: string;
    status: string;
    payment_method: 'cod' | 'gcash' | 'card';
    total_amount: string;
    restaurant: { name: string; address: string };
    delivery_address: { address_line: string };
};

export default function RiderOrders({
    rider,
    poolOrders,
    activeOrders,
    blockedCodOrders,
}: {
    rider: { cash_on_hand: string; cash_remit_limit: string };
    poolOrders: Order[];
    activeOrders: Order[];
    blockedCodOrders: number;
}) {
    const [cashCollected, setCashCollected] = useState<Record<number, boolean>>(
        {},
    );
    const [failureReasons, setFailureReasons] = useState<
        Record<number, string>
    >({});

    return (
        <>
            <Head title="Rider orders" />
            <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">
                        Delivery orders
                    </h1>
                    <p className="text-muted-foreground text-sm">
                        Cash on hand: ₱{Number(rider.cash_on_hand).toFixed(2)} /
                        ₱{Number(rider.cash_remit_limit).toFixed(2)} remit limit
                    </p>
                </div>

                {blockedCodOrders > 0 && (
                    <Alert variant="destructive">
                        <AlertTitle>COD acceptance paused</AlertTitle>
                        <AlertDescription>
                            You are at or over your cash remit limit. Remit cash
                            to see and accept {blockedCodOrders} hidden COD{' '}
                            {blockedCodOrders === 1 ? 'order' : 'orders'}.
                        </AlertDescription>
                    </Alert>
                )}

                <section className="space-y-3">
                    <h2 className="text-lg font-semibold">Available pool</h2>
                    <div className="grid gap-4 lg:grid-cols-2">
                        {poolOrders.map((order) => (
                            <Card key={order.id}>
                                <CardHeader>
                                    <CardTitle className="flex justify-between gap-3">
                                        <span>{order.restaurant.name}</span>
                                        <span className="text-sm font-normal uppercase">
                                            {order.payment_method}
                                        </span>
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3 text-sm">
                                    <p>{order.delivery_address.address_line}</p>
                                    <p className="font-semibold">
                                        ₱{Number(order.total_amount).toFixed(2)}
                                    </p>
                                    <Button
                                        onClick={() =>
                                            router.post(
                                                `/rider/orders/${order.id}/accept`,
                                            )
                                        }
                                    >
                                        Accept order
                                    </Button>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                    {poolOrders.length === 0 && (
                        <p className="text-muted-foreground text-sm">
                            No eligible orders are in the pool.
                        </p>
                    )}
                </section>

                <section className="space-y-3">
                    <h2 className="text-lg font-semibold">Active deliveries</h2>
                    <div className="grid gap-4 lg:grid-cols-2">
                        {activeOrders.map((order) => (
                            <Card key={order.id}>
                                <CardHeader>
                                    <CardTitle>{order.order_number}</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4 text-sm">
                                    <div>
                                        <p className="font-medium">
                                            {order.restaurant.name}
                                        </p>
                                        <p className="text-muted-foreground">
                                            {
                                                order.delivery_address
                                                    .address_line
                                            }
                                        </p>
                                        <p className="mt-1 uppercase">
                                            {order.payment_method} · ₱
                                            {Number(order.total_amount).toFixed(
                                                2,
                                            )}
                                        </p>
                                    </div>

                                    {order.payment_method === 'cod' && (
                                        <label className="flex items-center gap-2 rounded-md border p-3">
                                            <input
                                                type="checkbox"
                                                checked={
                                                    cashCollected[order.id] ??
                                                    false
                                                }
                                                onChange={(event) =>
                                                    setCashCollected(
                                                        (current) => ({
                                                            ...current,
                                                            [order.id]:
                                                                event.target
                                                                    .checked,
                                                        }),
                                                    )
                                                }
                                            />
                                            Cash collected from customer
                                        </label>
                                    )}

                                    <Button
                                        className="w-full"
                                        onClick={() =>
                                            router.patch(
                                                `/rider/orders/${order.id}/complete`,
                                                {
                                                    outcome: 'delivered',
                                                    cash_collected:
                                                        cashCollected[
                                                            order.id
                                                        ] ?? false,
                                                },
                                            )
                                        }
                                    >
                                        Mark delivered
                                    </Button>

                                    <div className="space-y-2 border-t pt-4">
                                        <Input
                                            placeholder="Why could payment/delivery not be completed?"
                                            value={
                                                failureReasons[order.id] ?? ''
                                            }
                                            onChange={(event) =>
                                                setFailureReasons(
                                                    (current) => ({
                                                        ...current,
                                                        [order.id]:
                                                            event.target.value,
                                                    }),
                                                )
                                            }
                                        />
                                        <Button
                                            variant="destructive"
                                            className="w-full"
                                            disabled={
                                                !(
                                                    failureReasons[order.id] ??
                                                    ''
                                                ).trim()
                                            }
                                            onClick={() =>
                                                router.patch(
                                                    `/rider/orders/${order.id}/complete`,
                                                    {
                                                        outcome:
                                                            'failed_delivery',
                                                        cancellation_reason:
                                                            failureReasons[
                                                                order.id
                                                            ],
                                                    },
                                                )
                                            }
                                        >
                                            Report payment or delivery issue
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                    {activeOrders.length === 0 && (
                        <p className="text-muted-foreground text-sm">
                            You have no active deliveries.
                        </p>
                    )}
                </section>
            </div>
        </>
    );
}
