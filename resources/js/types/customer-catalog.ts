export type RestaurantCardData = {
    id: number;
    name: string;
    cuisine_type: string;
    address: string;
    cover_photo_url: string | null;
    logo_url: string | null;
    rating: number | null;
    review_count: number;
    distance_km: number | null;
    estimated_delivery_minutes: {
        minimum: number;
        maximum: number;
    };
    is_open: boolean;
    show_url: string;
};

export type CatalogVariant = {
    id: number;
    name: string;
    price_delta: number;
};

export type CatalogAddon = {
    id: number;
    name: string;
    price: number;
};

export type CatalogFood = {
    id: number;
    name: string;
    description: string | null;
    photo_url: string | null;
    base_price: number;
    is_available: boolean;
    availability_label: string;
    available_from: string | null;
    available_until: string | null;
    variants: CatalogVariant[];
    addons: CatalogAddon[];
    distance_km: number | null;
    category: { id: number; name: string };
    restaurant: {
        id: number;
        name: string;
        cuisine_type: string;
        is_open: boolean;
        show_url: string;
    };
};

export type PaginationLink = {
    url: string | null;
    label: string;
    active: boolean;
};

export type Paginated<T> = {
    current_page: number;
    data: T[];
    from: number | null;
    last_page: number;
    links: PaginationLink[];
    per_page: number;
    to: number | null;
    total: number;
};
