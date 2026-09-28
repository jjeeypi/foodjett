import { Link } from '@inertiajs/react';
import { Navigation, Plus, ShoppingBag } from 'lucide-react';
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
            className={`bg-card overflow-hidden rounded-xl border shadow-sm ${canAdd ? '' : 'opacity-65 grayscale-[25%]'}`}
        >
            <button
                type="button"
                onClick={add}
                disabled={!canAdd}
                className="bg-muted relative block aspect-[4/3] w-full overflow-hidden text-left disabled:cursor-not-allowed"
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
                    <span className="absolute top-3 left-3 rounded-full bg-neutral-900/85 px-2.5 py-1 text-xs font-medium text-white">
                        {!item.restaurant.is_open
                            ? 'Restaurant closed'
                            : item.availability_label}
                    </span>
                )}
            </button>
            <div className="space-y-3 p-4">
                <div>
                    <div className="flex items-start justify-between gap-3">
                        <h3 className="font-semibold">{item.name}</h3>
                        <span className="shrink-0 text-sm font-semibold">
                            {money.format(item.base_price)}
                        </span>
                    </div>
                    {item.description && (
                        <p className="text-muted-foreground mt-1 line-clamp-2 text-sm">
                            {item.description}
                        </p>
                    )}
                </div>
                {!hideRestaurant && (
                    <div className="flex items-center justify-between gap-2 text-sm">
                        <Link
                            href={item.restaurant.show_url}
                            className="text-primary truncate font-medium hover:underline"
                        >
                            {item.restaurant.name}
                        </Link>
                        {item.distance_km !== null && (
                            <span className="text-muted-foreground flex shrink-0 items-center gap-1 text-xs">
                                <Navigation className="size-3.5" />
                                {item.distance_km.toFixed(1)} km
                            </span>
                        )}
                    </div>
                )}
                <Button
                    type="button"
                    variant={canAdd ? 'default' : 'secondary'}
                    className="w-full"
                    onClick={add}
                    disabled={!canAdd}
                >
                    {canAdd ? (
                        <>
                            <Plus /> Add
                        </>
                    ) : !item.restaurant.is_open ? (
                        'Restaurant closed'
                    ) : (
                        item.availability_label
                    )}
                </Button>
            </div>
        </article>
    );
}
