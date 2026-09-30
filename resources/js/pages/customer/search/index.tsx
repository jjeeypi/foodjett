import { Head, Link, router } from '@inertiajs/react';
import { Search, SearchX, SlidersHorizontal } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import CardPagination from '@/components/customer/card-pagination';
import FoodCard from '@/components/customer/food-card';
import ItemModal from '@/components/customer/item-modal';
import RestaurantCard from '@/components/customer/restaurant-card';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type {
    CatalogFood,
    Paginated,
    RestaurantCardData,
} from '@/types/customer-catalog';

type SearchFilters = {
    q: string;
    tab: 'restaurants' | 'dishes';
    rating: string;
    min_price: string;
    max_price: string;
    open_now: boolean;
    cuisine: string;
};

export default function SearchIndex({
    results,
    counts,
    filters,
    cuisines,
    popularCuisines,
}: {
    results: Paginated<RestaurantCardData | CatalogFood>;
    counts: { restaurants: number; dishes: number };
    filters: SearchFilters;
    cuisines: string[];
    popularCuisines: string[];
}) {
    const [selectedItem, setSelectedItem] = useState<CatalogFood | null>(null);
    const [query, setQuery] = useState(filters.q);
    const [minPrice, setMinPrice] = useState(filters.min_price);
    const [maxPrice, setMaxPrice] = useState(filters.max_price);
    const firstRender = useRef(true);

    const visit = (changes: Partial<SearchFilters>) => {
        const next = {
            ...filters,
            q: query,
            min_price: minPrice,
            max_price: maxPrice,
            ...changes,
        };
        const params = Object.fromEntries(
            Object.entries(next).filter(
                ([key, value]) =>
                    value !== '' &&
                    value !== false &&
                    !(key === 'tab' && value === 'restaurants'),
            ),
        );
        router.get('/customer/search', params, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    useEffect(() => {
        if (firstRender.current) {
            firstRender.current = false;
            return;
        }

        const timeout = window.setTimeout(() => {
            if (
                query !== filters.q ||
                minPrice !== filters.min_price ||
                maxPrice !== filters.max_price
            ) {
                const next = {
                    ...filters,
                    q: query,
                    min_price: minPrice,
                    max_price: maxPrice,
                };
                const params = Object.fromEntries(
                    Object.entries(next).filter(
                        ([key, value]) =>
                            value !== '' &&
                            value !== false &&
                            !(key === 'tab' && value === 'restaurants'),
                    ),
                );
                router.get('/customer/search', params, {
                    preserveState: true,
                    preserveScroll: true,
                    replace: true,
                });
            }
        }, 450);

        return () => window.clearTimeout(timeout);
    }, [query, minPrice, maxPrice, filters]);

    const empty = results.data.length === 0;
    const resultLabel = filters.q ? ` for “${filters.q}”` : '';

    return (
        <>
            <Head title="Search" />
            <div className="mx-auto w-full max-w-7xl px-4 py-6 md:px-6 md:py-8">
                <div>
                    <h1 className="text-3xl font-semibold tracking-tight">
                        Search food and restaurants
                    </h1>
                    <p className="text-muted-foreground mt-1 text-sm">
                        Search restaurant names, cuisines, dishes, and dish
                        descriptions.
                    </p>
                </div>

                <div className="mt-6 grid items-start gap-6 lg:grid-cols-[17rem_minmax(0,1fr)]">
                    <aside className="space-y-5 rounded-xl border p-4 lg:sticky lg:top-28">
                        <div className="space-y-2">
                            <Label htmlFor="catalog-search">Search</Label>
                            <div className="relative">
                                <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                                <Input
                                    id="catalog-search"
                                    value={query}
                                    onChange={(event) =>
                                        setQuery(event.target.value)
                                    }
                                    className="pl-9"
                                    placeholder="e.g. adobo"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="search-cuisine">Cuisine</Label>
                            <select
                                id="search-cuisine"
                                value={filters.cuisine}
                                onChange={(event) =>
                                    visit({ cuisine: event.target.value })
                                }
                                className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                            >
                                <option value="">All cuisines</option>
                                {cuisines.map((cuisine) => (
                                    <option key={cuisine} value={cuisine}>
                                        {cuisine}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="search-rating">
                                Minimum rating
                            </Label>
                            <select
                                id="search-rating"
                                value={filters.rating}
                                onChange={(event) =>
                                    visit({ rating: event.target.value })
                                }
                                className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                            >
                                <option value="">Any rating</option>
                                <option value="3">3+ stars</option>
                                <option value="4">4+ stars</option>
                                <option value="4.5">4.5+ stars</option>
                            </select>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-2">
                                <Label htmlFor="search-min-price">
                                    Min price
                                </Label>
                                <Input
                                    id="search-min-price"
                                    type="number"
                                    min="0"
                                    value={minPrice}
                                    onChange={(event) =>
                                        setMinPrice(event.target.value)
                                    }
                                    placeholder="₱0"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="search-max-price">
                                    Max price
                                </Label>
                                <Input
                                    id="search-max-price"
                                    type="number"
                                    min="0"
                                    value={maxPrice}
                                    onChange={(event) =>
                                        setMaxPrice(event.target.value)
                                    }
                                    placeholder="Any"
                                />
                            </div>
                        </div>
                        <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                            <Checkbox
                                checked={filters.open_now}
                                onCheckedChange={(checked) =>
                                    visit({ open_now: checked === true })
                                }
                            />
                            Open now
                        </label>
                        <Button
                            type="button"
                            variant="outline"
                            className="w-full"
                            onClick={() => {
                                setQuery('');
                                setMinPrice('');
                                setMaxPrice('');
                                router.get(
                                    '/customer/search',
                                    {},
                                    { replace: true },
                                );
                            }}
                        >
                            <SlidersHorizontal /> Clear filters
                        </Button>
                    </aside>

                    <main>
                        <div className="mb-6 flex border-b">
                            <button
                                type="button"
                                onClick={() => visit({ tab: 'restaurants' })}
                                className={`border-b-2 px-4 py-3 text-sm font-medium ${
                                    filters.tab === 'restaurants'
                                        ? 'border-primary text-primary'
                                        : 'text-muted-foreground border-transparent'
                                }`}
                            >
                                Restaurants ({counts.restaurants})
                            </button>
                            <button
                                type="button"
                                onClick={() => visit({ tab: 'dishes' })}
                                className={`border-b-2 px-4 py-3 text-sm font-medium ${
                                    filters.tab === 'dishes'
                                        ? 'border-primary text-primary'
                                        : 'text-muted-foreground border-transparent'
                                }`}
                            >
                                Dishes ({counts.dishes})
                            </button>
                        </div>

                        {empty ? (
                            <Card>
                                <CardContent className="flex flex-col items-center py-14 text-center">
                                    <SearchX className="text-muted-foreground size-10" />
                                    <h2 className="mt-4 text-lg font-semibold">
                                        No results{resultLabel}
                                    </h2>
                                    <p className="text-muted-foreground mt-1 max-w-md text-sm">
                                        Try a shorter search, clear a filter, or
                                        explore one of these popular cuisines.
                                    </p>
                                    <div className="mt-5 flex flex-wrap justify-center gap-2">
                                        {popularCuisines.map((cuisine) => (
                                            <Link
                                                key={cuisine}
                                                href={`/customer/search?cuisine=${encodeURIComponent(cuisine)}`}
                                                className="hover:bg-muted rounded-full border px-3 py-1.5 text-sm"
                                            >
                                                {cuisine}
                                            </Link>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        ) : filters.tab === 'restaurants' ? (
                            <div className="grid grid-cols-2 gap-3 sm:gap-5 xl:grid-cols-3">
                                {(results.data as RestaurantCardData[]).map(
                                    (restaurant) => (
                                        <RestaurantCard
                                            key={restaurant.id}
                                            restaurant={restaurant}
                                        />
                                    ),
                                )}
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 gap-3 sm:gap-5 xl:grid-cols-3">
                                {(results.data as CatalogFood[]).map((item) => (
                                    <FoodCard
                                        key={item.id}
                                        item={item}
                                        onConfigure={setSelectedItem}
                                    />
                                ))}
                            </div>
                        )}
                        <CardPagination paginated={results} />
                    </main>
                </div>
            </div>

            <ItemModal
                item={selectedItem}
                open={selectedItem !== null}
                onOpenChange={(open) => !open && setSelectedItem(null)}
            />
        </>
    );
}
