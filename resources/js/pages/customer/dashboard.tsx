import { Head, Link } from '@inertiajs/react';
import { MapPin, Utensils } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';

type Restaurant = {
    id: number;
    name: string;
    cuisine_type: string;
    address: string;
    min_order_amount: string;
};

export default function CustomerDashboard({
    restaurants,
}: {
    restaurants: Restaurant[];
}) {
    return (
        <>
            <Head title="Customer dashboard" />
            <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">
                        Restaurants
                    </h1>
                    <p className="text-muted-foreground mt-1 text-sm">
                        Choose a restaurant to build your order and checkout.
                    </p>
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {restaurants.map((restaurant) => (
                        <Card key={restaurant.id}>
                            <CardHeader>
                                <Utensils className="text-muted-foreground size-5" />
                                <CardTitle>{restaurant.name}</CardTitle>
                                <CardDescription>
                                    {restaurant.cuisine_type}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <p className="text-muted-foreground flex gap-2 text-sm">
                                    <MapPin className="mt-0.5 size-4 shrink-0" />
                                    {restaurant.address}
                                </p>
                                <Button asChild className="w-full">
                                    <Link
                                        href={`/customer/restaurants/${restaurant.id}/checkout`}
                                    >
                                        Order now
                                    </Link>
                                </Button>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {restaurants.length === 0 && (
                    <Card>
                        <CardContent className="text-muted-foreground pt-6 text-sm">
                            No restaurants are accepting orders right now.
                        </CardContent>
                    </Card>
                )}
            </div>
        </>
    );
}
