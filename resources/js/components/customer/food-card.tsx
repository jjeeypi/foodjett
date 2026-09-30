import { Link } from '@inertiajs/react';
import { Navigation, Plus, ShoppingBag, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCart } from '@/contexts/cart-context';
import type { CatalogFood } from '@/types/customer-catalog';

const money = new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
});

export default function FoodCard({
    item,
    onConfigure,
    hideRestaurant = false,
}: {
    item: CatalogFood;
    onConfigure: (item: CatalogFood) => void;
    hideRestaurant?: boolean;
}) {
    const { addItem } = useCart();
    const canAdd = item.is_available && item.restaurant.is_open;
    const hasOptions = item.variants.length > 0 || item.addons.length > 0;

    const add = () => {
        if (!canAdd) return;

        if (hasOptions) {
            onConfigure(item);
            return;
        }

        addItem({
            menuItemId: item.id,
            restaurantId: item.restaurant.id,
            restaurantName: item.restaurant.name,
            name: item.name,
            photoUrl: item.photo_url,
            basePrice: item.base_price,
            variant: null,
            addons: [],
            specialInstructions: '',
        });
    };

    return (
        <article
            className={`bg-card overflow-hidden rounded-2xl border shadow-sm ${canAdd ? '' : 'opacity-65 grayscale-[25%]'}`}
        >
            <button
                type="button"
                onClick={add}
                disabled={!canAdd}
                className="bg-muted relative block aspect-square w-full overflow-hidden text-left disabled:cursor-not-allowed md:aspect-[4/3]"
                aria-label={`Configure ${item.name}`}
            >
                {item.photo_url ? (
                    <img
                        src={item.photo_url}
                        alt={item.name}
                        className="size-full object-cover transition duration-300 hover:scale-[1.03]"
                    />
                ) : (
                    <span className="from-primary/10 via-muted to-muted flex size-full items-center justify-center bg-gradient-to-br">
                        <ShoppingBag className="text-primary/50 size-9" />
                    </span>
                )}
                {!canAdd && (
                    <span className="absolute top-2 left-2 rounded-full bg-neutral-950/85 px-2 py-1 text-[10px] font-medium text-white md:top-3 md:left-3 md:px-2.5 md:text-xs">
                        {!item.restaurant.is_open
                            ? 'Restaurant closed'
                            : item.availability_label}
                    </span>
                )}
            </button>
            <div className="space-y-2.5 p-3 md:space-y-3 md:p-4">
                <div>
                    <div className="flex items-start justify-between gap-2">
                        <h3 className="line-clamp-2 min-h-10 text-sm font-semibold md:line-clamp-1 md:min-h-0 md:text-base">
                            {item.name}
                        </h3>
                        <span className="hidden shrink-0 text-sm font-semibold md:inline">
                            {money.format(item.base_price)}
                        </span>
                    </div>
                    {item.description && (
                        <p className="text-muted-foreground mt-1 line-clamp-2 text-xs md:text-sm">
                            {item.description}
                        </p>
                    )}
                </div>
                {!hideRestaurant && (
                    <Link
                        href={item.restaurant.show_url}
                        className="text-muted-foreground block truncate text-xs hover:underline md:text-sm"
                    >
                        {item.restaurant.name}
                    </Link>
                )}
                <div className="text-muted-foreground flex items-center justify-between gap-2 text-[11px]">
                    <span className="flex items-center gap-1">
                        <Star className="size-3.5 fill-amber-400 text-amber-500" />
                        {item.restaurant.rating ?? 'New'}
                    </span>
                    {item.distance_km !== null && (
                        <span className="flex items-center gap-1">
                            <Navigation className="size-3.5" />
                            {item.distance_km.toFixed(1)} km
                        </span>
                    )}
                </div>
                <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold md:hidden">
                        {money.format(item.base_price)}
                    </span>
                    <Button
                        type="button"
                        size="sm"
                        variant={canAdd ? 'default' : 'secondary'}
                        className="ml-auto min-w-10 rounded-xl px-3 md:w-full"
                        onClick={add}
                        disabled={!canAdd}
                        aria-label={canAdd ? `Add ${item.name}` : undefined}
                    >
                        {canAdd ? (
                            <>
                                <Plus />
                                <span className="hidden md:inline">Add</span>
                            </>
                        ) : (
                            <>
                                <ShoppingBag className="md:hidden" />
                                <span className="hidden md:inline">
                                    {!item.restaurant.is_open
                                        ? 'Restaurant closed'
                                        : item.availability_label}
                                </span>
                            </>
                        )}
                    </Button>
                </div>
            </div>
        </article>
    );
}
