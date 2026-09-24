<?php

use App\Http\Controllers\Admin\DashboardController as AdminDashboardController;
use App\Http\Controllers\Admin\FinanceController as AdminFinanceController;
use App\Http\Controllers\Admin\OrderController as AdminOrderController;
use App\Http\Controllers\Admin\RestaurantController as AdminRestaurantController;
use App\Http\Controllers\Admin\RiderController as AdminRiderController;
use App\Http\Controllers\Admin\SettingController as AdminSettingController;
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
use App\Http\Controllers\Restaurant\DashboardController as RestaurantDashboardController;
use App\Http\Controllers\Restaurant\MenuCategoryController as RestaurantMenuCategoryController;
use App\Http\Controllers\Restaurant\MenuItemController as RestaurantMenuItemController;
use App\Http\Controllers\Restaurant\OperatingStatusController as RestaurantOperatingStatusController;
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

        Route::get('orders', [AdminOrderController::class, 'index'])->name('orders.index');
        Route::get('orders/unassigned', [AdminOrderController::class, 'unassigned'])->name('orders.unassigned');
        Route::get('orders/reports', [AdminOrderController::class, 'reports'])->name('orders.reports');
        Route::get('orders/reports/{report}', [AdminOrderController::class, 'showReport'])->name('orders.reports.show');
        Route::patch('orders/reports/{report}/resolve', [AdminOrderController::class, 'resolveReport'])
            ->name('orders.reports.resolve');
        Route::patch('orders/reports/{report}/reject', [AdminOrderController::class, 'rejectReport'])
            ->name('orders.reports.reject');
        Route::get('orders/{order}/nearby-riders', [AdminOrderController::class, 'nearbyRiders'])
            ->name('orders.nearby-riders');
        Route::patch('orders/{order}/assign-rider', [AdminOrderController::class, 'assignRider'])
            ->name('orders.assign-rider');
        Route::patch('orders/{order}/cancel', [AdminOrderController::class, 'cancel'])
            ->name('orders.cancel');
        Route::patch('orders/{order}/refund', [AdminOrderController::class, 'refund'])
            ->name('orders.refund');
        Route::get('orders/{order}', [AdminOrderController::class, 'show'])->name('orders.show');

        Route::get('remittances', [AdminRemittanceController::class, 'index'])->name('remittances.index');
        Route::patch('remittances/{remittance}/confirm', [AdminRemittanceController::class, 'confirm'])
            ->name('remittances.confirm');

        Route::get('transactions', [AdminFinanceController::class, 'transactions'])->name('transactions.index');
        Route::patch('transactions/{payment}/refund', [AdminFinanceController::class, 'refundPayment'])
            ->name('transactions.refund');
        Route::get('payouts/restaurants', [AdminFinanceController::class, 'restaurantPayouts'])
            ->name('payouts.restaurants');
        Route::post('payouts/restaurants/generate', [AdminFinanceController::class, 'generateRestaurantPayouts'])
            ->name('payouts.restaurants.generate');
        Route::patch('payouts/restaurants/{payout}/paid', [AdminFinanceController::class, 'markRestaurantPayoutPaid'])
            ->name('payouts.restaurants.paid');
        Route::get('payouts/riders', [AdminFinanceController::class, 'riderPayouts'])
            ->name('payouts.riders');
        Route::post('payouts/riders/generate', [AdminFinanceController::class, 'generateRiderPayouts'])
            ->name('payouts.riders.generate');
        Route::patch('payouts/riders/{payout}/paid', [AdminFinanceController::class, 'markRiderPayoutPaid'])
            ->name('payouts.riders.paid');

        Route::inertia('customers', 'admin/coming-soon', ['title' => 'Customers'])->name('customers.index');
        Route::inertia('categories', 'admin/coming-soon', ['title' => 'Categories'])->name('categories.index');
        Route::inertia('promotions', 'admin/coming-soon', ['title' => 'Promotions'])->name('promotions.index');
        Route::inertia('reviews', 'admin/coming-soon', ['title' => 'Reviews'])->name('reviews.index');
        Route::get('settings/platform', [AdminSettingController::class, 'platform'])->name('settings.platform');
        Route::patch('settings/platform', [AdminSettingController::class, 'updatePlatform'])
            ->name('settings.platform.update');
        Route::get('settings/delivery-zones', [AdminSettingController::class, 'deliveryZones'])
            ->name('settings.delivery-zones');
        Route::post('settings/delivery-zones', [AdminSettingController::class, 'storeDeliveryZone'])
            ->name('settings.delivery-zones.store');
        Route::patch('settings/delivery-zones/{deliveryZone}', [AdminSettingController::class, 'updateDeliveryZone'])
            ->name('settings.delivery-zones.update');
        Route::patch('settings/delivery-zones/{deliveryZone}/toggle', [AdminSettingController::class, 'toggleDeliveryZone'])
            ->name('settings.delivery-zones.toggle');
        Route::delete('settings/delivery-zones/{deliveryZone}', [AdminSettingController::class, 'destroyDeliveryZone'])
            ->name('settings.delivery-zones.destroy');
        Route::get('settings/admins', [AdminSettingController::class, 'admins'])->name('settings.admins');
        Route::post('settings/admins', [AdminSettingController::class, 'storeAdmin'])
            ->name('settings.admins.store');
        Route::patch('settings/admins/{user}/status', [AdminSettingController::class, 'updateAdminStatus'])
            ->name('settings.admins.status');
        Route::inertia('audit-logs', 'admin/coming-soon', ['title' => 'Audit logs'])->name('audit-logs.index');
    });

    Route::prefix('restaurant')->name('restaurant.')->middleware('role:restaurant')->group(function () {
        Route::get('pending', [PendingApprovalController::class, 'restaurant'])->name('pending');

        Route::middleware('approved:restaurant')->group(function () {
            Route::get('dashboard', RestaurantDashboardController::class)->name('dashboard');
            Route::patch('operating-status', RestaurantOperatingStatusController::class)
                ->name('operating-status.update');

            Route::get('menu/items', [RestaurantMenuItemController::class, 'index'])
                ->name('menu.items.index');
            Route::get('menu/items/create', [RestaurantMenuItemController::class, 'create'])
                ->name('menu.items.create');
            Route::post('menu/items', [RestaurantMenuItemController::class, 'store'])
                ->name('menu.items.store');
            Route::get('menu/items/{menuItem}/edit', [RestaurantMenuItemController::class, 'edit'])
                ->name('menu.items.edit');
            Route::patch('menu/items/{menuItem}', [RestaurantMenuItemController::class, 'update'])
                ->name('menu.items.update');
            Route::patch('menu/items/{menuItem}/availability', [RestaurantMenuItemController::class, 'updateAvailability'])
                ->name('menu.items.availability');
            Route::delete('menu/items/{menuItem}', [RestaurantMenuItemController::class, 'destroy'])
                ->name('menu.items.destroy');

            Route::get('menu/categories', [RestaurantMenuCategoryController::class, 'index'])
                ->name('menu.categories.index');
            Route::post('menu/categories', [RestaurantMenuCategoryController::class, 'store'])
                ->name('menu.categories.store');
            Route::patch('menu/categories/{menuCategory}', [RestaurantMenuCategoryController::class, 'update'])
                ->name('menu.categories.update');
            Route::patch('menu/categories/{menuCategory}/move', [RestaurantMenuCategoryController::class, 'move'])
                ->name('menu.categories.move');
            Route::delete('menu/categories/{menuCategory}', [RestaurantMenuCategoryController::class, 'destroy'])
                ->name('menu.categories.destroy');

            Route::inertia('orders/active', 'restaurant/coming-soon', ['title' => 'New and active orders'])
                ->name('orders.active');
            Route::inertia('orders/history', 'restaurant/coming-soon', ['title' => 'Order history'])
                ->name('orders.history');
            Route::inertia('store/profile', 'restaurant/coming-soon', ['title' => 'Profile and hours'])
                ->name('store.profile');
            Route::inertia('store/documents', 'restaurant/coming-soon', ['title' => 'Documents'])
                ->name('store.documents');
            Route::inertia('promotions', 'restaurant/coming-soon', ['title' => 'Promotions'])
                ->name('promotions.index');
            Route::inertia('earnings/summary', 'restaurant/coming-soon', ['title' => 'Sales summary'])
                ->name('earnings.summary');
            Route::inertia('earnings/payouts', 'restaurant/coming-soon', ['title' => 'Payouts'])
                ->name('earnings.payouts');
            Route::inertia('reviews', 'restaurant/coming-soon', ['title' => 'Reviews'])
                ->name('reviews.index');
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
