<?php

use App\Http\Controllers\AdminRemittanceController;
use App\Http\Controllers\Auth\RegisteredRestaurantController;
use App\Http\Controllers\Auth\RegisteredRiderController;
use App\Http\Controllers\CheckoutCallbackController;
use App\Http\Controllers\CheckoutController;
use App\Http\Controllers\CustomerDashboardController;
use App\Http\Controllers\DashboardRedirectController;
use App\Http\Controllers\OrderPlacedController;
use App\Http\Controllers\PayMongoWebhookController;
use App\Http\Controllers\PendingApprovalController;
use App\Http\Controllers\RiderOrderController;
use App\Http\Controllers\RiderRemittanceController;
use Illuminate\Support\Facades\Route;

Route::inertia('/', 'welcome')->name('home');
Route::post('webhooks/paymongo', PayMongoWebhookController::class)
    ->middleware('throttle:60,1')
    ->name('webhooks.paymongo');

Route::middleware('guest')->group(function () {
    Route::get('register/restaurant', [RegisteredRestaurantController::class, 'create'])
        ->name('register.restaurant');
    Route::post('register/restaurant', [RegisteredRestaurantController::class, 'store'])
        ->middleware('throttle:6,1')
        ->name('register.restaurant.store');

    Route::get('register/rider', [RegisteredRiderController::class, 'create'])
        ->name('register.rider');
    Route::post('register/rider', [RegisteredRiderController::class, 'store'])
        ->middleware('throttle:6,1')
        ->name('register.rider.store');
});

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('dashboard', DashboardRedirectController::class)->name('dashboard');

    Route::prefix('admin')->name('admin.')->middleware('role:admin')->group(function () {
        Route::inertia('dashboard', 'admin/dashboard')->name('dashboard');
        Route::get('remittances', [AdminRemittanceController::class, 'index'])->name('remittances.index');
        Route::patch('remittances/{remittance}/confirm', [AdminRemittanceController::class, 'confirm'])
            ->name('remittances.confirm');
    });

    Route::prefix('restaurant')->name('restaurant.')->middleware('role:restaurant')->group(function () {
        Route::get('pending', [PendingApprovalController::class, 'restaurant'])->name('pending');

        Route::middleware('approved:restaurant')->group(function () {
            Route::inertia('dashboard', 'restaurant/dashboard')->name('dashboard');
        });
    });

    Route::prefix('rider')->name('rider.')->middleware('role:rider')->group(function () {
        Route::get('pending', [PendingApprovalController::class, 'rider'])->name('pending');

        Route::middleware('approved:rider')->group(function () {
            Route::inertia('dashboard', 'rider/dashboard')->name('dashboard');
            Route::get('orders', [RiderOrderController::class, 'index'])->name('orders.index');
            Route::post('orders/{order}/accept', [RiderOrderController::class, 'accept'])->name('orders.accept');
            Route::patch('orders/{order}/complete', [RiderOrderController::class, 'complete'])->name('orders.complete');
            Route::get('remittances', [RiderRemittanceController::class, 'index'])->name('remittances.index');
            Route::post('remittances', [RiderRemittanceController::class, 'store'])->name('remittances.store');
        });
    });

    Route::prefix('customer')->name('customer.')->middleware('role:customer')->group(function () {
        Route::get('dashboard', CustomerDashboardController::class)->name('dashboard');
        Route::get('checkout/paymongo/{pendingCheckout}/callback', CheckoutCallbackController::class)
            ->middleware('signed')
            ->name('checkout.callback');
        Route::get('restaurants/{restaurant}/checkout', [CheckoutController::class, 'show'])->name('checkout.show');
        Route::post('restaurants/{restaurant}/checkout', [CheckoutController::class, 'store'])
            ->middleware('throttle:10,1')
            ->name('checkout.store');
        Route::get('orders/{order}/placed', OrderPlacedController::class)->name('orders.placed');
    });
});

require __DIR__.'/settings.php';
