import { Head, Link } from '@inertiajs/react';
import {
    ArrowRight,
    Clock3,
    MapPin,
    Navigation,
    SearchX,
    Star,
    Store,
    Utensils,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';

type RestaurantCardData = {
    id: number;
    name: string;
    cuisine_type: string;
    address: string;
    cover_photo_url: string | null;
    logo_url: string | null;
    rating: number | null;
    review_count: number;
    distance_km: number | null;
    estimated_delivery_minutes: {
        minimum: number;
        maximum: number;
    };
    menu_url: string;
};

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
    browseRestaurants: RestaurantCardData[];
    featuredSource: 'featured_items' | 'recent';
    defaultAddress: Address | null;
    cuisines: string[];
    filters: { search: string; cuisine: string };
    isBrowsing: boolean;
};

function RestaurantCard({ restaurant }: { restaurant: RestaurantCardData }) {
    return (
        <Link
            href={restaurant.menu_url}
            className="group focus-visible:ring-ring bg-card overflow-hidden rounded-xl border shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-2 focus-visible:outline-none"
        >
            <div className="bg-muted relative aspect-[16/9] overflow-hidden">
                {restaurant.cover_photo_url ? (
                    <img
                        src={restaurant.cover_photo_url}
                        alt={`${restaurant.name} cover`}
                        className="size-full object-cover transition duration-300 group-hover:scale-[1.03]"
                    />
                ) : (
                    <div className="from-primary/15 via-muted to-muted flex size-full items-center justify-center bg-gradient-to-br">
                        <Utensils className="text-primary/60 size-10" />
                    </div>
                )}
                <span className="bg-background/90 absolute right-3 bottom-3 rounded-full px-2.5 py-1 text-xs font-medium shadow-sm backdrop-blur">
                    {restaurant.estimated_delivery_minutes.minimum}–
                    {restaurant.estimated_delivery_minutes.maximum} min
                </span>
            </div>
            <div className="p-4">
                <div className="flex items-start gap-3">
                    {restaurant.logo_url ? (
                        <img
                            src={restaurant.logo_url}
                            alt=""
                            className="size-11 shrink-0 rounded-lg border object-cover"
                        />
                    ) : (
                        <div className="bg-primary/10 text-primary flex size-11 shrink-0 items-center justify-center rounded-lg">
                            <Store className="size-5" />
                        </div>
                    )}
                    <div className="min-w-0 flex-1">
                        <h3 className="truncate font-semibold">
                            {restaurant.name}
                        </h3>
                        <p className="text-muted-foreground truncate text-sm">
                            {restaurant.cuisine_type}
                        </p>
                    </div>
                </div>
                <div className="text-muted-foreground mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
                    <span className="flex items-center gap-1">
                        <Star className="size-3.5 fill-amber-400 text-amber-500" />
                        {restaurant.rating === null
                            ? 'New'
                            : `${restaurant.rating} (${restaurant.review_count})`}
                    </span>
                    {restaurant.distance_km !== null && (
                        <span className="flex items-center gap-1">
                            <Navigation className="size-3.5" />
                            {restaurant.distance_km.toFixed(1)} km
                        </span>
                    )}
                    <span className="flex items-center gap-1">
                        <Clock3 className="size-3.5" />
                        Est. delivery
                    </span>
                </div>
            </div>
        </Link>
    );
}

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
    browseRestaurants,
    featuredSource,
    defaultAddress,
    cuisines,
    filters,
    isBrowsing,
}: HomeProps) {
    const hasFilters = filters.search !== '' || filters.cuisine !== '';
    const filteredHeading = filters.cuisine
        ? `${filters.cuisine} restaurants`
        : filters.search
          ? `Results for “${filters.search}”`
          : 'All restaurants';

    return (
        <>
            <Head title={isBrowsing ? 'Foods' : 'Home'} />

            <div className="mx-auto w-full max-w-7xl space-y-10 px-4 py-6 md:px-6 md:py-8">
                {!isBrowsing && (
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
                )}

                <section aria-labelledby="cuisine-heading">
                    <div className="mb-4 flex items-end justify-between gap-4">
                        <div>
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
                        {hasFilters && (
                            <Button variant="ghost" size="sm" asChild>
                                <Link href="/customer/foods">
                                    Clear filters
                                </Link>
                            </Button>
                        )}
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-2">
                        {cuisines.map((cuisine) => (
                            <Link
                                key={cuisine}
                                href={`/customer/foods?cuisine=${encodeURIComponent(cuisine)}`}
                                className={`shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                                    filters.cuisine === cuisine
                                        ? 'bg-primary text-primary-foreground border-primary'
                                        : 'bg-background hover:bg-muted'
                                }`}
                            >
                                {cuisine}
                            </Link>
                        ))}
                    </div>
                </section>

                {isBrowsing ? (
                    <section aria-labelledby="results-heading">
                        <div className="mb-5">
                            <h1
                                id="results-heading"
                                className="text-2xl font-semibold tracking-tight"
                            >
                                {filteredHeading}
                            </h1>
                            <p className="text-muted-foreground mt-1 text-sm">
                                {defaultAddress
                                    ? `Ordered from nearest to ${defaultAddress.label}.`
                                    : 'Add an address to sort these restaurants by distance.'}
                            </p>
                        </div>
                        {browseRestaurants.length > 0 ? (
                            <RestaurantGrid restaurants={browseRestaurants} />
                        ) : (
                            <Card>
                                <CardContent className="flex flex-col items-center py-12 text-center">
                                    <SearchX className="text-muted-foreground size-9" />
                                    <p className="mt-4 font-medium">
                                        No restaurants found
                                    </p>
                                    <p className="text-muted-foreground mt-1 text-sm">
                                        Try a different cuisine or search term.
                                    </p>
                                </CardContent>
                            </Card>
                        )}
                    </section>
                ) : (
                    <>
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
                                    <Link href="/customer/foods">
                                        View all <ArrowRight />
                                    </Link>
                                </Button>
                            </div>
                            {featuredRestaurants.length > 0 ? (
                                <RestaurantGrid
                                    restaurants={featuredRestaurants}
                                />
                            ) : (
                                <Card>
                                    <CardContent className="text-muted-foreground py-8 text-sm">
                                        No restaurants are accepting orders
                                        right now.
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
                                    <RestaurantGrid
                                        restaurants={nearbyRestaurants}
                                    />
                                ) : (
                                    <Card>
                                        <CardContent className="text-muted-foreground py-8 text-sm">
                                            No nearby restaurants are open right
                                            now.
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
                                            We need a location before we can
                                            sort restaurants by distance.
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
                    </>
                )}
            </div>
        </>
    );
}
