import {
    createContext,
    useCallback,
    useContext,
    useMemo,
    useEffect,
    useState,
    type ReactNode,
} from 'react';

const CART_STORAGE_KEY = 'foodjett.customer-cart';

export type CartVariant = {
    id: number;
    name: string;
    priceDelta: number;
};

export type CartAddon = {
    id: number;
    name: string;
    price: number;
};

export type CartItem = {
    key: string;
    menuItemId: number;
    restaurantId: number;
    restaurantName: string;
    name: string;
    photoUrl?: string | null;
    basePrice: number;
    variant?: CartVariant | null;
    addons: CartAddon[];
    specialInstructions: string;
    quantity: number;
};

export type AddCartItem = Omit<CartItem, 'key' | 'quantity'> & {
    quantity?: number;
};

type CartContextValue = {
    items: CartItem[];
    itemCount: number;
    subtotal: number;
    restaurant: { id: number; name: string } | null;
    isOpen: boolean;
    openCart: () => void;
    closeCart: () => void;
    addItem: (item: AddCartItem) => boolean;
    updateQuantity: (key: string, quantity: number) => void;
    removeItem: (key: string) => void;
    clearCart: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

const itemKey = (item: AddCartItem) => {
    const addonIds = item.addons
        .map((addon) => addon.id)
        .sort((left, right) => left - right)
        .join('-');

    return `${item.menuItemId}:${item.variant?.id ?? 'regular'}:${addonIds}:${item.specialInstructions.trim().toLocaleLowerCase()}`;
};

const unitPrice = (item: CartItem) =>
    item.basePrice +
    (item.variant?.priceDelta ?? 0) +
    item.addons.reduce((total, addon) => total + addon.price, 0);

export function CartProvider({ children }: { children: ReactNode }) {
    const [items, setItems] = useState<CartItem[]>(() => {
        if (typeof window === 'undefined') return [];

        try {
            const stored = JSON.parse(
                window.localStorage.getItem(CART_STORAGE_KEY) ?? '[]',
            ) as unknown;

            return Array.isArray(stored) ? (stored as CartItem[]) : [];
        } catch {
            return [];
        }
    });
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    }, [items]);

    const addItem = useCallback(
        (item: AddCartItem): boolean => {
            const hasAnotherRestaurant =
                items.length > 0 && items[0].restaurantId !== item.restaurantId;

            if (
                hasAnotherRestaurant &&
                !window.confirm(
                    'Your cart has items from another restaurant — clear it and start a new order?',
                )
            ) {
                return false;
            }

            const key = itemKey(item);
            const quantity = Math.max(1, item.quantity ?? 1);

            setItems((currentItems) => {
                const nextItems = hasAnotherRestaurant ? [] : currentItems;
                const existing = nextItems.find(
                    (candidate) => candidate.key === key,
                );

                if (existing) {
                    return nextItems.map((candidate) =>
                        candidate.key === key
                            ? {
                                  ...candidate,
                                  quantity: candidate.quantity + quantity,
                              }
                            : candidate,
                    );
                }

                return [...nextItems, { ...item, key, quantity }];
            });
            setIsOpen(true);

            return true;
        },
        [items],
    );

    const updateQuantity = useCallback((key: string, quantity: number) => {
        if (quantity < 1) {
            setItems((currentItems) =>
                currentItems.filter((item) => item.key !== key),
            );

            return;
        }

        setItems((currentItems) =>
            currentItems.map((item) =>
                item.key === key ? { ...item, quantity } : item,
            ),
        );
    }, []);

    const removeItem = useCallback((key: string) => {
        setItems((currentItems) =>
            currentItems.filter((item) => item.key !== key),
        );
    }, []);

    const clearCart = useCallback(() => setItems([]), []);
    const itemCount = items.reduce((total, item) => total + item.quantity, 0);
    const subtotal = items.reduce(
        (total, item) => total + unitPrice(item) * item.quantity,
        0,
    );
    const restaurant = items[0]
        ? {
              id: items[0].restaurantId,
              name: items[0].restaurantName,
          }
        : null;
    const value = useMemo<CartContextValue>(
        () => ({
            items,
            itemCount,
            subtotal,
            restaurant,
            isOpen,
            openCart: () => setIsOpen(true),
            closeCart: () => setIsOpen(false),
            addItem,
            updateQuantity,
            removeItem,
            clearCart,
        }),
        [
            addItem,
            clearCart,
            isOpen,
            itemCount,
            items,
            removeItem,
            restaurant,
            subtotal,
            updateQuantity,
        ],
    );

    return (
        <CartContext.Provider value={value}>{children}</CartContext.Provider>
    );
}

export function useCart(): CartContextValue {
    const context = useContext(CartContext);

    if (context === null) {
        throw new Error('useCart must be used inside CartProvider.');
    }

    return context;
}
