<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Admin;
use App\Models\AuditLog;
use App\Models\DeliveryZone;
use App\Models\PlatformSetting;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class SettingController extends Controller
{
    /** @var list<string> */
    private const SETTING_ORDER = [
        'rider_search_initial_radius_km',
        'rider_search_widen_radius_km',
        'rider_search_widen_after_minutes',
        'rider_incentive_after_minutes',
        'admin_alert_after_minutes',
        'customer_notify_after_minutes',
        'auto_cancel_after_minutes',
        'rider_waiting_compensation_threshold_minutes',
        'default_commission_rate',
    ];

    public function platform(): Response
    {
        Gate::authorize('viewAny', PlatformSetting::class);

        $order = array_flip(self::SETTING_ORDER);
        $settings = PlatformSetting::query()
            ->get(['id', 'key', 'value', 'description'])
            ->sortBy(fn (PlatformSetting $setting): int => $order[$setting->key] ?? PHP_INT_MAX)
            ->values();

        return Inertia::render('admin/settings/platform', [
            'settings' => $settings,
        ]);
    }

    public function updatePlatform(Request $request): RedirectResponse
    {
        Gate::authorize('updateAny', PlatformSetting::class);

        $settings = PlatformSetting::query()->get(['id', 'key']);
        $rules = ['settings' => ['required', 'array']];

        foreach ($settings as $setting) {
            $rules['settings.'.$setting->key] = $this->rulesForSetting($setting->key);
        }

        /** @var array{settings: array<string, mixed>} $validated */
        $validated = $request->validate($rules);

        $changed = DB::transaction(function () use ($settings, $validated): int {
            $count = 0;

            foreach ($settings as $settingReference) {
                $setting = PlatformSetting::query()
                    ->whereKey($settingReference->id)
                    ->lockForUpdate()
                    ->firstOrFail();
                $newValue = (string) $validated['settings'][$setting->key];

                if ($setting->value === $newValue) {
                    continue;
                }

                $before = $setting->only(['key', 'value']);
                $setting->update(['value' => $newValue]);
                $this->audit(
                    $setting,
                    'platform_setting.updated',
                    $before,
                    $setting->only(['key', 'value'])
                );
                $count++;
            }

            return $count;
        });

        return back()->with(
            'success',
            $changed === 0 ? 'No platform settings changed.' : "Updated {$changed} platform setting(s)."
        );
    }

    public function deliveryZones(): Response
    {
        Gate::authorize('viewAny', DeliveryZone::class);

        $zones = DeliveryZone::query()
            ->latest('id')
            ->paginate(15)
            ->withQueryString()
            ->through(fn (DeliveryZone $zone): array => [
                'id' => $zone->id,
                'name' => $zone->name,
                'is_active' => $zone->is_active,
                ...$this->editableGeometry($zone->polygon),
            ]);

        return Inertia::render('admin/settings/delivery-zones', [
            'zones' => $zones,
        ]);
    }

    public function storeDeliveryZone(Request $request): RedirectResponse
    {
        Gate::authorize('create', DeliveryZone::class);
        $validated = $this->validateDeliveryZone($request);

        DB::transaction(function () use ($validated): void {
            $zone = DeliveryZone::query()->create([
                'name' => $validated['name'],
                'polygon' => $this->circleGeometry($validated),
                'is_active' => $validated['is_active'],
            ]);
            $this->audit($zone, 'delivery_zone.created', [], $zone->toArray());
        });

        return back()->with('success', 'Delivery zone created.');
    }

    public function updateDeliveryZone(Request $request, DeliveryZone $deliveryZone): RedirectResponse
    {
        Gate::authorize('update', $deliveryZone);
        $validated = $this->validateDeliveryZone($request, $deliveryZone);

        DB::transaction(function () use ($deliveryZone, $validated): void {
            $zone = DeliveryZone::query()->whereKey($deliveryZone->id)->lockForUpdate()->firstOrFail();
            $before = $zone->only(['name', 'polygon', 'is_active']);
            $zone->update([
                'name' => $validated['name'],
                'polygon' => $this->circleGeometry($validated),
                'is_active' => $validated['is_active'],
            ]);
            $this->audit($zone, 'delivery_zone.updated', $before, $zone->only([
                'name',
                'polygon',
                'is_active',
            ]));
        });

        return back()->with('success', 'Delivery zone updated.');
    }

    public function toggleDeliveryZone(DeliveryZone $deliveryZone): RedirectResponse
    {
        Gate::authorize('toggle', $deliveryZone);

        DB::transaction(function () use ($deliveryZone): void {
            $zone = DeliveryZone::query()->whereKey($deliveryZone->id)->lockForUpdate()->firstOrFail();
            $before = ['is_active' => $zone->is_active];
            $zone->update(['is_active' => ! $zone->is_active]);
            $this->audit(
                $zone,
                $zone->is_active ? 'delivery_zone.activated' : 'delivery_zone.deactivated',
                $before,
                ['is_active' => $zone->is_active]
            );
        });

        return back()->with('success', 'Delivery zone status updated.');
    }

    public function destroyDeliveryZone(DeliveryZone $deliveryZone): RedirectResponse
    {
        Gate::authorize('delete', $deliveryZone);

        DB::transaction(function () use ($deliveryZone): void {
            $before = $deliveryZone->toArray();
            $this->audit($deliveryZone, 'delivery_zone.deleted', $before, []);
            $deliveryZone->delete();
        });

        return back()->with('success', 'Delivery zone deleted.');
    }

    public function admins(Request $request): Response
    {
        Gate::authorize('viewAny', User::class);

        return Inertia::render('admin/settings/admins', [
            'admins' => User::query()
                ->where('role', 'admin')
                ->with('admin:id,user_id')
                ->latest('id')
                ->paginate(20)
                ->withQueryString(),
            'currentAdminId' => $request->user()->id,
        ]);
    }

    public function storeAdmin(Request $request): RedirectResponse
    {
        Gate::authorize('createAdmin', User::class);
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'phone' => ['nullable', 'string', 'max:30', 'unique:users,phone'],
            'password' => ['required', 'confirmed', Password::defaults()],
        ]);

        DB::transaction(function () use ($validated): void {
            $user = User::query()->create([
                'name' => $validated['name'],
                'email' => $validated['email'],
                'phone' => $validated['phone'] ?? null,
                'password' => $validated['password'],
                'role' => 'admin',
                'status' => 'active',
            ]);
            $user->forceFill(['email_verified_at' => now()])->save();
            Admin::query()->create(['user_id' => $user->id]);
            $this->audit($user, 'admin.created', [], $user->only([
                'name',
                'email',
                'phone',
                'role',
                'status',
            ]));
        });

        return back()->with('success', 'Administrator account created.');
    }

    public function updateAdminStatus(Request $request, User $user): RedirectResponse
    {
        abort_unless($user->isAdmin(), 404);
        Gate::authorize('updateAdminStatus', $user);
        $validated = $request->validate([
            'status' => ['required', Rule::in(['active', 'suspended'])],
        ]);

        if ($request->user()->is($user) && $validated['status'] === 'suspended') {
            throw ValidationException::withMessages([
                'status' => 'You cannot suspend your own administrator account.',
            ]);
        }

        DB::transaction(function () use ($user, $validated): void {
            $target = User::query()->whereKey($user->id)->lockForUpdate()->firstOrFail();

            if ($target->status === $validated['status']) {
                return;
            }

            $before = ['status' => $target->status];
            $target->update(['status' => $validated['status']]);
            $this->audit(
                $target,
                $validated['status'] === 'suspended' ? 'admin.suspended' : 'admin.reactivated',
                $before,
                ['status' => $target->status]
            );
        });

        return back()->with('success', 'Administrator status updated.');
    }

    /** @return list<string> */
    private function rulesForSetting(string $key): array
    {
        if (! preg_match('/(?:radius|minutes|rate|amount)/', $key)) {
            return ['required', 'string', 'max:255'];
        }

        if (str_contains($key, 'minutes')) {
            return ['required', 'integer', 'min:0'];
        }

        if (str_contains($key, 'rate')) {
            return ['required', 'numeric', 'between:0,100'];
        }

        return ['required', 'numeric', 'gt:0'];
    }

    /**
     * @return array{name: string, center_latitude: float|int|string, center_longitude: float|int|string, radius_km: float|int|string, is_active: bool}
     */
    private function validateDeliveryZone(Request $request, ?DeliveryZone $deliveryZone = null): array
    {
        /** @var array{name: string, center_latitude: float|int|string, center_longitude: float|int|string, radius_km: float|int|string, is_active: bool} $validated */
        $validated = $request->validate([
            'name' => [
                'required',
                'string',
                'max:255',
                Rule::unique('delivery_zones', 'name')->ignore($deliveryZone?->id),
            ],
            'center_latitude' => ['required', 'numeric', 'between:-90,90'],
            'center_longitude' => ['required', 'numeric', 'between:-180,180'],
            'radius_km' => ['required', 'numeric', 'gt:0', 'max:100'],
            'is_active' => ['required', 'boolean'],
        ]);

        return $validated;
    }

    /**
     * @param  array{center_latitude: float|int|string, center_longitude: float|int|string, radius_km: float|int|string}  $values
     * @return array{type: string, center: array{float, float}, radius_km: float}
     */
    private function circleGeometry(array $values): array
    {
        return [
            'type' => 'circle',
            'center' => [(float) $values['center_latitude'], (float) $values['center_longitude']],
            'radius_km' => (float) $values['radius_km'],
        ];
    }

    /**
     * @return array{center_latitude: float|null, center_longitude: float|null, radius_km: float|null, geometry_type: string}
     */
    private function editableGeometry(mixed $geometry): array
    {
        if (is_string($geometry)) {
            $geometry = json_decode($geometry, true);
        }

        if (! is_array($geometry)) {
            return [
                'center_latitude' => null,
                'center_longitude' => null,
                'radius_km' => null,
                'geometry_type' => 'unknown',
            ];
        }

        $center = $geometry['center'] ?? null;
        if (($geometry['type'] ?? null) === 'circle'
            && is_array($center)
            && isset($center[0], $center[1])) {
            return [
                'center_latitude' => (float) $center[0],
                'center_longitude' => (float) $center[1],
                'radius_km' => (float) ($geometry['radius_km'] ?? 0),
                'geometry_type' => 'circle',
            ];
        }

        $coordinateSets = $geometry['coordinates'] ?? null;
        $coordinates = is_array($coordinateSets) ? ($coordinateSets[0] ?? null) : null;
        if (($geometry['type'] ?? null) !== 'Polygon' || ! is_array($coordinates)) {
            return [
                'center_latitude' => null,
                'center_longitude' => null,
                'radius_km' => null,
                'geometry_type' => (string) ($geometry['type'] ?? 'unknown'),
            ];
        }

        $latitudes = [];
        $longitudes = [];
        foreach ($coordinates as $point) {
            if (! is_array($point) || ! isset($point[0], $point[1])) {
                continue;
            }

            $longitudes[] = (float) $point[0];
            $latitudes[] = (float) $point[1];
        }

        if ($latitudes === [] || $longitudes === []) {
            return [
                'center_latitude' => null,
                'center_longitude' => null,
                'radius_km' => null,
                'geometry_type' => 'Polygon',
            ];
        }

        $latitude = (min($latitudes) + max($latitudes)) / 2;
        $longitude = (min($longitudes) + max($longitudes)) / 2;
        $latitudeRadius = (max($latitudes) - min($latitudes)) / 2 * 111.32;
        $longitudeRadius = (max($longitudes) - min($longitudes)) / 2
            * 111.32 * cos(deg2rad($latitude));

        return [
            'center_latitude' => round($latitude, 6),
            'center_longitude' => round($longitude, 6),
            'radius_km' => round(max($latitudeRadius, $longitudeRadius), 2),
            'geometry_type' => 'Polygon',
        ];
    }

    /**
     * @param  array<string, mixed>  $before
     * @param  array<string, mixed>  $after
     */
    private function audit(Model $subject, string $action, array $before, array $after): void
    {
        AuditLog::query()->create([
            'user_id' => request()->user()?->id,
            'action' => $action,
            'subject_type' => $subject::class,
            'subject_id' => (int) $subject->getKey(),
            'changes' => ['before' => $before, 'after' => $after],
            'created_at' => now(),
        ]);
    }
}
