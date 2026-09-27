import { Head, Link } from '@inertiajs/react';
import { CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function PaymentResult({
    success,
    title,
    message,
    orderNumber,
    orderId,
    totalAmount,
}: {
    success: boolean;
    title: string;
    message: string;
    orderNumber?: string | null;
    orderId?: number | null;
    totalAmount?: number;
}) {
    const Icon = success ? CheckCircle2 : XCircle;

    return (
        <>
            <Head title={success ? 'Order placed' : 'Payment failed'} />
            <div className="flex flex-1 items-center justify-center p-4 md:p-6">
                <Card className="w-full max-w-lg text-center">
                    <CardHeader className="items-center">
                        <Icon
                            className={`size-12 ${success ? 'text-emerald-600' : 'text-destructive'}`}
                        />
                        <CardTitle className="text-xl">{title}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-muted-foreground text-sm">
                            {message}
                        </p>
                        {orderNumber && (
                            <div className="rounded-lg border p-4">
                                <p className="text-muted-foreground text-xs uppercase">
                                    Order number
                                </p>
                                <p className="font-semibold">{orderNumber}</p>
                                {totalAmount !== undefined && (
                                    <p className="mt-1 text-sm">
                                        ₱{totalAmount.toFixed(2)}
                                    </p>
                                )}
                            </div>
                        )}
                        <div className="flex flex-col justify-center gap-2 sm:flex-row">
                            {success && orderId && (
                                <Button asChild>
                                    <Link
                                        href={`/customer/orders/${orderId}/track`}
                                    >
                                        Track order
                                    </Link>
                                </Button>
                            )}
                            <Button
                                asChild
                                variant={
                                    success && orderId ? 'outline' : 'default'
                                }
                            >
                                <Link href="/customer">
                                    Back to restaurants
                                </Link>
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </>
    );
}
