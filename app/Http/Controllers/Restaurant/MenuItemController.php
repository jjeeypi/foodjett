<?php

namespace App\Http\Controllers\Restaurant;

use App\Http\Controllers\Controller;
use App\Models\MenuItem;
use App\Models\Restaurant;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;
use Throwable;

class MenuItemController extends Controller
{
    public function index(Request $request): Response
    {
        $restaurant = $this->restaurant($request);
        Gate::authorize('viewAny', MenuItem::class);
        $filters = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'category_id' => [
                'nullable',
                'integer',
                Rule::exists('menu_categories', 'id')
                    ->where(fn ($query) => $query->where('restaurant_id', $restaurant->id)),
            ],
            'availability' => ['nullable', Rule::in(['available', 'unavailable'])],
        ]);

        $items = MenuItem::query()
            ->whereHas('category', fn (Builder $query) => $query
                ->where('restaurant_id', $restaurant->id))
            ->with('category:id,name')
            ->when(
                $filters['search'] ?? null,
                fn (Builder $query, string $search) => $query
                    ->where('name', 'like', "%{$search}%")
            )
            ->when(
                $filters['category_id'] ?? null,
                fn (Builder $query, int $categoryId) => $query
                    ->where('menu_category_id', $categoryId)
            )
            ->when(
                $filters['availability'] ?? null,
                fn (Builder $query, string $availability) => $query
                    ->where('is_available', $availability === 'available')
            )
            ->latest('id')
            ->paginate(15)
            ->withQueryString()
            ->through(fn (MenuItem $item): array => [
                'id' => $item->id,
                'name' => $item->name,
                'photo_url' => $item->photo_path === null
                    ? null
                    : Storage::disk('public')->url($item->photo_path),
                'base_price' => $item->base_price,
                'is_available' => $item->is_available,
                'is_featured' => $item->is_featured,
                'available_from' => $item->available_from,
                'available_until' => $item->available_until,
                'category' => $item->category,
            ]);

        return Inertia::render('restaurant/menu/items', [
            'items' => $items,
            'categories' => $restaurant->menuCategories()
                ->orderBy('sort_order')
                ->orderBy('name')
                ->get(['id', 'name']),
            'filters' => [
                'search' => $filters['search'] ?? '',
                'category_id' => isset($filters['category_id'])
                    ? (string) $filters['category_id']
                    : '',
                'availability' => $filters['availability'] ?? '',
            ],
        ]);
    }

    public function create(Request $request): Response
    {
        $restaurant = $this->restaurant($request);
        Gate::authorize('create', MenuItem::class);

        return $this->formResponse($restaurant);
    }

    public function store(Request $request): RedirectResponse
    {
        $restaurant = $this->restaurant($request);
        Gate::authorize('create', MenuItem::class);
        $validated = $this->validateItem($request, $restaurant);
        $photoPath = $this->storePhoto($request, $restaurant);

        try {
            DB::transaction(function () use ($validated, $photoPath): void {
                $item = MenuItem::query()->create([
                    ...$this->itemValues($validated),
                    'photo_path' => $photoPath,
                ]);

                $this->syncVariants($item, $validated['variants'] ?? []);
                $this->syncAddons($item, $validated['addons'] ?? []);
            });
        } catch (Throwable $exception) {
            if ($photoPath !== null) {
                Storage::disk('public')->delete($photoPath);
            }

            throw $exception;
        }

        return to_route('restaurant.menu.items.index')->with('toast', [
            'type' => 'success',
            'message' => 'Menu item created.',
        ]);
    }

    public function edit(Request $request, MenuItem $menuItem): Response
    {
        $restaurant = $this->authorizeOwnedItem($request, $menuItem, 'update');
        $menuItem->load(['variants', 'addons']);

        return $this->formResponse($restaurant, $menuItem);
    }

    public function update(Request $request, MenuItem $menuItem): RedirectResponse
    {
        $restaurant = $this->authorizeOwnedItem($request, $menuItem, 'update');
        $validated = $this->validateItem($request, $restaurant, $menuItem);
        $oldPhotoPath = $menuItem->photo_path;
        $newPhotoPath = $this->storePhoto($request, $restaurant);
        $photoPath = $newPhotoPath
            ?? (($validated['remove_photo'] ?? false) ? null : $oldPhotoPath);

        try {
            DB::transaction(function () use ($menuItem, $validated, $photoPath): void {
                $lockedItem = MenuItem::query()->whereKey($menuItem->id)->lockForUpdate()->firstOrFail();
                $lockedItem->update([
                    ...$this->itemValues($validated),
                    'photo_path' => $photoPath,
                ]);

                $this->syncVariants($lockedItem, $validated['variants'] ?? []);
                $this->syncAddons($lockedItem, $validated['addons'] ?? []);
            });
        } catch (Throwable $exception) {
            if ($newPhotoPath !== null) {
                Storage::disk('public')->delete($newPhotoPath);
            }

            throw $exception;
        }

        if ($oldPhotoPath !== null && $oldPhotoPath !== $photoPath) {
            Storage::disk('public')->delete($oldPhotoPath);
        }

        return to_route('restaurant.menu.items.index')->with('toast', [
            'type' => 'success',
            'message' => 'Menu item updated.',
        ]);
    }

    public function updateAvailability(Request $request, MenuItem $menuItem): RedirectResponse
    {
        $this->authorizeOwnedItem($request, $menuItem, 'update');
        $validated = $request->validate(['is_available' => ['required', 'boolean']]);
        $menuItem->update(['is_available' => $validated['is_available']]);

        return back()->with('toast', [
            'type' => 'success',
            'message' => $menuItem->is_available
                ? "{$menuItem->name} is available."
                : "{$menuItem->name} is marked sold out.",
        ]);
    }

    public function destroy(Request $request, MenuItem $menuItem): RedirectResponse
    {
        $this->authorizeOwnedItem($request, $menuItem, 'delete');

        if ($menuItem->orderItems()->exists()) {
            $menuItem->update(['is_available' => false]);

            return back()->with('toast', [
                'type' => 'warning',
                'message' => 'This item has order history, so it was marked sold out instead of deleted.',
            ]);
        }

        $photoPath = $menuItem->photo_path;
        DB::transaction(function () use ($menuItem): void {
            $menuItem->variants()->delete();
            $menuItem->addons()->delete();
            $menuItem->delete();
        });

        if ($photoPath !== null) {
            Storage::disk('public')->delete($photoPath);
        }

        return back()->with('toast', [
            'type' => 'success',
            'message' => 'Menu item deleted.',
        ]);
    }

    private function restaurant(Request $request): Restaurant
    {
        $restaurant = $request->user()?->restaurant;
        if ($restaurant === null) {
            abort(404, 'Restaurant profile not found.');
        }

        return $restaurant;
    }

    private function authorizeOwnedItem(Request $request, MenuItem $item, string $ability): Restaurant
    {
        $restaurant = $this->restaurant($request);
        $item->loadMissing('category');
        Gate::authorize($ability, $item);
        abort_unless($item->category->restaurant_id === $restaurant->id, 403);

        return $restaurant;
    }

    private function storePhoto(Request $request, Restaurant $restaurant): ?string
    {
        $photo = $request->file('photo');
        if ($photo === null) {
            return null;
        }

        $path = $photo->store("menu-items/{$restaurant->id}", 'public');
        if ($path === false) {
            throw ValidationException::withMessages([
                'photo' => 'The menu item photo could not be stored.',
            ]);
        }

        return $path;
    }

    private function formResponse(Restaurant $restaurant, ?MenuItem $item = null): Response
    {
        return Inertia::render('restaurant/menu/item-form', [
            'item' => $item === null ? null : [
                'id' => $item->id,
                'menu_category_id' => $item->menu_category_id,
                'name' => $item->name,
                'description' => $item->description,
                'photo_url' => $item->photo_path === null
                    ? null
                    : Storage::disk('public')->url($item->photo_path),
                'base_price' => $item->base_price,
                'is_available' => $item->is_available,
                'is_featured' => $item->is_featured,
                'available_from' => $item->available_from === null
                    ? null
                    : substr((string) $item->available_from, 0, 5),
                'available_until' => $item->available_until === null
                    ? null
                    : substr((string) $item->available_until, 0, 5),
                'variants' => $item->variants
                    ->map(fn ($variant): array => $variant->only(['id', 'name', 'price_delta']))
                    ->values(),
                'addons' => $item->addons
                    ->map(fn ($addon): array => $addon->only(['id', 'name', 'price', 'is_available']))
                    ->values(),
            ],
            'categories' => $restaurant->menuCategories()
                ->orderBy('sort_order')
                ->orderBy('name')
                ->get(['id', 'name']),
        ]);
    }

    /** @return array<string, mixed> */
    private function validateItem(Request $request, Restaurant $restaurant, ?MenuItem $item = null): array
    {
        return $request->validate([
            'menu_category_id' => [
                'required',
                'integer',
                Rule::exists('menu_categories', 'id')
                    ->where(fn ($query) => $query->where('restaurant_id', $restaurant->id)),
            ],
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:2000'],
            'photo' => ['nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:4096'],
            'remove_photo' => ['sometimes', 'boolean'],
            'base_price' => ['required', 'numeric', 'decimal:0,2', 'gt:0', 'max:999999.99'],
            'is_available' => ['required', 'boolean'],
            'is_featured' => ['required', 'boolean'],
            'available_from' => ['nullable', 'date_format:H:i'],
            'available_until' => ['nullable', 'date_format:H:i'],
            'variants' => ['nullable', 'array', 'max:25'],
            'variants.*.id' => $item === null
                ? ['nullable', 'prohibited']
                : ['nullable', 'integer', 'distinct', 'exists:menu_item_variants,id'],
            'variants.*.name' => ['required', 'string', 'max:100', 'distinct'],
            'variants.*.price_delta' => ['required', 'numeric', 'decimal:0,2', 'between:-999999.99,999999.99'],
            'addons' => ['nullable', 'array', 'max:25'],
            'addons.*.id' => $item === null
                ? ['nullable', 'prohibited']
                : ['nullable', 'integer', 'distinct', 'exists:menu_item_addons,id'],
            'addons.*.name' => ['required', 'string', 'max:100', 'distinct'],
            'addons.*.price' => ['required', 'numeric', 'decimal:0,2', 'min:0', 'max:999999.99'],
            'addons.*.is_available' => ['required', 'boolean'],
        ]);
    }

    /**
     * @param  array<string, mixed>  $validated
     * @return array<string, mixed>
     */
    private function itemValues(array $validated): array
    {
        return [
            'menu_category_id' => $validated['menu_category_id'],
            'name' => $validated['name'],
            'description' => $validated['description'] ?? null,
            'base_price' => $validated['base_price'],
            'is_available' => $validated['is_available'],
            'is_featured' => $validated['is_featured'],
            'available_from' => $validated['available_from'] ?? null,
            'available_until' => $validated['available_until'] ?? null,
        ];
    }

    /** @param list<array<string, mixed>> $rows */
    private function syncVariants(MenuItem $item, array $rows): void
    {
        $submittedIds = collect($rows)
            ->pluck('id')
            ->filter(fn (mixed $id): bool => $id !== null)
            ->map(fn (mixed $id): int => (int) $id)
            ->values();
        $existing = $item->variants()->get()->keyBy('id');

        if ($submittedIds->diff($existing->keys())->isNotEmpty()) {
            throw ValidationException::withMessages([
                'variants' => 'One or more variants do not belong to this menu item.',
            ]);
        }

        $removedIds = $existing->keys()->diff($submittedIds)->values();
        if ($removedIds->isNotEmpty()
            && DB::table('order_items')->whereIn('menu_item_variant_id', $removedIds)->exists()) {
            throw ValidationException::withMessages([
                'variants' => 'A variant used in an existing order cannot be removed.',
            ]);
        }

        if ($removedIds->isNotEmpty()) {
            $item->variants()->whereIn('id', $removedIds)->delete();
        }

        foreach ($rows as $row) {
            $values = ['name' => $row['name'], 'price_delta' => $row['price_delta']];
            if (($row['id'] ?? null) !== null) {
                $item->variants()->whereKey($row['id'])->update($values);
            } else {
                $item->variants()->create($values);
            }
        }
    }

    /** @param list<array<string, mixed>> $rows */
    private function syncAddons(MenuItem $item, array $rows): void
    {
        $submittedIds = collect($rows)
            ->pluck('id')
            ->filter(fn (mixed $id): bool => $id !== null)
            ->map(fn (mixed $id): int => (int) $id)
            ->values();
        $existing = $item->addons()->get()->keyBy('id');

        if ($submittedIds->diff($existing->keys())->isNotEmpty()) {
            throw ValidationException::withMessages([
                'addons' => 'One or more add-ons do not belong to this menu item.',
            ]);
        }

        $removedIds = $existing->keys()->diff($submittedIds)->values();
        if ($removedIds->isNotEmpty()
            && DB::table('order_item_addons')->whereIn('menu_item_addon_id', $removedIds)->exists()) {
            throw ValidationException::withMessages([
                'addons' => 'An add-on used in an existing order cannot be removed.',
            ]);
        }

        if ($removedIds->isNotEmpty()) {
            $item->addons()->whereIn('id', $removedIds)->delete();
        }

        foreach ($rows as $row) {
            $values = [
                'name' => $row['name'],
                'price' => $row['price'],
                'is_available' => $row['is_available'],
            ];
            if (($row['id'] ?? null) !== null) {
                $item->addons()->whereKey($row['id'])->update($values);
            } else {
                $item->addons()->create($values);
            }
        }
    }
}
