import { Head, router } from '@inertiajs/react';
import { MapPinOff, SearchX, SlidersHorizontal } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import CardPagination from '@/components/customer/card-pagination';
import FoodCard from '@/components/customer/food-card';
import ItemModal from '@/components/customer/item-modal';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { CatalogFood, Paginated } from '@/types/customer-catalog';

type Filters = {
    cuisine: string;
    category: string;
    min_price: string;
    max_price: string;
    sort: 'nearest' | 'price_asc' | 'rating';
};

export default function FoodsIndex({
    items,
    cuisines,
    categories,
    filters,
    hasAddress,
}: {
    items: Paginated<CatalogFood>;
    cuisines: string[];
    categories: string[];
    filters: Filters;
    hasAddress: boolean;
}) {
    const [selectedItem, setSelectedItem] = useState<CatalogFood | null>(null);
    const [minPrice, setMinPrice] = useState(filters.min_price);
    const [maxPrice, setMaxPrice] = useState(filters.max_price);

    const visit = (changes: Partial<Filters>) => {
        const next = { ...filters, ...changes };
        const query = Object.fromEntries(
            Object.entries(next).filter(([, value]) => value !== ''),
        );
        router.get('/customer/foods', query, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    const applyPrices = (event: FormEvent) => {
        event.preventDefault();
        visit({ min_price: minPrice, max_price: maxPrice });
    };

    const clearFilters = () => {
        setMinPrice('');
        setMaxPrice('');
        router.get('/customer/foods', {}, { replace: true });
    };

    return (
        <>
            <Head title="Foods" />
            <div className="mx-auto w-full max-w-7xl px-4 py-6 md:px-6 md:py-8">
                <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
                    <div>
                        <h1 className="text-3xl font-semibold tracking-tight">
                            Browse foods
                        </h1>
                        <p className="text-muted-foreground mt-1 text-sm">
                            Discover available dishes from restaurants that are
                            open now.
                        </p>
                    </div>
                    <label className="flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground">Sort by</span>
                        <select
                            value={filters.sort}
                            onChange={(event) =>
                                visit({
                                    sort: event.target.value as Filters['sort'],
                                })
                            }
                            className="border-input bg-background h-9 rounded-md border px-3"
                        >
                            <option value="nearest">Nearest restaurant</option>
                            <option value="price_asc">
                                Price: low to high
                            </option>
                            <option value="rating">Restaurant rating</option>
                        </select>
                    </label>
                </div>

                {!hasAddress && filters.sort === 'nearest' && (
                    <div className="mt-5 flex items-start gap-3 rounded-xl border border-dashed p-4">
                        <MapPinOff className="text-muted-foreground mt-0.5 size-5" />
                        <p className="text-muted-foreground text-sm">
                            Add a delivery address to sort by distance. Until
                            then, dishes are sorted alphabetically.
                        </p>
                    </div>
                )}

                <section className="mt-7 space-y-5" aria-label="Food filters">
                    <div>
                        <p className="mb-2 text-sm font-medium">Cuisine</p>
                        <div className="flex gap-2 overflow-x-auto pb-1">
                            <Button
                                type="button"
                                size="sm"
                                variant={
                                    filters.cuisine === ''
                                        ? 'default'
                                        : 'outline'
                                }
                                onClick={() => visit({ cuisine: '' })}
                                className="shrink-0"
                            >
                                All
                            </Button>
                            {cuisines.map((cuisine) => (
                                <Button
                                    key={cuisine}
                                    type="button"
                                    size="sm"
                                    variant={
                                        filters.cuisine === cuisine
                                            ? 'default'
                                            : 'outline'
                                    }
                                    onClick={() => visit({ cuisine })}
                                    className="shrink-0"
                                >
                                    {cuisine}
                                </Button>
                            ))}
                        </div>
                    </div>
                    <div>
                        <p className="mb-2 text-sm font-medium">Category</p>
                        <div className="flex gap-2 overflow-x-auto pb-1">
                            <Button
                                type="button"
                                size="sm"
                                variant={
                                    filters.category === ''
                                        ? 'default'
                                        : 'outline'
                                }
                                onClick={() => visit({ category: '' })}
                                className="shrink-0"
                            >
                                All
                            </Button>
                            {categories.map((category) => (
                                <Button
                                    key={category}
                                    type="button"
                                    size="sm"
                                    variant={
                                        filters.category === category
                                            ? 'default'
                                            : 'outline'
                                    }
                                    onClick={() => visit({ category })}
                                    className="shrink-0"
                                >
                                    {category}
                                </Button>
                            ))}
                        </div>
                    </div>
                    <form
                        onSubmit={applyPrices}
                        className="flex flex-wrap items-end gap-3"
                    >
                        <div className="space-y-1.5">
                            <Label htmlFor="food-min-price">
                                Minimum price
                            </Label>
                            <Input
                                id="food-min-price"
                                type="number"
                                min="0"
                                step="1"
                                value={minPrice}
                                onChange={(event) =>
                                    setMinPrice(event.target.value)
                                }
                                placeholder="₱0"
                                className="w-32"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="food-max-price">
                                Maximum price
                            </Label>
                            <Input
                                id="food-max-price"
                                type="number"
                                min="0"
                                step="1"
                                value={maxPrice}
                                onChange={(event) =>
                                    setMaxPrice(event.target.value)
                                }
                                placeholder="Any"
                                className="w-32"
                            />
                        </div>
                        <Button type="submit" variant="secondary">
                            <SlidersHorizontal /> Apply price
                        </Button>
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={clearFilters}
                        >
                            Clear filters
                        </Button>
                    </form>
                </section>

                <section className="mt-8" aria-label="Available dishes">
                    {items.data.length > 0 ? (
                        <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
                            {items.data.map((item) => (
                                <FoodCard
                                    key={item.id}
                                    item={item}
                                    onConfigure={setSelectedItem}
                                />
                            ))}
                        </div>
                    ) : (
                        <Card>
                            <CardContent className="flex flex-col items-center py-12 text-center">
                                <SearchX className="text-muted-foreground size-9" />
                                <p className="mt-4 font-medium">
                                    No dishes match these filters
                                </p>
                                <p className="text-muted-foreground mt-1 text-sm">
                                    Try another cuisine, category, or price
                                    range.
                                </p>
                            </CardContent>
                        </Card>
                    )}
                    <CardPagination paginated={items} />
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
