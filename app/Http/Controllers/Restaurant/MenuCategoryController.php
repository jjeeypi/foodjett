<?php

namespace App\Http\Controllers\Restaurant;

use App\Http\Controllers\Controller;
use App\Models\MenuCategory;
use App\Models\Restaurant;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class MenuCategoryController extends Controller
{
    public function index(Request $request): Response
    {
        $restaurant = $this->restaurant($request);
        Gate::authorize('viewAny', MenuCategory::class);

        return Inertia::render('restaurant/menu/categories', [
            'categories' => $restaurant->menuCategories()
                ->withCount('menuItems')
                ->orderBy('sort_order')
                ->orderBy('id')
                ->get(['id', 'name', 'sort_order']),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $restaurant = $this->restaurant($request);
        Gate::authorize('create', MenuCategory::class);
        $validated = $this->validateCategory($request, $restaurant);
        $sortOrder = ((int) $restaurant->menuCategories()->max('sort_order')) + 1;

        $restaurant->menuCategories()->create([
            'name' => $validated['name'],
            'sort_order' => $sortOrder,
        ]);

        return back()->with('toast', [
            'type' => 'success',
            'message' => 'Menu category created.',
        ]);
    }

    public function update(
        Request $request,
        MenuCategory $menuCategory
    ): RedirectResponse {
        $restaurant = $this->authorizeOwnedCategory($request, $menuCategory, 'update');
        $validated = $this->validateCategory($request, $restaurant, $menuCategory);
        $menuCategory->update(['name' => $validated['name']]);

        return back()->with('toast', [
            'type' => 'success',
            'message' => 'Menu category renamed.',
        ]);
    }

    public function move(Request $request, MenuCategory $menuCategory): RedirectResponse
    {
        $restaurant = $this->authorizeOwnedCategory($request, $menuCategory, 'update');
        $validated = $request->validate([
            'direction' => ['required', Rule::in(['up', 'down'])],
        ]);

        DB::transaction(function () use ($restaurant, $menuCategory, $validated): void {
            $ordered = MenuCategory::query()
                ->where('restaurant_id', $restaurant->id)
                ->orderBy('sort_order')
                ->orderBy('id')
                ->lockForUpdate()
                ->get();
            $currentIndex = $ordered->search(
                fn (MenuCategory $category): bool => $category->id === $menuCategory->id
            );

            if ($currentIndex === false) {
                abort(404);
            }

            $targetIndex = $validated['direction'] === 'up'
                ? $currentIndex - 1
                : $currentIndex + 1;
            if (! $ordered->has($targetIndex)) {
                return;
            }

            $current = $ordered->get($currentIndex);
            $target = $ordered->get($targetIndex);
            $ordered->put($currentIndex, $target);
            $ordered->put($targetIndex, $current);

            foreach ($ordered as $index => $category) {
                $category->update(['sort_order' => $index]);
            }
        });

        return back();
    }

    public function destroy(Request $request, MenuCategory $menuCategory): RedirectResponse
    {
        $this->authorizeOwnedCategory($request, $menuCategory, 'delete');

        if ($menuCategory->menuItems()->exists()) {
            throw ValidationException::withMessages([
                'category' => 'Move or delete every item in this category before deleting it.',
            ]);
        }

        $menuCategory->delete();

        return back()->with('toast', [
            'type' => 'success',
            'message' => 'Menu category deleted.',
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

    private function authorizeOwnedCategory(
        Request $request,
        MenuCategory $category,
        string $ability
    ): Restaurant {
        $restaurant = $this->restaurant($request);
        Gate::authorize($ability, $category);
        abort_unless($category->restaurant_id === $restaurant->id, 403);

        return $restaurant;
    }

    /** @return array{name: string} */
    private function validateCategory(
        Request $request,
        Restaurant $restaurant,
        ?MenuCategory $category = null
    ): array {
        /** @var array{name: string} $validated */
        $validated = $request->validate([
            'name' => [
                'required',
                'string',
                'max:100',
                Rule::unique('menu_categories', 'name')
                    ->where(fn ($query) => $query->where('restaurant_id', $restaurant->id))
                    ->ignore($category?->id),
            ],
        ]);

        return $validated;
    }
}
