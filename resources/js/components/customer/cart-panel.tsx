import { Link } from '@inertiajs/react';
import { Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetFooter,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import { useCart, type CartItem } from '@/contexts/cart-context';

const money = new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
});

const unitPrice = (item: CartItem) =>
    item.basePrice +
    (item.variant?.priceDelta ?? 0) +
    item.addons.reduce((total, addon) => total + addon.price, 0);

export default function CartPanel() {
    const {
        items,
        itemCount,
        subtotal,
        restaurant,
        isOpen,
        closeCart,
        updateQuantity,
        removeItem,
        clearCart,
    } = useCart();

    return (
        <Sheet open={isOpen} onOpenChange={(open) => !open && closeCart()}>
            <SheetContent className="w-full sm:max-w-md">
                <SheetHeader className="border-b">
                    <SheetTitle>Your cart</SheetTitle>
                    <SheetDescription>
                        {restaurant
                            ? `${itemCount} ${itemCount === 1 ? 'item' : 'items'} from ${restaurant.name}`
                            : 'Add something delicious to get started.'}
                    </SheetDescription>
                </SheetHeader>

                {items.length === 0 ? (
                    <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
                        <div className="bg-muted flex size-14 items-center justify-center rounded-full">
                            <ShoppingBag className="text-muted-foreground size-6" />
                        </div>
                        <p className="mt-4 font-medium">Your cart is empty</p>
                        <p className="text-muted-foreground mt-1 max-w-xs text-sm">
                            Browse restaurants and add your favorite food.
                        </p>
                        <Button
                            type="button"
                            variant="outline"
                            className="mt-5"
                            onClick={closeCart}
                            asChild
                        >
                            <Link href="/customer/foods">Browse foods</Link>
                        </Button>
                    </div>
                ) : (
                    <div className="flex-1 space-y-4 overflow-y-auto px-4 pb-4">
                        {items.map((item) => (
                            <article
                                key={item.key}
                                className="rounded-xl border p-3"
                            >
                                <div className="flex gap-3">
                                    {item.photoUrl ? (
                                        <img
                                            src={item.photoUrl}
                                            alt=""
                                            className="size-16 rounded-lg object-cover"
                                        />
                                    ) : (
                                        <div className="bg-muted flex size-16 shrink-0 items-center justify-center rounded-lg">
                                            <ShoppingBag className="text-muted-foreground size-5" />
                                        </div>
                                    )}
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-start justify-between gap-2">
                                            <div>
                                                <h3 className="font-medium">
                                                    {item.name}
                                                </h3>
                                                {item.variant && (
                                                    <p className="text-muted-foreground text-xs">
                                                        {item.variant.name}
                                                    </p>
                                                )}
                                            </div>
                                            <Button
                                                type="button"
                                                size="icon"
                                                variant="ghost"
                                                className="text-muted-foreground size-8"
                                                onClick={() =>
                                                    removeItem(item.key)
                                                }
                                                aria-label={`Remove ${item.name}`}
                                            >
                                                <Trash2 />
                                            </Button>
                                        </div>
                                        {item.addons.length > 0 && (
                                            <p className="text-muted-foreground mt-1 line-clamp-2 text-xs">
                                                {item.addons
                                                    .map((addon) => addon.name)
                                                    .join(', ')}
                                            </p>
                                        )}
                                        {item.specialInstructions && (
                                            <p className="text-muted-foreground mt-1 line-clamp-2 text-xs italic">
                                                “{item.specialInstructions}”
                                            </p>
                                        )}
                                        <div className="mt-3 flex items-center justify-between gap-3">
                                            <div className="flex items-center rounded-md border">
                                                <Button
                                                    type="button"
                                                    size="icon"
                                                    variant="ghost"
                                                    className="size-8 rounded-r-none"
                                                    onClick={() =>
                                                        updateQuantity(
                                                            item.key,
                                                            item.quantity - 1,
                                                        )
                                                    }
                                                    aria-label={`Decrease ${item.name} quantity`}
                                                >
                                                    <Minus />
                                                </Button>
                                                <span className="w-8 text-center text-sm font-medium">
                                                    {item.quantity}
                                                </span>
                                                <Button
                                                    type="button"
                                                    size="icon"
                                                    variant="ghost"
                                                    className="size-8 rounded-l-none"
                                                    onClick={() =>
                                                        updateQuantity(
                                                            item.key,
                                                            item.quantity + 1,
                                                        )
                                                    }
                                                    aria-label={`Increase ${item.name} quantity`}
                                                >
                                                    <Plus />
                                                </Button>
                                            </div>
                                            <p className="font-semibold">
                                                {money.format(
                                                    unitPrice(item) *
                                                        item.quantity,
                                                )}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </article>
                        ))}
                    </div>
                )}

                {items.length > 0 && restaurant && (
                    <SheetFooter className="border-t">
                        <div className="mb-2 flex items-center justify-between text-base">
                            <span className="text-muted-foreground">
                                Subtotal
                            </span>
                            <strong>{money.format(subtotal)}</strong>
                        </div>
                        <Button asChild className="w-full">
                            <Link
                                href={`/customer/restaurants/${restaurant.id}/checkout`}
                                onClick={closeCart}
                            >
                                Proceed to checkout
                            </Link>
                        </Button>
                        <Button
                            type="button"
                            variant="ghost"
                            className="w-full"
                            onClick={clearCart}
                        >
                            Clear cart
                        </Button>
                    </SheetFooter>
                )}
            </SheetContent>
        </Sheet>
    );
}
