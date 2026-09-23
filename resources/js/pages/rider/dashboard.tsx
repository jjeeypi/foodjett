import { Head, Link } from '@inertiajs/react';
import { Banknote, Bike } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function RiderDashboard() {
    return (
        <>
            <Head title="Rider dashboard" />
            <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">
                        Rider dashboard
                    </h1>
                    <p className="text-muted-foreground text-sm">
                        Accept deliveries, record collections, and remit cash.
                    </p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                    <Card>
                        <CardHeader>
                            <Bike className="size-5" />
                            <CardTitle>Delivery orders</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Button asChild>
                                <Link href="/rider/orders">
                                    View order pool
                                </Link>
                            </Button>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader>
                            <Banknote className="size-5" />
                            <CardTitle>Cash remittance</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Button asChild variant="outline">
                                <Link href="/rider/remittances">
                                    Remit collected cash
                                </Link>
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </>
    );
}
