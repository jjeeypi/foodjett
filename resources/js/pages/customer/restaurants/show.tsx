import { Head } from '@inertiajs/react';
import {
    AlertCircle,
    Clock3,
    MapPin,
    PhilippinePeso,
    Star,
    Store,
} from 'lucide-react';
import { useState } from 'react';
import CardPagination from '@/components/customer/card-pagination';
import FoodCard from '@/components/customer/food-card';
import ItemModal from '@/components/customer/item-modal';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type {
    CatalogFood,
    Paginated,
    RestaurantCardData,
} from '@/types/customer-catalog';

type OpeningHour = {
    id: number;
    day: string;
    day_of_week: number;
    opens_at: string;
    closes_at: string;
};

type RestaurantDetail = RestaurantCardData & {
    description: string | null;
    operating_status: 'open' | 'closed' | 'temporarily_closed';
    min_order_amount: number;
    closed_message: string | null;
    opening_hours: OpeningHour[];
    menu_categories: Array<{
        id: number;
        name: string;
        items: CatalogFood[];
    }>;
};

type Review = {
    id: number;
    rating: number;
    comment: string | null;
    customer_name: string;
    restaurant_reply: string | null;
    created_at: string | null;
};

const money = new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
});

const date = new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'medium',
});

export default function RestaurantShow({
    restaurant,
    reviews,
}: {
    restaurant: RestaurantDetail;
    reviews: Paginated<Review>;
}) {
    const [selectedItem, setSelectedItem] = useState<CatalogFood | null>(null);

    return (
        <>
            <Head title={restaurant.name} />

            <div className="mx-auto w-full max-w-7xl px-4 py-6 md:px-6 md:py-8">
                <section className="bg-card overflow-hidden rounded-2xl border">
                    <div className="bg-muted relative aspect-[3/1] min-h-48 overflow-hidden">
                        {restaurant.cover_photo_url ? (
                            <img
                                src={restaurant.cover_photo_url}
                                alt={`${restaurant.name} cover`}
                                className="size-full object-cover"
                            />
                        ) : (
                            <div className="from-primary/15 via-muted to-muted size-full bg-gradient-to-br" />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/45 to-transparent" />
                        <Badge
                            className={`absolute top-4 right-4 ${
                                restaurant.is_open
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-neutral-900 text-white'
                            }`}
                        >
                            {restaurant.is_open ? 'Open now' : 'Closed'}
                        </Badge>
                    </div>

                    <div className="relative p-5 pt-14 md:p-7 md:pt-16">
                        <div className="bg-background absolute -top-10 left-5 flex size-20 items-center justify-center overflow-hidden rounded-2xl border-4 shadow-sm md:left-7">
                            {restaurant.logo_url ? (
                                <img
                                    src={restaurant.logo_url}
                                    alt={`${restaurant.name} logo`}
                                    className="size-full object-cover"
                                />
                            ) : (
                                <Store className="text-muted-foreground size-8" />
                            )}
                        </div>
                        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
                            <div>
                                <h1 className="text-3xl font-semibold tracking-tight">
                                    {restaurant.name}
                                </h1>
                                <p className="text-muted-foreground mt-1">
                                    {restaurant.cuisine_type}
                                </p>
                                {restaurant.description && (
                                    <p className="text-muted-foreground mt-3 max-w-2xl text-sm">
                                        {restaurant.description}
                                    </p>
                                )}
                            </div>
                            <div className="text-muted-foreground flex flex-wrap gap-x-5 gap-y-2 text-sm">
                                <span className="flex items-center gap-1.5">
                                    <Star className="size-4 fill-amber-400 text-amber-500" />
                                    {restaurant.rating === null
                                        ? 'New'
                                        : `${restaurant.rating} (${restaurant.review_count} reviews)`}
                                </span>
                                <span className="flex items-center gap-1.5">
                                    <Clock3 className="size-4" />
                                    {
                                        restaurant.estimated_delivery_minutes
                                            .minimum
                                    }
                                    –
                                    {
                                        restaurant.estimated_delivery_minutes
                                            .maximum
                                    }{' '}
                                    min
                                </span>
                                <span className="flex items-center gap-1.5">
                                    <PhilippinePeso className="size-4" />
                                    {money.format(
                                        restaurant.min_order_amount,
                                    )}{' '}
                                    minimum
                                </span>
                            </div>
                        </div>
                        <p className="text-muted-foreground mt-4 flex gap-2 text-sm">
                            <MapPin className="mt-0.5 size-4 shrink-0" />
                            {restaurant.address}
                        </p>
                    </div>
                </section>

                {!restaurant.is_open && (
                    <div className="mt-6 flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
                        <AlertCircle className="mt-0.5 size-5 shrink-0" />
                        <div>
                            <p className="font-semibold">
                                {restaurant.closed_message}
                            </p>
                            <p className="mt-1 text-sm opacity-80">
                                You can still browse the menu, but adding items
                                is disabled until the restaurant reopens.
                            </p>
                        </div>
                    </div>
                )}

                <div className="mt-8 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
                    <main className="space-y-10">
                        {restaurant.menu_categories.map((category) => (
                            <section
                                key={category.id}
                                aria-labelledby={`category-${category.id}`}
                            >
                                <h2
                                    id={`category-${category.id}`}
                                    className="mb-4 text-xl font-semibold tracking-tight"
                                >
                                    {category.name}
                                </h2>
                                {category.items.length > 0 ? (
                                    <div className="grid grid-cols-2 gap-3 sm:gap-5 xl:grid-cols-3">
                                        {category.items.map((item) => (
                                            <FoodCard
                                                key={item.id}
                                                item={item}
                                                onConfigure={setSelectedItem}
                                                hideRestaurant
                                            />
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-muted-foreground text-sm">
                                        No items in this category yet.
                                    </p>
                                )}
                            </section>
                        ))}

                        {restaurant.menu_categories.length === 0 && (
                            <Card>
                                <CardContent className="text-muted-foreground py-10 text-center text-sm">
                                    This restaurant has not published its menu
                                    yet.
                                </CardContent>
                            </Card>
                        )}
                    </main>

                    <aside className="lg:sticky lg:top-28">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">
                                    Opening hours
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                {restaurant.opening_hours.length > 0 ? (
                                    <dl className="space-y-2 text-sm">
                                        {restaurant.opening_hours.map(
                                            (hour) => (
                                                <div
                                                    key={hour.id}
                                                    className="flex items-center justify-between gap-3"
                                                >
                                                    <dt className="text-muted-foreground">
                                                        {hour.day}
                                                    </dt>
                                                    <dd className="text-right font-medium">
                                                        {hour.opens_at}–
                                                        {hour.closes_at}
                                                    </dd>
                                                </div>
                                            ),
                                        )}
                                    </dl>
                                ) : (
                                    <p className="text-muted-foreground text-sm">
                                        Hours have not been published. The
                                        restaurant’s Open/Closed toggle is used.
                                    </p>
                                )}
                            </CardContent>
                        </Card>
                    </aside>
                </div>

                <section id="reviews" className="mt-12 border-t pt-10">
                    <div className="mb-5">
                        <h2 className="text-2xl font-semibold tracking-tight">
                            Customer reviews
                        </h2>
                        <p className="text-muted-foreground mt-1 text-sm">
                            Feedback from verified orders.
                        </p>
                    </div>
                    {reviews.data.length > 0 ? (
                        <div className="grid gap-4 md:grid-cols-2">
                            {reviews.data.map((review) => (
                                <Card key={review.id}>
                                    <CardContent className="space-y-3 pt-6">
                                        <div className="flex items-start justify-between gap-4">
                                            <div>
                                                <p className="font-medium">
                                                    {review.customer_name}
                                                </p>
                                                {review.created_at && (
                                                    <p className="text-muted-foreground text-xs">
                                                        {date.format(
                                                            new Date(
                                                                review.created_at,
                                                            ),
                                                        )}
                                                    </p>
                                                )}
                                            </div>
                                            <span className="flex items-center gap-1 text-sm font-medium">
                                                <Star className="size-4 fill-amber-400 text-amber-500" />
                                                {review.rating}
                                            </span>
                                        </div>
                                        {review.comment && (
                                            <p className="text-sm">
                                                {review.comment}
                                            </p>
                                        )}
                                        {review.restaurant_reply && (
                                            <div className="bg-muted rounded-lg p-3 text-sm">
                                                <p className="font-medium">
                                                    Restaurant reply
                                                </p>
                                                <p className="text-muted-foreground mt-1">
                                                    {review.restaurant_reply}
                                                </p>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    ) : (
                        <Card>
                            <CardContent className="text-muted-foreground py-10 text-center text-sm">
                                No reviews yet. Be the first after completing an
                                order.
                            </CardContent>
                        </Card>
                    )}
                    <CardPagination paginated={reviews} />
                </section>
            </div>

            <ItemModal
                item={selectedItem}
                open={selectedItem !== null}
                onOpenChange={(open) => !open && setSelectedItem(null)}
            />
        </>
    );
}
