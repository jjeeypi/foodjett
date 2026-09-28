import { Head, Link } from '@inertiajs/react';
import { ArrowRight, MapPin } from 'lucide-react';
import RestaurantCard from '@/components/customer/restaurant-card';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import type { RestaurantCardData } from '@/types/customer-catalog';

type Address = {
    id: number;
    label: string;
    address_line: string;
    latitude: number;
    longitude: number;
    is_default: boolean;
};

type HomeProps = {
    featuredRestaurants: RestaurantCardData[];
    nearbyRestaurants: RestaurantCardData[];
    featuredSource: 'featured_items' | 'recent';
    defaultAddress: Address | null;
    cuisines: string[];
};

function RestaurantGrid({
    restaurants,
}: {
    restaurants: RestaurantCardData[];
}) {
    return (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {restaurants.map((restaurant) => (
                <RestaurantCard key={restaurant.id} restaurant={restaurant} />
            ))}
        </div>
    );
}

export default function CustomerHome({
    featuredRestaurants,
    nearbyRestaurants,
    featuredSource,
    defaultAddress,
    cuisines,
}: HomeProps) {
    return (
        <>
            <Head title="Home" />

            <div className="mx-auto w-full max-w-7xl space-y-10 px-4 py-6 md:px-6 md:py-8">
                <section className="bg-primary/8 overflow-hidden rounded-2xl border p-6 md:p-8">
                    <div className="max-w-2xl">
                        <p className="text-primary text-sm font-semibold">
                            Food delivered around Dumaguete
                        </p>
                        <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">
                            What are you craving today?
                        </h1>
                        <p className="text-muted-foreground mt-3 max-w-xl">
                            Browse nearby local restaurants, discover a new
                            favorite, and follow your order from kitchen to
                            doorstep.
                        </p>
                        <Button asChild className="mt-6">
                            <Link href="/customer/foods">
                                Browse all food <ArrowRight />
                            </Link>
                        </Button>
                    </div>
                </section>

                <section aria-labelledby="cuisine-heading">
                    <div className="mb-4">
                        <h2
                            id="cuisine-heading"
                            className="text-xl font-semibold tracking-tight"
                        >
                            Browse by cuisine
                        </h2>
                        <p className="text-muted-foreground mt-1 text-sm">
                            Find food that matches your mood.
                        </p>
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-2">
                        {cuisines.map((cuisine) => (
                            <Link
                                key={cuisine}
                                href={`/customer/search?cuisine=${encodeURIComponent(cuisine)}`}
                                className="bg-background hover:bg-muted shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors"
                            >
                                {cuisine}
                            </Link>
                        ))}
                    </div>
                </section>

                <section aria-labelledby="featured-heading">
                    <div className="mb-5 flex items-end justify-between gap-4">
                        <div>
                            <h2
                                id="featured-heading"
                                className="text-xl font-semibold tracking-tight"
                            >
                                {featuredSource === 'featured_items'
                                    ? 'Featured restaurants'
                                    : 'New around you'}
                            </h2>
                            <p className="text-muted-foreground mt-1 text-sm">
                                {featuredSource === 'featured_items'
                                    ? 'Restaurants serving featured menu picks.'
                                    : 'Recently added restaurants worth trying.'}
                            </p>
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            asChild
                            className="hidden sm:inline-flex"
                        >
                            <Link href="/customer/search">
                                View all <ArrowRight />
                            </Link>
                        </Button>
                    </div>
                    {featuredRestaurants.length > 0 ? (
                        <RestaurantGrid restaurants={featuredRestaurants} />
                    ) : (
                        <Card>
                            <CardContent className="text-muted-foreground py-8 text-sm">
                                No restaurants are accepting orders right now.
                            </CardContent>
                        </Card>
                    )}
                </section>

                <section aria-labelledby="nearby-heading">
                    <div className="mb-5">
                        <h2
                            id="nearby-heading"
                            className="text-xl font-semibold tracking-tight"
                        >
                            Nearby restaurants
                        </h2>
                        {defaultAddress && (
                            <p className="text-muted-foreground mt-1 flex items-center gap-1.5 text-sm">
                                <MapPin className="size-4" />
                                Near {defaultAddress.label} —{' '}
                                {defaultAddress.address_line}
                            </p>
                        )}
                    </div>
                    {defaultAddress ? (
                        nearbyRestaurants.length > 0 ? (
                            <RestaurantGrid restaurants={nearbyRestaurants} />
                        ) : (
                            <Card>
                                <CardContent className="text-muted-foreground py-8 text-sm">
                                    No nearby restaurants are open right now.
                                </CardContent>
                            </Card>
                        )
                    ) : (
                        <Card className="border-dashed">
                            <CardHeader>
                                <div className="bg-primary/10 text-primary mb-2 flex size-10 items-center justify-center rounded-full">
                                    <MapPin className="size-5" />
                                </div>
                                <CardTitle className="text-lg">
                                    Add your delivery address
                                </CardTitle>
                                <CardDescription>
                                    We need a location before we can sort
                                    restaurants by distance.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Button asChild>
                                    <Link href="/customer/addresses">
                                        Add an address
                                    </Link>
                                </Button>
                            </CardContent>
                        </Card>
                    )}
                </section>
            </div>
        </>
    );
}
