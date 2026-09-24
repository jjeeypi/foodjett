<?php

namespace App\Http\Controllers\Restaurant;

use App\Http\Controllers\Controller;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

class OperatingStatusController extends Controller
{
    public function __invoke(Request $request): RedirectResponse
    {
        $restaurant = $request->user()?->restaurant;
        if ($restaurant === null) {
            abort(404, 'Restaurant profile not found.');
        }

        Gate::authorize('update', $restaurant);
        $validated = $request->validate([
            'operating_status' => ['required', Rule::in(['open', 'closed'])],
        ]);

        $restaurant->update(['operating_status' => $validated['operating_status']]);

        return back()->with('toast', [
            'type' => 'success',
            'message' => $restaurant->operating_status === 'open'
                ? 'Your restaurant is now open.'
                : 'Your restaurant is now closed.',
        ]);
    }
}
