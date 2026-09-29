<?php

namespace App\Http\Controllers\Rider;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\Rider;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class AvailabilityController extends Controller
{
    public function toggle(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'latitude' => ['nullable', 'required_with:longitude', 'numeric', 'between:-90,90'],
            'longitude' => ['nullable', 'required_with:latitude', 'numeric', 'between:-180,180'],
        ]);

        $rider = $request->user()?->rider;
        abort_unless($rider !== null, 403);

        $availability = DB::transaction(function () use ($rider, $validated): string {
            $lockedRider = Rider::query()->lockForUpdate()->findOrFail($rider->id);
            $hasActiveOrder = Order::query()
                ->where('rider_id', $lockedRider->id)
                ->whereNotIn('status', Order::TERMINAL_STATUSES)
                ->lockForUpdate()
                ->exists();

            if ($hasActiveOrder) {
                throw ValidationException::withMessages([
                    'availability' => 'Finish your current delivery first.',
                ]);
            }

            $availability = $lockedRider->availability_status === 'available'
                ? 'offline'
                : 'available';
            $attributes = ['availability_status' => $availability];

            if (
                $availability === 'available'
                && isset($validated['latitude'], $validated['longitude'])
            ) {
                $attributes = [
                    ...$attributes,
                    'current_latitude' => (float) $validated['latitude'],
                    'current_longitude' => (float) $validated['longitude'],
                    'last_location_at' => now(),
                ];
            }

            $lockedRider->forceFill($attributes)->save();

            return $availability;
        });

        return back()->with(
            'success',
            $availability === 'available' ? 'You are now online.' : 'You are now offline.',
        );
    }
}
