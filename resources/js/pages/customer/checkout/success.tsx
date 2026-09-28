import { Head, Link } from '@inertiajs/react';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const money = new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
});

export default function CheckoutSuccess({
    orderNumber,
    orderId,
    totalAmount,
    cod = false,
}: {
    orderNumber: string | null;
    orderId: number | null;
    totalAmount: number;
    cod?: boolean;
}) {
    return (
        <>
            <Head title="Order placed" />
            <div className="flex min-h-[70vh] items-center justify-center p-4 md:p-6">
                <Card className="w-full max-w-lg text-center">
                    <CardHeader className="items-center">
                        <CheckCircle2 className="size-12 text-emerald-600" />
                        <CardTitle className="text-xl">
                            {cod
                                ? 'Order placed successfully!'
                                : 'Payment Successful — thank you for your order!'}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-muted-foreground text-sm">
                            {cod
                                ? 'Pay the rider in cash when your food arrives.'
                                : 'Your payment was verified and your order has been sent to the restaurant.'}
                        </p>
                        {orderNumber && (
                            <div className="rounded-lg border p-4">
                                <p className="text-muted-foreground text-xs uppercase">
                                    Order number
                                </p>
                                <p className="font-semibold">{orderNumber}</p>
                                <p className="mt-1 text-sm">
                                    {money.format(totalAmount)}
                                </p>
                            </div>
                        )}
                        <div className="flex flex-col justify-center gap-2 sm:flex-row">
                            {orderId && (
                                <Button asChild>
                                    <Link
                                        href={`/customer/orders/${orderId}/track`}
                                    >
                                        Track order
                                    </Link>
                                </Button>
                            )}
                            <Button variant="outline" asChild>
                                <Link href="/customer">Back to home</Link>
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </>
    );
}
