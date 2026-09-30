import { Clock3, Minus, Plus, ShoppingBag, Star } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useCart } from '@/contexts/cart-context';
import { cn } from '@/lib/utils';
import type { CatalogFood } from '@/types/customer-catalog';

const money = new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
});

function ItemForm({
    item,
    onClose,
}: {
    item: CatalogFood;
    onClose: () => void;
}) {
    const { addItem } = useCart();
    const [variantId, setVariantId] = useState<number | null>(
        item.variants[0]?.id ?? null,
    );
    const [addonIds, setAddonIds] = useState<number[]>([]);
    const [quantity, setQuantity] = useState(1);
    const [instructions, setInstructions] = useState('');
    const variant =
        item.variants.find((candidate) => candidate.id === variantId) ?? null;
    const addons = item.addons.filter((addon) => addonIds.includes(addon.id));
    const unitPrice =
        item.base_price +
        (variant?.price_delta ?? 0) +
        addons.reduce((total, addon) => total + addon.price, 0);

    const submit = (event: FormEvent) => {
        event.preventDefault();
        const added = addItem({
            menuItemId: item.id,
            restaurantId: item.restaurant.id,
            restaurantName: item.restaurant.name,
            name: item.name,
            photoUrl: item.photo_url,
            basePrice: item.base_price,
            variant: variant
                ? {
                      id: variant.id,
                      name: variant.name,
                      priceDelta: variant.price_delta,
                  }
                : null,
            addons,
            specialInstructions: instructions.trim(),
            quantity,
        });

        if (added) onClose();
    };

    return (
        <form onSubmit={submit} className="contents">
            <div className="bg-muted relative aspect-[5/4] w-full overflow-hidden sm:aspect-[16/7] sm:rounded-lg">
                {item.photo_url ? (
                    <img
                        src={item.photo_url}
                        alt={item.name}
                        className="size-full object-cover"
                    />
                ) : (
                    <div className="from-primary/15 via-muted to-muted flex size-full items-center justify-center bg-gradient-to-br">
                        <ShoppingBag className="text-primary/50 size-14" />
                    </div>
                )}
                <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/45 to-transparent sm:hidden" />
            </div>

            <div className="min-h-0 space-y-6 overflow-y-auto px-5 pt-5 pb-28 sm:px-0 sm:pt-0 sm:pb-0">
                <DialogHeader className="space-y-2 text-left">
                    <DialogTitle className="pr-8 text-2xl leading-tight">
                        {item.name}
                    </DialogTitle>
                    <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                        <span className="flex items-center gap-1">
                            <Star className="size-4 fill-amber-400 text-amber-500" />
                            {item.restaurant.rating ?? 'New'}
                        </span>
                        <span aria-hidden="true">•</span>
                        <span className="flex items-center gap-1">
                            <Clock3 className="size-4" />
                            {item.restaurant.estimated_delivery_minutes.minimum}
                            –
                            {item.restaurant.estimated_delivery_minutes.maximum}{' '}
                            min
                        </span>
                        <span aria-hidden="true">•</span>
                        <span>{item.restaurant.name}</span>
                    </div>
                    <DialogDescription className="text-sm leading-6">
                        {item.description ??
                            `Customize this item from ${item.restaurant.name}.`}
                    </DialogDescription>
                </DialogHeader>

                {item.variants.length > 0 && (
                    <fieldset className="space-y-3">
                        <legend className="text-sm font-semibold">
                            Choose a variant
                        </legend>
                        <div className="flex flex-wrap gap-2">
                            {item.variants.map((candidate) => {
                                const selected = variantId === candidate.id;

                                return (
                                    <label
                                        key={candidate.id}
                                        className={cn(
                                            'cursor-pointer rounded-full border px-4 py-2.5 text-sm transition',
                                            selected
                                                ? 'border-primary bg-primary text-primary-foreground font-semibold'
                                                : 'bg-card hover:border-primary/50',
                                        )}
                                    >
                                        <input
                                            type="radio"
                                            name="variant"
                                            value={candidate.id}
                                            checked={selected}
                                            onChange={() =>
                                                setVariantId(candidate.id)
                                            }
                                            className="sr-only"
                                        />
                                        {candidate.name}
                                        {candidate.price_delta !== 0 && (
                                            <span className="ml-1.5 opacity-75">
                                                {candidate.price_delta > 0
                                                    ? '+'
                                                    : '−'}
                                                {money.format(
                                                    Math.abs(
                                                        candidate.price_delta,
                                                    ),
                                                )}
                                            </span>
                                        )}
                                    </label>
                                );
                            })}
                        </div>
                    </fieldset>
                )}

                {item.addons.length > 0 && (
                    <fieldset className="space-y-3">
                        <legend className="text-sm font-semibold">
                            Add extras
                        </legend>
                        <div className="space-y-2">
                            {item.addons.map((addon) => (
                                <label
                                    key={addon.id}
                                    className="bg-card hover:border-primary/50 flex cursor-pointer items-center justify-between gap-3 rounded-2xl border p-3.5 transition"
                                >
                                    <span className="flex items-center gap-3">
                                        <Checkbox
                                            checked={addonIds.includes(
                                                addon.id,
                                            )}
                                            onCheckedChange={(checked) =>
                                                setAddonIds((current) =>
                                                    checked
                                                        ? [...current, addon.id]
                                                        : current.filter(
                                                              (id) =>
                                                                  id !==
                                                                  addon.id,
                                                          ),
                                                )
                                            }
                                        />
                                        <span className="text-sm">
                                            {addon.name}
                                        </span>
                                    </span>
                                    <span className="text-muted-foreground text-sm">
                                        +{money.format(addon.price)}
                                    </span>
                                </label>
                            ))}
                        </div>
                    </fieldset>
                )}

                <div className="flex items-end justify-between gap-4">
                    <div>
                        <p className="mb-2 text-sm font-semibold">Portion</p>
                        <div className="bg-card flex items-center rounded-2xl border p-1">
                            <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                className="size-10 rounded-xl"
                                onClick={() =>
                                    setQuantity((current) =>
                                        Math.max(1, current - 1),
                                    )
                                }
                                aria-label="Decrease quantity"
                            >
                                <Minus />
                            </Button>
                            <span className="w-10 text-center text-sm font-bold">
                                {quantity}
                            </span>
                            <Button
                                type="button"
                                size="icon"
                                className="size-10 rounded-xl"
                                onClick={() =>
                                    setQuantity((current) =>
                                        Math.min(20, current + 1),
                                    )
                                }
                                aria-label="Increase quantity"
                            >
                                <Plus />
                            </Button>
                        </div>
                    </div>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="item-instructions">
                        Special instructions
                    </Label>
                    <textarea
                        id="item-instructions"
                        value={instructions}
                        onChange={(event) =>
                            setInstructions(event.target.value)
                        }
                        maxLength={300}
                        rows={3}
                        placeholder="Optional: less spicy, sauce on the side…"
                        className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 w-full resize-none rounded-2xl border px-3 py-2 text-sm outline-none focus-visible:ring-[3px]"
                    />
                </div>
            </div>

            <div className="bg-background/95 border-border absolute inset-x-0 bottom-0 flex items-center gap-4 border-t px-5 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur sm:static sm:mt-5 sm:border-0 sm:bg-transparent sm:px-0 sm:pt-0 sm:pb-0">
                <div className="min-w-0 flex-1">
                    <p className="text-muted-foreground text-xs">Total</p>
                    <p className="truncate text-xl font-bold">
                        {money.format(unitPrice * quantity)}
                    </p>
                </div>
                <Button
                    type="submit"
                    size="lg"
                    className="min-w-44 rounded-2xl shadow-[0_0_22px_rgba(57,255,20,0.18)]"
                >
                    Add to Cart
                </Button>
            </div>
        </form>
    );
}

export default function ItemModal({
    item,
    open,
    onOpenChange,
}: {
    item: CatalogFood | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            {item && (
                <DialogContent className="customer-mobile-surface top-auto bottom-0 left-0 max-h-[96dvh] w-full max-w-none translate-x-0 translate-y-0 gap-0 overflow-hidden rounded-t-[2rem] border-x-0 border-b-0 p-0 sm:top-1/2 sm:left-1/2 sm:max-h-[90vh] sm:max-w-xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:overflow-y-auto sm:rounded-xl sm:border sm:p-6">
                    <ItemForm
                        key={item.id}
                        item={item}
                        onClose={() => onOpenChange(false)}
                    />
                </DialogContent>
            )}
        </Dialog>
    );
}
