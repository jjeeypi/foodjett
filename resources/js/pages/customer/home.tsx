import { Head, Link, router } from '@inertiajs/react';
import { ArrowRight, MapPin, Search, SlidersHorizontal } from 'lucide-react';
import { useState, type FormEvent } from 'react';
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
        <div className="grid grid-cols-2 gap-3 sm:gap-5 xl:grid-cols-3">
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
    const [search, setSearch] = useState('');

    const submitSearch = (event: FormEvent) => {
        event.preventDefault();
        router.get(
            '/customer/search',
            search.trim() === '' ? {} : { q: search.trim() },
        );
    };

    return (
        <>
            <Head title="Home" />

            <div className="mx-auto w-full max-w-7xl space-y-7 px-4 py-5 md:space-y-10 md:px-6 md:py-8">
                <section className="md:hidden" aria-label="Find food">
                    <p className="mb-4 text-sm font-medium text-white/60">
                        Order your favourite food!
                    </p>
                    <form onSubmit={submitSearch} className="flex gap-2.5">
                        <label className="relative min-w-0 flex-1">
                            <span className="sr-only">
                                Search food or restaurant
                            </span>
                            <Search className="text-muted-foreground absolute top-1/2 left-4 size-5 -translate-y-1/2" />
                            <input
                                type="search"
                                value={search}
                                onChange={(event) =>
                                    setSearch(event.target.value)
                                }
                                placeholder="Search food or restaurant"
                                className="bg-card border-border focus:border-primary focus:ring-primary/25 h-13 w-full rounded-2xl border pr-4 pl-12 text-sm text-white transition outline-none focus:ring-4"
                            />
                        </label>
                        <Button
                            asChild
                            size="icon"
                            className="size-13 shrink-0 rounded-2xl shadow-[0_0_22px_rgba(57,255,20,0.18)]"
                        >
                            <Link
                                href="/customer/search"
                                aria-label="Open search filters"
                            >
                                <SlidersHorizontal className="size-5" />
                            </Link>
                        </Button>
                    </form>
                </section>

                <section className="bg-primary/8 hidden overflow-hidden rounded-2xl border p-6 md:block md:p-8">
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
                    <div className="mb-4 hidden md:block">
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
                    <div className="customer-scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0">
                        <Link
                            href="/customer/search"
                            className="bg-primary text-primary-foreground border-primary md:bg-background md:text-foreground md:border-border shrink-0 rounded-full border px-5 py-2.5 text-sm font-semibold shadow-[0_0_16px_rgba(57,255,20,0.14)] md:px-4 md:py-2 md:shadow-none"
                        >
                            All
                        </Link>
                        {cuisines.map((cuisine) => (
                            <Link
                                key={cuisine}
                                href={`/customer/search?cuisine=${encodeURIComponent(cuisine)}`}
                                className="bg-card hover:bg-muted md:bg-background shrink-0 rounded-full border px-5 py-2.5 text-sm font-medium transition-colors md:px-4 md:py-2"
                            >
                                {cuisine}
                            </Link>
                        ))}
                    </div>
                </section>

                <section aria-labelledby="featured-heading">
                    <div className="mb-4 flex items-end justify-between gap-4 md:mb-5">
                        <div>
                            <h2
                                id="featured-heading"
                                className="text-xl font-semibold tracking-tight"
                            >
                                {featuredSource === 'featured_items'
                                    ? 'Featured restaurants'
                                    : 'New around you'}
                            </h2>
                            <p className="text-muted-foreground mt-1 hidden text-sm md:block">
                                {featuredSource === 'featured_items'
                                    ? 'Restaurants serving featured menu picks.'
                                    : 'Recently added restaurants worth trying.'}
                            </p>
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            asChild
                            className="text-primary inline-flex px-0 sm:px-3"
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
                                    <Link href="/customer/account/addresses">
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
