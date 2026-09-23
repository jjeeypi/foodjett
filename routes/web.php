<?php

use App\Http\Controllers\Admin\DashboardController as AdminDashboardController;
use App\Http\Controllers\Admin\RestaurantController as AdminRestaurantController;
use App\Http\Controllers\Admin\RiderController as AdminRiderController;
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
        Route::get('dashboard', AdminDashboardController::class)->name('dashboard');
        Route::get('restaurants', [AdminRestaurantController::class, 'index'])->name('restaurants.index');
        Route::get('restaurants/pending', [AdminRestaurantController::class, 'pending'])->name('restaurants.pending');
        Route::get('restaurants/{restaurant}', [AdminRestaurantController::class, 'show'])->name('restaurants.show');
        Route::patch('restaurants/{restaurant}/approve', [AdminRestaurantController::class, 'approve'])
            ->name('restaurants.approve');
        Route::patch('restaurants/{restaurant}/reject', [AdminRestaurantController::class, 'reject'])
            ->name('restaurants.reject');
        Route::patch('restaurants/{restaurant}/suspension', [AdminRestaurantController::class, 'suspend'])
            ->name('restaurants.suspension');
        Route::patch('restaurants/{restaurant}/commission', [AdminRestaurantController::class, 'updateCommission'])
            ->name('restaurants.commission');
        Route::patch('restaurants/{restaurant}/documents/{document}/verify', [AdminRestaurantController::class, 'verifyDocument'])
            ->name('restaurants.documents.verify');
        Route::patch('restaurants/{restaurant}/documents/{document}/reject', [AdminRestaurantController::class, 'rejectDocument'])
            ->name('restaurants.documents.reject');

        Route::get('riders', [AdminRiderController::class, 'index'])->name('riders.index');
        Route::get('riders/pending', [AdminRiderController::class, 'pending'])->name('riders.pending');
        Route::get('riders/{rider}', [AdminRiderController::class, 'show'])->name('riders.show');
        Route::patch('riders/{rider}/approve', [AdminRiderController::class, 'approve'])
            ->name('riders.approve');
        Route::patch('riders/{rider}/reject', [AdminRiderController::class, 'reject'])
            ->name('riders.reject');
        Route::patch('riders/{rider}/suspension', [AdminRiderController::class, 'suspend'])
            ->name('riders.suspension');
        Route::patch('riders/{rider}/documents/{document}/verify', [AdminRiderController::class, 'verifyDocument'])
            ->name('riders.documents.verify');
        Route::patch('riders/{rider}/documents/{document}/reject', [AdminRiderController::class, 'rejectDocument'])
            ->name('riders.documents.reject');

        Route::get('remittances', [AdminRemittanceController::class, 'index'])->name('remittances.index');
        Route::patch('remittances/{remittance}/confirm', [AdminRemittanceController::class, 'confirm'])
            ->name('remittances.confirm');

        Route::inertia('customers', 'admin/coming-soon', ['title' => 'Customers'])->name('customers.index');
        Route::inertia('orders', 'admin/coming-soon', ['title' => 'Orders'])->name('orders.index');
        Route::inertia('orders/unassigned', 'admin/coming-soon', ['title' => 'Unassigned orders'])->name('orders.unassigned');
        Route::inertia('orders/reports', 'admin/coming-soon', ['title' => 'Order reports'])->name('orders.reports');
        Route::inertia('categories', 'admin/coming-soon', ['title' => 'Categories'])->name('categories.index');
        Route::inertia('promotions', 'admin/coming-soon', ['title' => 'Promotions'])->name('promotions.index');
        Route::inertia('transactions', 'admin/coming-soon', ['title' => 'Transactions'])->name('transactions.index');
        Route::inertia('payouts/restaurants', 'admin/coming-soon', ['title' => 'Restaurant payouts'])->name('payouts.restaurants');
        Route::inertia('payouts/riders', 'admin/coming-soon', ['title' => 'Rider payouts'])->name('payouts.riders');
        Route::inertia('reviews', 'admin/coming-soon', ['title' => 'Reviews'])->name('reviews.index');
        Route::inertia('settings/platform', 'admin/coming-soon', ['title' => 'Platform settings'])->name('settings.platform');
        Route::inertia('settings/delivery-zones', 'admin/coming-soon', ['title' => 'Delivery zones'])->name('settings.delivery-zones');
        Route::inertia('settings/admins', 'admin/coming-soon', ['title' => 'Administrators'])->name('settings.admins');
        Route::inertia('audit-logs', 'admin/coming-soon', ['title' => 'Audit logs'])->name('audit-logs.index');
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
