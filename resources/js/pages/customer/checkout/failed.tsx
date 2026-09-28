import { Head, Link } from '@inertiajs/react';
import { XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function CheckoutFailed({
    message,
    retryUrl,
}: {
    message: string;
    retryUrl: string;
}) {
    return (
        <>
            <Head title="Payment failed" />
            <div className="flex min-h-[70vh] items-center justify-center p-4 md:p-6">
                <Card className="w-full max-w-lg text-center">
                    <CardHeader className="items-center">
                        <XCircle className="text-destructive size-12" />
                        <CardTitle className="text-xl">
                            Payment didn&apos;t go through
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-muted-foreground text-sm">
                            {message}
                        </p>
                        <p className="text-sm">
                            Your cart is still available and no unpaid order was
                            created.
                        </p>
                        <div className="flex flex-col justify-center gap-2 sm:flex-row">
                            <Button asChild>
                                <Link href={retryUrl}>Retry checkout</Link>
                            </Button>
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
