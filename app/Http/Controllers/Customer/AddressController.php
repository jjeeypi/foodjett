<?php

namespace App\Http\Controllers\Customer;

use App\Http\Controllers\Controller;
use App\Http\Requests\Customer\SaveAddressRequest;
use App\Models\CustomerAddress;
use App\Services\CustomerAddressService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class AddressController extends Controller
{
    public function index(Request $request, CustomerAddressService $addresses): Response
    {
        Gate::authorize('viewAny', CustomerAddress::class);
        $customer = $request->user()?->customer;
        abort_unless($customer !== null, 403);

        $customerAddresses = $customer->addresses()
            ->orderByDesc('is_default')
            ->latest('updated_at')
            ->get()
            ->map(fn (CustomerAddress $address): array => $addresses->data($address))
            ->values();
        $default = $customerAddresses->firstWhere('is_default', true)
            ?? $customerAddresses->first();

        return Inertia::render('customer/account/addresses', [
            'addresses' => $customerAddresses,
            'mapFallback' => $default === null ? [
                'latitude' => 14.5995,
                'longitude' => 120.9842,
            ] : [
                'latitude' => $default['latitude'],
                'longitude' => $default['longitude'],
            ],
        ]);
    }

    public function store(
        SaveAddressRequest $request,
        CustomerAddressService $addresses,
    ): RedirectResponse {
        Gate::authorize('create', CustomerAddress::class);
        $customer = $request->user()?->customer;
        abort_unless($customer !== null, 403);

        $address = $addresses->create($customer, $request->validated());
        $this->flashSaved($addresses->isOutsideDeliveryZones($address));

        return back();
    }

    public function update(
        SaveAddressRequest $request,
        CustomerAddress $address,
        CustomerAddressService $addresses,
    ): RedirectResponse {
        Gate::authorize('update', $address);

        $updated = $addresses->update($address, $request->validated());
        $this->flashSaved($addresses->isOutsideDeliveryZones($updated));

        return back();
    }

    public function setDefault(
        Request $request,
        CustomerAddress $address,
        CustomerAddressService $addresses,
    ): RedirectResponse {
        Gate::authorize('update', $address);
        $customer = $request->user()?->customer;
        abort_unless($customer !== null, 403);

        $addresses->setDefault($customer, $address);
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Default address updated.']);

        return back();
    }

    public function destroy(
        Request $request,
        CustomerAddress $address,
        CustomerAddressService $addresses,
    ): RedirectResponse {
        Gate::authorize('delete', $address);
        $customer = $request->user()?->customer;
        abort_unless($customer !== null, 403);

        $addresses->delete($customer, $address);
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Address deleted.']);

        return back();
    }

    private function flashSaved(bool $outsideDeliveryZones): void
    {
        Inertia::flash('toast', [
            'type' => $outsideDeliveryZones ? 'warning' : 'success',
            'message' => $outsideDeliveryZones
                ? 'Address saved, but it is outside the current delivery zones. Checkout will block delivery until coverage is available.'
                : 'Address saved.',
        ]);
    }
}
