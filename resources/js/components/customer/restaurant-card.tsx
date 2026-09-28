import { Link } from '@inertiajs/react';
import { Clock3, Navigation, Star, Store, Utensils } from 'lucide-react';
import type { RestaurantCardData } from '@/types/customer-catalog';

export default function RestaurantCard({
    restaurant,
}: {
    restaurant: RestaurantCardData;
}) {
    return (
        <Link
            href={restaurant.show_url}
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
                {!restaurant.is_open && (
                    <span className="absolute top-3 left-3 rounded-full bg-neutral-900/85 px-2.5 py-1 text-xs font-medium text-white">
                        Closed
                    </span>
                )}
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
