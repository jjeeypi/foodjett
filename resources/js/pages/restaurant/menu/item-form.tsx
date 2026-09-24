import { Head, Link, useForm } from '@inertiajs/react';
import { ArrowLeft, ImageIcon, Plus, Save, Trash2 } from 'lucide-react';
import { useRef } from 'react';
import InputError from '@/components/input-error';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

type Variant = {
    id: number | null;
    key: string;
    name: string;
    price_delta: string;
};
type Addon = {
    id: number | null;
    key: string;
    name: string;
    price: string;
    is_available: boolean;
};
type Item = {
    id: number;
    menu_category_id: number;
    name: string;
    description: string | null;
    photo_url: string | null;
    base_price: string;
    is_available: boolean;
    is_featured: boolean;
    available_from: string | null;
    available_until: string | null;
    variants: Omit<Variant, 'key'>[];
    addons: Omit<Addon, 'key'>[];
};
type FormData = {
    _method: 'post' | 'patch';
    menu_category_id: string;
    name: string;
    description: string;
    photo: File | null;
    remove_photo: boolean;
    base_price: string;
    is_available: boolean;
    is_featured: boolean;
    available_from: string;
    available_until: string;
    variants: Variant[];
    addons: Addon[];
};

export default function MenuItemForm({
    item,
    categories,
}: {
    item: Item | null;
    categories: { id: number; name: string }[];
}) {
    const nextKey = useRef(0);
    const key = (prefix: string) => `${prefix}-${nextKey.current++}`;
    const form = useForm<FormData>({
        _method: item ? 'patch' : 'post',
        menu_category_id: item ? String(item.menu_category_id) : '',
        name: item?.name ?? '',
        description: item?.description ?? '',
        photo: null,
        remove_photo: false,
        base_price: item?.base_price ?? '',
        is_available: item?.is_available ?? true,
        is_featured: item?.is_featured ?? false,
        available_from: item?.available_from ?? '',
        available_until: item?.available_until ?? '',
        variants: (item?.variants ?? []).map((variant) => ({
            ...variant,
            key: `variant-${variant.id}`,
        })),
        addons: (item?.addons ?? []).map((addon) => ({
            ...addon,
            key: `addon-${addon.id}`,
        })),
    });
    const errors = form.errors as Record<string, string>;
    const title = item ? 'Edit menu item' : 'Add menu item';

    const submit = (event: React.FormEvent) => {
        event.preventDefault();
        form.post(
            item
                ? `/restaurant/menu/items/${item.id}`
                : '/restaurant/menu/items',
            {
                forceFormData: true,
            },
        );
    };

    return (
        <>
            <Head title={title} />
            <form
                onSubmit={submit}
                className="flex flex-1 flex-col gap-6 p-4 md:p-6"
            >
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
                    <div>
                        <Button
                            variant="link"
                            className="mb-2 h-auto p-0"
                            asChild
                        >
                            <Link href="/restaurant/menu/items">
                                <ArrowLeft /> Back to menu items
                            </Link>
                        </Button>
                        <h2 className="text-2xl font-semibold tracking-tight">
                            {title}
                        </h2>
                        <p className="text-muted-foreground text-sm">
                            Item details and customer-selectable options are
                            saved together.
                        </p>
                    </div>
                    <Button
                        type="submit"
                        disabled={form.processing || categories.length === 0}
                    >
                        <Save /> {form.processing ? 'Saving...' : 'Save item'}
                    </Button>
                </div>

                {categories.length === 0 && (
                    <Alert>
                        <ImageIcon />
                        <AlertTitle>Create a category first</AlertTitle>
                        <AlertDescription>
                            <p>
                                Every menu item must belong to one of your
                                categories.
                            </p>
                            <Link
                                href="/restaurant/menu/categories"
                                className="font-medium underline"
                            >
                                Manage categories
                            </Link>
                        </AlertDescription>
                    </Alert>
                )}

                <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
                    <div className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Item details</CardTitle>
                            </CardHeader>
                            <CardContent className="grid gap-5 sm:grid-cols-2">
                                <div className="space-y-2 sm:col-span-2">
                                    <Label htmlFor="name">Name</Label>
                                    <Input
                                        id="name"
                                        value={form.data.name}
                                        onChange={(event) =>
                                            form.setData(
                                                'name',
                                                event.target.value,
                                            )
                                        }
                                    />
                                    <InputError message={form.errors.name} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Category</Label>
                                    <Select
                                        value={form.data.menu_category_id}
                                        onValueChange={(value) =>
                                            form.setData(
                                                'menu_category_id',
                                                value,
                                            )
                                        }
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Choose a category" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {categories.map((category) => (
                                                <SelectItem
                                                    key={category.id}
                                                    value={String(category.id)}
                                                >
                                                    {category.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <InputError
                                        message={form.errors.menu_category_id}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="base-price">
                                        Base price
                                    </Label>
                                    <Input
                                        id="base-price"
                                        type="number"
                                        min="0.01"
                                        step="0.01"
                                        value={form.data.base_price}
                                        onChange={(event) =>
                                            form.setData(
                                                'base_price',
                                                event.target.value,
                                            )
                                        }
                                    />
                                    <InputError
                                        message={form.errors.base_price}
                                    />
                                </div>
                                <div className="space-y-2 sm:col-span-2">
                                    <Label htmlFor="description">
                                        Description
                                    </Label>
                                    <textarea
                                        id="description"
                                        rows={4}
                                        value={form.data.description}
                                        onChange={(event) =>
                                            form.setData(
                                                'description',
                                                event.target.value,
                                            )
                                        }
                                        className="border-input focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-3"
                                    />
                                    <InputError
                                        message={form.errors.description}
                                    />
                                </div>
                                <div className="space-y-2 sm:col-span-2">
                                    <Label htmlFor="photo">Photo</Label>
                                    <Input
                                        id="photo"
                                        type="file"
                                        accept="image/jpeg,image/png,image/webp"
                                        onChange={(event) =>
                                            form.setData(
                                                'photo',
                                                event.target.files?.[0] ?? null,
                                            )
                                        }
                                    />
                                    <p className="text-muted-foreground text-xs">
                                        JPEG, PNG, or WebP up to 4 MB.
                                    </p>
                                    <InputError message={form.errors.photo} />
                                    {item?.photo_url && (
                                        <div className="flex items-center gap-3 pt-2">
                                            <img
                                                src={item.photo_url}
                                                alt="Current menu item"
                                                className="size-20 rounded-lg border object-cover"
                                            />
                                            <div className="flex items-center gap-2">
                                                <Checkbox
                                                    id="remove-photo"
                                                    checked={
                                                        form.data.remove_photo
                                                    }
                                                    onCheckedChange={(
                                                        checked,
                                                    ) =>
                                                        form.setData(
                                                            'remove_photo',
                                                            checked === true,
                                                        )
                                                    }
                                                />
                                                <Label htmlFor="remove-photo">
                                                    Remove current photo
                                                </Label>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="flex-row items-center justify-between">
                                <CardTitle>Variants</CardTitle>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                        form.setData('variants', [
                                            ...form.data.variants,
                                            {
                                                id: null,
                                                key: key('variant'),
                                                name: '',
                                                price_delta: '0',
                                            },
                                        ])
                                    }
                                >
                                    <Plus /> Add variant
                                </Button>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <InputError message={errors.variants} />
                                {form.data.variants.length === 0 && (
                                    <p className="text-muted-foreground text-sm">
                                        No variants. Customers will order the
                                        base item.
                                    </p>
                                )}
                                {form.data.variants.map((variant, index) => (
                                    <div
                                        key={variant.key}
                                        className="grid gap-3 rounded-lg border p-4 sm:grid-cols-[1fr_180px_auto] sm:items-start"
                                    >
                                        <div className="space-y-2">
                                            <Label>Variant name</Label>
                                            <Input
                                                value={variant.name}
                                                onChange={(event) =>
                                                    form.setData(
                                                        'variants',
                                                        form.data.variants.map(
                                                            (row, rowIndex) =>
                                                                rowIndex ===
                                                                index
                                                                    ? {
                                                                          ...row,
                                                                          name: event
                                                                              .target
                                                                              .value,
                                                                      }
                                                                    : row,
                                                        ),
                                                    )
                                                }
                                                placeholder="Large"
                                            />
                                            <InputError
                                                message={
                                                    errors[
                                                        `variants.${index}.name`
                                                    ]
                                                }
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Price adjustment</Label>
                                            <Input
                                                type="number"
                                                step="0.01"
                                                value={variant.price_delta}
                                                onChange={(event) =>
                                                    form.setData(
                                                        'variants',
                                                        form.data.variants.map(
                                                            (row, rowIndex) =>
                                                                rowIndex ===
                                                                index
                                                                    ? {
                                                                          ...row,
                                                                          price_delta:
                                                                              event
                                                                                  .target
                                                                                  .value,
                                                                      }
                                                                    : row,
                                                        ),
                                                    )
                                                }
                                            />
                                            <InputError
                                                message={
                                                    errors[
                                                        `variants.${index}.price_delta`
                                                    ]
                                                }
                                            />
                                        </div>
                                        <Button
                                            type="button"
                                            size="icon"
                                            variant="ghost"
                                            className="sm:mt-6"
                                            onClick={() =>
                                                form.setData(
                                                    'variants',
                                                    form.data.variants.filter(
                                                        (_, rowIndex) =>
                                                            rowIndex !== index,
                                                    ),
                                                )
                                            }
                                            aria-label="Remove variant"
                                        >
                                            <Trash2 />
                                        </Button>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="flex-row items-center justify-between">
                                <CardTitle>Add-ons</CardTitle>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                        form.setData('addons', [
                                            ...form.data.addons,
                                            {
                                                id: null,
                                                key: key('addon'),
                                                name: '',
                                                price: '0',
                                                is_available: true,
                                            },
                                        ])
                                    }
                                >
                                    <Plus /> Add add-on
                                </Button>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <InputError message={errors.addons} />
                                {form.data.addons.length === 0 && (
                                    <p className="text-muted-foreground text-sm">
                                        No optional add-ons configured.
                                    </p>
                                )}
                                {form.data.addons.map((addon, index) => (
                                    <div
                                        key={addon.key}
                                        className="grid gap-3 rounded-lg border p-4 sm:grid-cols-[1fr_160px_auto_auto] sm:items-start"
                                    >
                                        <div className="space-y-2">
                                            <Label>Add-on name</Label>
                                            <Input
                                                value={addon.name}
                                                onChange={(event) =>
                                                    form.setData(
                                                        'addons',
                                                        form.data.addons.map(
                                                            (row, rowIndex) =>
                                                                rowIndex ===
                                                                index
                                                                    ? {
                                                                          ...row,
                                                                          name: event
                                                                              .target
                                                                              .value,
                                                                      }
                                                                    : row,
                                                        ),
                                                    )
                                                }
                                                placeholder="Extra rice"
                                            />
                                            <InputError
                                                message={
                                                    errors[
                                                        `addons.${index}.name`
                                                    ]
                                                }
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Price</Label>
                                            <Input
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                value={addon.price}
                                                onChange={(event) =>
                                                    form.setData(
                                                        'addons',
                                                        form.data.addons.map(
                                                            (row, rowIndex) =>
                                                                rowIndex ===
                                                                index
                                                                    ? {
                                                                          ...row,
                                                                          price: event
                                                                              .target
                                                                              .value,
                                                                      }
                                                                    : row,
                                                        ),
                                                    )
                                                }
                                            />
                                            <InputError
                                                message={
                                                    errors[
                                                        `addons.${index}.price`
                                                    ]
                                                }
                                            />
                                        </div>
                                        <div className="flex items-center gap-2 sm:mt-8">
                                            <Checkbox
                                                checked={addon.is_available}
                                                onCheckedChange={(checked) =>
                                                    form.setData(
                                                        'addons',
                                                        form.data.addons.map(
                                                            (row, rowIndex) =>
                                                                rowIndex ===
                                                                index
                                                                    ? {
                                                                          ...row,
                                                                          is_available:
                                                                              checked ===
                                                                              true,
                                                                      }
                                                                    : row,
                                                        ),
                                                    )
                                                }
                                            />
                                            <span className="text-sm">
                                                Available
                                            </span>
                                        </div>
                                        <Button
                                            type="button"
                                            size="icon"
                                            variant="ghost"
                                            className="sm:mt-6"
                                            onClick={() =>
                                                form.setData(
                                                    'addons',
                                                    form.data.addons.filter(
                                                        (_, rowIndex) =>
                                                            rowIndex !== index,
                                                    ),
                                                )
                                            }
                                            aria-label="Remove add-on"
                                        >
                                            <Trash2 />
                                        </Button>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    </div>

                    <div className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Availability</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-5">
                                <div className="flex items-center gap-2">
                                    <Checkbox
                                        id="available"
                                        checked={form.data.is_available}
                                        onCheckedChange={(checked) =>
                                            form.setData(
                                                'is_available',
                                                checked === true,
                                            )
                                        }
                                    />
                                    <Label htmlFor="available">
                                        Available for ordering
                                    </Label>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Checkbox
                                        id="featured"
                                        checked={form.data.is_featured}
                                        onCheckedChange={(checked) =>
                                            form.setData(
                                                'is_featured',
                                                checked === true,
                                            )
                                        }
                                    />
                                    <Label htmlFor="featured">
                                        Featured item
                                    </Label>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="available-from">
                                        Available from (optional)
                                    </Label>
                                    <Input
                                        id="available-from"
                                        type="time"
                                        value={form.data.available_from}
                                        onChange={(event) =>
                                            form.setData(
                                                'available_from',
                                                event.target.value,
                                            )
                                        }
                                    />
                                    <InputError
                                        message={form.errors.available_from}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="available-until">
                                        Available until (optional)
                                    </Label>
                                    <Input
                                        id="available-until"
                                        type="time"
                                        value={form.data.available_until}
                                        onChange={(event) =>
                                            form.setData(
                                                'available_until',
                                                event.target.value,
                                            )
                                        }
                                    />
                                    <InputError
                                        message={form.errors.available_until}
                                    />
                                </div>
                                <p className="text-muted-foreground text-xs">
                                    An end time earlier than the start time is
                                    treated as an overnight schedule.
                                </p>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </form>
        </>
    );
}

MenuItemForm.layout = { title: 'Menu item' };
