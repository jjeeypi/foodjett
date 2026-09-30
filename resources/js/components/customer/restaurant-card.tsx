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
            className="group focus-visible:ring-ring bg-card overflow-hidden rounded-2xl border shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-2 focus-visible:outline-none"
        >
            <div className="bg-muted relative aspect-[4/3] overflow-hidden md:aspect-[16/9]">
                {restaurant.cover_photo_url ? (
                    <img
                        src={restaurant.cover_photo_url}
                        alt={`${restaurant.name} cover`}
                        className="size-full object-cover transition duration-300 group-hover:scale-[1.03]"
                    />
                ) : (
                    <div className="from-primary/15 via-muted to-muted flex size-full items-center justify-center bg-gradient-to-br">
                        <Utensils className="text-primary/60 size-9 md:size-10" />
                    </div>
                )}
                <span className="bg-background/90 absolute right-2 bottom-2 rounded-full px-2 py-1 text-[10px] font-semibold shadow-sm backdrop-blur md:right-3 md:bottom-3 md:px-2.5 md:text-xs">
                    {restaurant.estimated_delivery_minutes.minimum}–
                    {restaurant.estimated_delivery_minutes.maximum} min
                </span>
                {!restaurant.is_open && (
                    <span className="absolute top-2 left-2 rounded-full bg-neutral-950/85 px-2 py-1 text-[10px] font-medium text-white md:top-3 md:left-3 md:px-2.5 md:text-xs">
                        Closed
                    </span>
                )}
            </div>
            <div className="p-3 md:p-4">
                <div className="flex items-start gap-3">
                    {restaurant.logo_url ? (
                        <img
                            src={restaurant.logo_url}
                            alt=""
                            className="hidden size-11 shrink-0 rounded-lg border object-cover md:block"
                        />
                    ) : (
                        <div className="bg-primary/10 text-primary hidden size-11 shrink-0 items-center justify-center rounded-lg md:flex">
                            <Store className="size-5" />
                        </div>
                    )}
                    <div className="min-w-0 flex-1">
                        <h3 className="line-clamp-2 min-h-10 text-sm font-semibold md:line-clamp-1 md:min-h-0 md:text-base">
                            {restaurant.name}
                        </h3>
                        <p className="text-muted-foreground mt-0.5 truncate text-xs md:mt-0 md:text-sm">
                            {restaurant.cuisine_type}
                        </p>
                    </div>
                </div>
                <div className="text-muted-foreground mt-3 flex items-center justify-between gap-2 text-[11px] md:mt-4 md:flex-wrap md:justify-start md:gap-x-4 md:gap-y-2 md:text-xs">
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
                    <span className="hidden items-center gap-1 md:flex">
                        <Clock3 className="size-3.5" />
                        Est. delivery
                    </span>
                </div>
            </div>
        </Link>
    );
}
