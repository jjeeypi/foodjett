<?php

namespace App\Http\Middleware;

use App\Models\Restaurant;
use App\Models\Rider;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that's loaded on the first page visit.
     *
     * @see https://inertiajs.com/server-side-setup#root-template
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determines the current asset version.
     *
     * @see https://inertiajs.com/asset-versioning
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @see https://inertiajs.com/shared-data
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        return [
            ...parent::share($request),
            'name' => config('app.name'),
            'auth' => [
                'user' => $request->user(),
            ],
            'adminPendingApprovals' => fn (): ?array => $request->user()?->isAdmin()
                ? [
                    'restaurants' => Restaurant::query()->where('approval_status', 'pending')->count(),
                    'riders' => Rider::query()->where('approval_status', 'pending')->count(),
                ]
                : null,
            'restaurantContext' => function () use ($request): ?array {
                $user = $request->user();

                if (! $user?->isRestaurant()) {
                    return null;
                }

                $restaurant = $user->restaurant;
                if ($restaurant === null) {
                    return null;
                }

                return [
                    'id' => $restaurant->id,
                    'name' => $restaurant->name,
                    'logo_url' => $restaurant->logo_path === null
                        ? null
                        : Storage::disk('public')->url($restaurant->logo_path),
                    'operating_status' => $restaurant->operating_status,
                    'approval_status' => $restaurant->approval_status,
                ];
            },
            'sidebarOpen' => ! $request->hasCookie('sidebar_state') || $request->cookie('sidebar_state') === 'true',
        ];
    }
}
