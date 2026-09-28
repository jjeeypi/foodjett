import { Minus, Plus } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useCart } from '@/contexts/cart-context';
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
        <form onSubmit={submit} className="space-y-5">
            {item.photo_url && (
                <img
                    src={item.photo_url}
                    alt={item.name}
                    className="aspect-[16/7] w-full rounded-lg object-cover"
                />
            )}
            {item.variants.length > 0 && (
                <fieldset className="space-y-2">
                    <legend className="text-sm font-semibold">
                        Choose a variant
                    </legend>
                    {item.variants.map((candidate) => (
                        <label
                            key={candidate.id}
                            className="hover:bg-muted flex cursor-pointer items-center justify-between gap-3 rounded-lg border p-3"
                        >
                            <span className="flex items-center gap-3">
                                <input
                                    type="radio"
                                    name="variant"
                                    value={candidate.id}
                                    checked={variantId === candidate.id}
                                    onChange={() => setVariantId(candidate.id)}
                                />
                                <span className="text-sm">
                                    {candidate.name}
                                </span>
                            </span>
                            <span className="text-muted-foreground text-sm">
                                {candidate.price_delta === 0
                                    ? 'Included'
                                    : `${candidate.price_delta > 0 ? '+' : '−'}${money.format(Math.abs(candidate.price_delta))}`}
                            </span>
                        </label>
                    ))}
                </fieldset>
            )}

            {item.addons.length > 0 && (
                <fieldset className="space-y-2">
                    <legend className="text-sm font-semibold">
                        Add extras
                    </legend>
                    {item.addons.map((addon) => (
                        <label
                            key={addon.id}
                            className="hover:bg-muted flex cursor-pointer items-center justify-between gap-3 rounded-lg border p-3"
                        >
                            <span className="flex items-center gap-3">
                                <Checkbox
                                    checked={addonIds.includes(addon.id)}
                                    onCheckedChange={(checked) =>
                                        setAddonIds((current) =>
                                            checked
                                                ? [...current, addon.id]
                                                : current.filter(
                                                      (id) => id !== addon.id,
                                                  ),
                                        )
                                    }
                                />
                                <span className="text-sm">{addon.name}</span>
                            </span>
                            <span className="text-muted-foreground text-sm">
                                +{money.format(addon.price)}
                            </span>
                        </label>
                    ))}
                </fieldset>
            )}

            <div className="space-y-2">
                <Label htmlFor="item-instructions">Special instructions</Label>
                <textarea
                    id="item-instructions"
                    value={instructions}
                    onChange={(event) => setInstructions(event.target.value)}
                    maxLength={300}
                    rows={3}
                    placeholder="Optional: less spicy, sauce on the side…"
                    className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 w-full resize-none rounded-md border px-3 py-2 text-sm outline-none focus-visible:ring-[3px]"
                />
            </div>

            <DialogFooter className="items-center sm:justify-between">
                <div className="flex items-center rounded-md border">
                    <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="rounded-r-none"
                        onClick={() =>
                            setQuantity((current) => Math.max(1, current - 1))
                        }
                        aria-label="Decrease quantity"
                    >
                        <Minus />
                    </Button>
                    <span className="w-10 text-center text-sm font-semibold">
                        {quantity}
                    </span>
                    <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="rounded-l-none"
                        onClick={() =>
                            setQuantity((current) => Math.min(20, current + 1))
                        }
                        aria-label="Increase quantity"
                    >
                        <Plus />
                    </Button>
                </div>
                <Button type="submit" className="min-w-44">
                    Add · {money.format(unitPrice * quantity)}
                </Button>
            </DialogFooter>
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
                <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
                    <DialogHeader>
                        <DialogTitle>{item.name}</DialogTitle>
                        <DialogDescription>
                            Customize your order from {item.restaurant.name}.
                        </DialogDescription>
                    </DialogHeader>
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
