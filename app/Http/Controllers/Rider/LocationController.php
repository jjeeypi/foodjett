<?php

namespace App\Http\Controllers\Rider;

use App\Events\RiderLocationUpdated;
use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\Rider;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\RateLimiter;

class LocationController extends Controller
{
    private const WRITE_INTERVAL_SECONDS = 5;

    public function update(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'latitude' => ['required', 'numeric', 'between:-90,90'],
            'longitude' => ['required', 'numeric', 'between:-180,180'],
        ]);

        $rider = $request->user()?->rider;
        abort_unless($rider !== null, 403);

        $rateLimitKey = "rider-location:{$rider->id}";
        $allowed = RateLimiter::attempt(
            $rateLimitKey,
            1,
            fn (): bool => true,
            self::WRITE_INTERVAL_SECONDS,
        );

        if (! $allowed) {
            return response()->json([
                'updated' => false,
                'retry_after' => RateLimiter::availableIn($rateLimitKey),
            ], 202);
        }

        $activeOrder = DB::transaction(function () use ($rider, $validated): ?Order {
            $lockedRider = Rider::query()->lockForUpdate()->findOrFail($rider->id);
            $lockedRider->forceFill([
                'current_latitude' => (float) $validated['latitude'],
                'current_longitude' => (float) $validated['longitude'],
                'last_location_at' => now(),
            ])->save();

            return Order::query()
                ->where('rider_id', $lockedRider->id)
                ->whereIn('status', Order::RIDER_LOCATION_STATUSES)
                ->oldest('rider_assigned_at')
                ->first();
        });

        $freshRider = $rider->fresh();

        if ($activeOrder !== null && $freshRider !== null) {
            RiderLocationUpdated::dispatch($activeOrder, $freshRider);
        }

        return response()->json([
            'updated' => true,
            'broadcast' => $activeOrder !== null,
        ]);
    }
}
