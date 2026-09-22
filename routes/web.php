<?php

use App\Http\Controllers\Auth\RegisteredRestaurantController;
use App\Http\Controllers\Auth\RegisteredRiderController;
use App\Http\Controllers\DashboardRedirectController;
use App\Http\Controllers\PendingApprovalController;
use Illuminate\Support\Facades\Route;

Route::inertia('/', 'welcome')->name('home');

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
        });
    });

    Route::prefix('customer')->name('customer.')->middleware('role:customer')->group(function () {
        Route::inertia('dashboard', 'customer/dashboard')->name('dashboard');
    });
});

require __DIR__.'/settings.php';
