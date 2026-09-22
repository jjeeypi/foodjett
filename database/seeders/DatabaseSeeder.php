<?php

namespace Database\Seeders;

use App\Models\Admin;
use App\Models\Customer;
use App\Models\CustomerAddress;
use App\Models\DeliveryZone;
use App\Models\MenuItem;
use App\Models\MenuItemAddon;
use App\Models\MenuItemVariant;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\OrderItemAddon;
use App\Models\OrderStatusHistory;
use App\Models\Payment;
use App\Models\PlatformSetting;
use App\Models\Restaurant;
use App\Models\RestaurantDocument;
use App\Models\RestaurantOperatingHour;
use App\Models\RestaurantReview;
use App\Models\Rider;
use App\Models\RiderDocument;
use App\Models\RiderEarning;
use App\Models\RiderPoolOffer;
use App\Models\RiderReview;
use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    // Ordered list of statuses that need a rider assigned
    private const RIDER_STATUSES = [
        'rider_assigned', 'at_restaurant', 'picked_up', 'on_the_way', 'arrived', 'delivered', 'failed_delivery',
    ];

    // Statuses that have passed the finding_rider stage
    private const POOL_OFFER_STATUSES = [
        'finding_rider', 'cancelled_no_rider',
        'rider_assigned', 'at_restaurant', 'picked_up', 'on_the_way', 'arrived', 'delivered', 'failed_delivery',
    ];

    public function run(): void
    {
        DB::transaction(function () {
            $this->seedPlatformSettings();
            $this->seedDeliveryZones();
            $admin = $this->seedAdmin();
            $restaurants = $this->seedRestaurants();
            $riders = $this->seedRiders();
            $customers = $this->seedCustomers();
            $this->seedOrders($restaurants, $riders, $customers);
        });
    }

    // -------------------------------------------------------------------------
    // Platform Settings
    // -------------------------------------------------------------------------
    private function seedPlatformSettings(): void
    {
        $settings = [
            ['key' => 'rider_search_initial_radius_km',          'value' => '3',    'description' => 'Initial search radius in km when looking for a rider'],
            ['key' => 'rider_search_widen_radius_km',            'value' => '8',    'description' => 'Widened search radius in km after escalation'],
            ['key' => 'rider_search_widen_after_minutes',        'value' => '2',    'description' => 'Minutes before widening the search radius'],
            ['key' => 'rider_incentive_after_minutes',           'value' => '4',    'description' => 'Minutes before adding an incentive to attract riders'],
            ['key' => 'admin_alert_after_minutes',               'value' => '6',    'description' => 'Minutes before alerting admin of unassigned order'],
            ['key' => 'customer_notify_after_minutes',           'value' => '8',    'description' => 'Minutes before notifying customer of rider search delay'],
            ['key' => 'auto_cancel_after_minutes',               'value' => '15',   'description' => 'Minutes before auto-cancelling order with no rider found'],
            ['key' => 'default_commission_rate',                 'value' => '15',   'description' => 'Default platform commission rate (%)'],
            ['key' => 'rider_waiting_compensation_threshold_minutes', 'value' => '5', 'description' => 'Minutes waiting at restaurant before waiting compensation kicks in'],
        ];

        foreach ($settings as $setting) {
            PlatformSetting::firstOrCreate(['key' => $setting['key']], $setting);
        }
    }

    // -------------------------------------------------------------------------
    // Delivery Zones — Dumaguete City
    // -------------------------------------------------------------------------
    private function seedDeliveryZones(): void
    {
        $zones = [
            ['name' => 'Bantayan / Downtown',   'center' => [9.3076, 123.3080], 'r' => 0.015],
            ['name' => 'Piapi / Boulevard',     'center' => [9.2990, 123.3085], 'r' => 0.012],
            ['name' => 'Looc / Silliman Area',  'center' => [9.3110, 123.3060], 'r' => 0.013],
            ['name' => 'Taclobo / Market Area', 'center' => [9.3155, 123.3075], 'r' => 0.014],
            ['name' => 'Bagacay / Daro',        'center' => [9.3200, 123.3000], 'r' => 0.016],
        ];

        foreach ($zones as $z) {
            [$lat, $lng] = $z['center'];
            $r = $z['r'];
            DeliveryZone::firstOrCreate(['name' => $z['name']], [
                'polygon' => json_encode([
                    'type' => 'Polygon',
                    'coordinates' => [[
                        [$lng - $r, $lat - $r], [$lng + $r, $lat - $r],
                        [$lng + $r, $lat + $r], [$lng - $r, $lat + $r],
                        [$lng - $r, $lat - $r],
                    ]],
                ]),
                'is_active' => true,
            ]);
        }
    }

    // -------------------------------------------------------------------------
    // Admin
    // -------------------------------------------------------------------------
    private function seedAdmin(): Admin
    {
        $user = User::firstOrCreate(['email' => 'admin@foodjett.ph'], [
            'name' => 'FoodJett Admin',
            'phone' => null,
            'password' => bcrypt('password'),
            'role' => 'admin',
            'status' => 'active',
            'email_verified_at' => now(),
        ]);

        return Admin::firstOrCreate(['user_id' => $user->id]);
    }

    // -------------------------------------------------------------------------
    // Restaurants — 10 approved, each with full menu
    // -------------------------------------------------------------------------
    private function seedRestaurants(): \Illuminate\Support\Collection
    {
        $restaurantData = [
            ["Gabby's Bistro",             'Filipino',      "Perdices St"],
            ['Sans Rival Cakes & Pastries','Cafe & Pastry', "Flores Ave"],
            ['Lab-as Seafood Grill',        'Seafood',       "Rizal Blvd"],
            ['El Amigo Restaurant',         'Filipino',      "Real St"],
            ['Why Not Restaurant',          'Grill & Bar',   "Hibbard Ave"],
            ['Chin Loong Restaurant',       'Chinese',       "Locsin St"],
            ['Shawarma Snack Center',       'Fast Food',     "Campanario St"],
            ["Hayahay Treehouse",          'Grill & BBQ',   "EJ Blanco Dr"],
            ["Pepita's Kitchen",           'Filipino',      "Dr. V. Locsin St"],
            ['Brocolight Healthy Eats',    'Healthy',       "Silliman Ave"],
        ];

        $barangays = ['Bantayan', 'Piapi', 'Looc', 'Taclobo', 'Bagacay', 'Daro', 'Calindagan', 'Poblacion'];

        return collect($restaurantData)->map(function ($data) use ($barangays) {
            [$name, $cuisine, $street] = $data;
            $brgy = $barangays[array_rand($barangays)];

            $user = User::factory()->restaurantOwner()->create([
                'name' => $name . ' Owner',
                'email' => Str::slug($name) . '@foodjett.ph',
            ]);

            /** @var Restaurant $restaurant */
            $restaurant = Restaurant::create([
                'user_id' => $user->id,
                'name' => $name,
                'slug' => Str::slug($name),
                'description' => "One of Dumaguete's favorite {$cuisine} spots.",
                'cuisine_type' => $cuisine,
                'address' => "{$street}, Brgy. {$brgy}, Dumaguete City, Negros Oriental",
                'latitude' => fake()->randomFloat(7, 9.3000, 9.3200),
                'longitude' => fake()->randomFloat(7, 123.2900, 123.3100),
                'default_prep_time_minutes' => fake()->randomElement([10, 15, 20, 25]),
                'min_order_amount' => fake()->randomElement([50, 80, 100]),
                'commission_rate' => 15.00,
                'approval_status' => 'approved',
                'operating_status' => 'open',
                'payout_method' => fake()->randomElement(['bank', 'ewallet']),
                'payout_account_details' => ['account_name' => $name, 'account_number' => fake()->numerify('###########')],
            ]);

            // Documents
            foreach (['business_permit', 'food_safety_permit', 'owner_id'] as $docType) {
                RestaurantDocument::create([
                    'restaurant_id' => $restaurant->id,
                    'type' => $docType,
                    'file_path' => "documents/restaurants/{$docType}_{$restaurant->id}.jpg",
                    'status' => 'verified',
                ]);
            }

            // Operating hours — open all 7 days
            for ($day = 0; $day <= 6; $day++) {
                RestaurantOperatingHour::create([
                    'restaurant_id' => $restaurant->id,
                    'day_of_week' => $day,
                    'opens_at' => '08:00:00',
                    'closes_at' => '21:00:00',
                ]);
            }

            // Menu
            $this->seedMenu($restaurant);

            return $restaurant;
        });
    }

    private function seedMenu(Restaurant $restaurant): void
    {
        $menuStructure = [
            'Rice Meals' => [
                ['Adobong Manok', 130], ['Sinigang na Baboy', 180],
                ['Tinolang Manok', 150], ['Lechon Kawali', 160],
                ['Chicken Inasal', 120], ['Pinakbet', 120],
            ],
            'Soups & Merienda' => [
                ['Batchoy', 90], ['Lomi', 95], ['Arroz Caldo', 90],
            ],
            'Grilled & BBQ' => [
                ['Pork BBQ', 85], ['Chicken BBQ', 95], ['Liempo', 160],
                ['Inihaw na Bangus', 180],
            ],
            'Drinks' => [
                ['Buko Juice', 60], ['Gulaman', 45], ['Softdrinks (Bote)', 45],
                ['Mango Shake', 85], ['Bottled Water', 35],
            ],
            'Desserts' => [
                ['Halo-halo', 85], ['Leche Flan', 80], ['Buko Pandan', 80],
            ],
        ];

        // Each restaurant gets 3 out of 5 category groups for variety
        $selectedCategories = array_keys(
            array_slice($menuStructure, 0, fake()->numberBetween(3, 5), true)
        );

        foreach ($selectedCategories as $sortIndex => $categoryName) {
            $category = $restaurant->menuCategories()->create([
                'name' => $categoryName,
                'sort_order' => $sortIndex,
            ]);

            foreach ($menuStructure[$categoryName] as $itemData) {
                [$itemName, $price] = $itemData;

                $item = $category->menuItems()->create([
                    'name' => $itemName,
                    'description' => null,
                    'photo_path' => null,
                    'base_price' => $price,
                    'is_available' => fake()->boolean(90),
                    'is_featured' => fake()->boolean(15),
                    'available_from' => null,
                    'available_until' => null,
                ]);

                // 50% chance of having Size variants (Small / Regular / Large)
                if (fake()->boolean(50) && !str_contains($categoryName, 'Drinks')) {
                    foreach ([['Small', -20], ['Regular', 0], ['Large', 30]] as [$sizeName, $delta]) {
                        $item->variants()->create(['name' => $sizeName, 'price_delta' => $delta]);
                    }
                }

                // 40% chance of having 1–2 addons
                if (fake()->boolean(40)) {
                    $addonPool = [
                        ['Extra Rice', 25], ['Extra Sauce', 15], ['Extra Egg', 20],
                        ['Add Softdrinks', 40], ['Extra Gravy', 15],
                    ];
                    $selected = fake()->randomElements($addonPool, fake()->numberBetween(1, 2));
                    foreach ($selected as [$addonName, $addonPrice]) {
                        $item->addons()->create([
                            'name' => $addonName,
                            'price' => $addonPrice,
                            'is_available' => true,
                        ]);
                    }
                }
            }
        }
    }

    // -------------------------------------------------------------------------
    // Riders — 15 total, ~12 approved
    // -------------------------------------------------------------------------
    private function seedRiders(): \Illuminate\Support\Collection
    {
        $riderNames = [
            'Arjay Flores', 'Dennis Ramos', 'Kevin Cruz', 'Gilbert Santos',
            'Renz Villanueva', 'Noel Bautista', 'Jerome Reyes', 'Alvin Mendoza',
            'Ronnie Sabanal', 'Jayson Cabanero', 'Mark Almacen', 'Rodel Espinosa',
            'Benjie Lim', 'Carlo Gonzales', 'Efren Cabahug',
        ];

        return collect($riderNames)->map(function ($name, $index) {
            $approvalStatus = $index < 12 ? 'approved' : ($index === 12 ? 'pending' : 'rejected');

            $user = User::factory()->rider()->create([
                'name' => $name,
                'email' => Str::slug($name, '.') . '@foodjett.ph',
            ]);

            $rider = Rider::create([
                'user_id' => $user->id,
                'vehicle_type' => fake()->randomElement(['motorcycle', 'motorcycle', 'bicycle']),
                'plate_number' => strtoupper(fake()->bothify('??-####')),
                'approval_status' => $approvalStatus,
                'rejection_reason' => $approvalStatus === 'rejected' ? 'Incomplete documents.' : null,
                'availability_status' => $approvalStatus === 'approved'
                    ? fake()->randomElement(['available', 'available', 'offline', 'busy'])
                    : 'offline',
                'current_latitude' => fake()->randomFloat(7, 9.3000, 9.3200),
                'current_longitude' => fake()->randomFloat(7, 123.2900, 123.3100),
                'last_location_at' => now()->subMinutes(rand(1, 120)),
                'cash_on_hand' => 0,
                'cash_remit_limit' => 500,
                'payout_method' => fake()->randomElement(['bank', 'ewallet']),
                'payout_account_details' => ['account_number' => fake()->numerify('###########')],
            ]);

            foreach (['drivers_license', 'vehicle_registration', 'valid_id'] as $docType) {
                RiderDocument::create([
                    'rider_id' => $rider->id,
                    'type' => $docType,
                    'file_path' => "documents/riders/{$docType}_{$rider->id}.jpg",
                    'status' => $approvalStatus === 'approved' ? 'verified' : 'pending',
                ]);
            }

            return $rider;
        });
    }

    // -------------------------------------------------------------------------
    // Customers — 30 with 1–3 addresses each
    // -------------------------------------------------------------------------
    private function seedCustomers(): \Illuminate\Support\Collection
    {
        $streets = [
            'Perdices St', 'Locsin St', 'Real St', 'Rizal Blvd', 'Flores Ave',
            'Cervantes St', 'Sta. Catalina St', 'Dr. V. Locsin St', 'Campanario St',
            'EJ Blanco Dr', 'Hibbard Ave', 'San Jose St', 'Silliman Ave',
        ];
        $barangays = [
            'Bantayan', 'Piapi', 'Looc', 'Taclobo', 'Bagacay', 'Daro',
            'Calindagan', 'Junob', 'Tinago', 'Cadawinonan', 'Poblacion', 'Camanjac',
        ];
        $landmarks = [
            'Near Silliman University Gate', 'Across Lee Plaza',
            'Near Robinson\'s Dumaguete', 'Near Dumaguete Cathedral',
            'Near Public Market', 'Near Quezon Park', null, null,
        ];

        return collect(range(1, 30))->map(function () use ($streets, $barangays, $landmarks) {
            $user = User::factory()->customer()->create();
            $customer = Customer::create(['user_id' => $user->id]);

            $addressCount = fake()->numberBetween(1, 3);
            for ($i = 0; $i < $addressCount; $i++) {
                $brgy = $barangays[array_rand($barangays)];
                $street = $streets[array_rand($streets)];
                CustomerAddress::create([
                    'customer_id' => $customer->id,
                    'label' => $i === 0 ? 'Home' : fake()->randomElement(['Work', 'School', 'Other']),
                    'address_line' => fake()->buildingNumber() . ' ' . $street . ', Brgy. ' . $brgy . ', Dumaguete City',
                    'landmark' => $landmarks[array_rand($landmarks)],
                    'delivery_instructions' => fake()->optional(0.3)->sentence(),
                    'latitude' => fake()->randomFloat(7, 9.3000, 9.3200),
                    'longitude' => fake()->randomFloat(7, 123.2900, 123.3100),
                    'is_default' => $i === 0,
                ]);
            }

            return $customer->load('addresses');
        });
    }

    // -------------------------------------------------------------------------
    // Orders — 100 orders across all statuses
    // -------------------------------------------------------------------------
    private function seedOrders(
        \Illuminate\Support\Collection $restaurants,
        \Illuminate\Support\Collection $riders,
        \Illuminate\Support\Collection $customers
    ): void {
        $approvedRiders = $riders->where('approval_status', 'approved')->values();

        // Status distribution across 100 orders
        $statusPool = array_merge(
            array_fill(0, 50, 'delivered'),
            array_fill(0, 8,  'cancelled_by_customer'),
            array_fill(0, 5,  'cancelled_by_restaurant'),
            array_fill(0, 4,  'rejected_by_restaurant'),
            array_fill(0, 5,  'cancelled_no_rider'),
            array_fill(0, 5,  'finding_rider'),
            array_fill(0, 4,  'placed'),
            array_fill(0, 3,  'accepted'),
            array_fill(0, 3,  'preparing'),
            array_fill(0, 3,  'rider_assigned'),
            array_fill(0, 3,  'on_the_way'),
            array_fill(0, 3,  'arrived'),
            array_fill(0, 2,  'failed_delivery'),
        );
        shuffle($statusPool);

        $orderNum = 1;

        foreach ($statusPool as $status) {
            /** @var Restaurant $restaurant */
            $restaurant = $restaurants->random();

            /** @var Customer $customer */
            $customer = $customers->random();
            $address = $customer->addresses->first();
            if (!$address) continue;

            // Gather available menu items for this restaurant
            $menuItems = MenuItem::whereHas('category', fn ($q) => $q->where('restaurant_id', $restaurant->id))
                ->where('is_available', true)
                ->get();

            if ($menuItems->isEmpty()) continue;

            $placedAt = Carbon::now()->subDays(rand(1, 90))->subHours(rand(0, 23));
            $paymentMethod = fake()->randomElement(['cod', 'gcash', 'card']);

            // Build order items
            $selectedItems = $menuItems->random(min(fake()->numberBetween(1, 4), $menuItems->count()));
            $subtotal = 0;
            $orderItemsData = [];

            foreach ($selectedItems as $menuItem) {
                $variant = $menuItem->variants->isNotEmpty() && fake()->boolean(60)
                    ? $menuItem->variants->random()
                    : null;

                $unitPrice = (float) $menuItem->base_price + (float) ($variant?->price_delta ?? 0);
                $qty = fake()->numberBetween(1, 3);
                $lineTotal = $unitPrice * $qty;

                // Addons
                $addonData = [];
                if ($menuItem->addons->isNotEmpty() && fake()->boolean(40)) {
                    $selectedAddons = $menuItem->addons->random(
                        min(fake()->numberBetween(1, 2), $menuItem->addons->count())
                    );
                    foreach ($selectedAddons as $addon) {
                        $lineTotal += (float) $addon->price * $qty;
                        $addonData[] = $addon;
                    }
                }

                $subtotal += $lineTotal;
                $orderItemsData[] = [
                    'menu_item' => $menuItem,
                    'variant' => $variant,
                    'qty' => $qty,
                    'unit_price' => $unitPrice,
                    'addons' => $addonData,
                ];
            }

            $deliveryFee = fake()->randomElement([30, 40, 50, 60, 70, 80]);
            $serviceFee = 10;
            $totalAmount = round($subtotal + $deliveryFee + $serviceFee, 2);
            $commissionAmount = round($subtotal * ($restaurant->commission_rate / 100), 2);

            // Determine timestamps based on status
            $timestamps = $this->buildTimestamps($status, $placedAt);

            // Assign rider
            $riderId = null;
            if (in_array($status, self::RIDER_STATUSES) && $approvedRiders->isNotEmpty()) {
                $riderId = $approvedRiders->random()->id;
            }

            // Cancellation data
            $cancellationReason = null;
            $cancelledBy = null;
            $rejectionReason = null;
            if ($status === 'cancelled_by_customer') {
                $cancellationReason = fake()->randomElement([
                    'Nagbago ang isip ko.', 'Mali ang order ko, sorry.',
                    'Meron nang lutong pagkain sa bahay.', 'Emergency po.',
                ]);
                $cancelledBy = 'customer';
            } elseif ($status === 'cancelled_by_restaurant') {
                $cancellationReason = fake()->randomElement([
                    'Wala na kaming ingredients.', 'Sarado na kami.',
                    'Masyadong maraming orders ngayon.',
                ]);
                $cancelledBy = 'restaurant';
            } elseif ($status === 'rejected_by_restaurant') {
                $rejectionReason = fake()->randomElement([
                    'Out of stock ang item.', 'Sarado na kami sa oras na iyan.',
                    'Di namin maasikaso ang order na ito.',
                ]);
            } elseif ($status === 'cancelled_no_rider') {
                $cancellationReason = 'Walang nakitang rider sa iyong area. Subukan ulit mamaya.';
                $cancelledBy = 'system';
            } elseif ($status === 'failed_delivery') {
                $cancellationReason = 'Hindi ma-contact ang customer. Ibinalik ng rider ang order.';
                $cancelledBy = 'rider';
            }

            /** @var Order $order */
            $order = Order::create([
                'order_number' => 'FJ-' . str_pad($orderNum++, 6, '0', STR_PAD_LEFT),
                'customer_id' => $customer->id,
                'restaurant_id' => $restaurant->id,
                'customer_address_id' => $address->id,
                'rider_id' => $riderId,
                'status' => $status,
                'subtotal' => round($subtotal, 2),
                'delivery_fee' => $deliveryFee,
                'service_fee' => $serviceFee,
                'discount_amount' => 0,
                'tip_amount' => 0,
                'total_amount' => $totalAmount,
                'commission_amount' => $commissionAmount,
                'payment_method' => $paymentMethod,
                'customer_notes' => fake()->optional(0.2)->sentence(),
                'rejection_reason' => $rejectionReason,
                'cancellation_reason' => $cancellationReason,
                'cancelled_by' => $cancelledBy,
                'placed_at' => $timestamps['placed_at'],
                'accepted_at' => $timestamps['accepted_at'] ?? null,
                'estimated_prep_minutes' => isset($timestamps['accepted_at']) ? fake()->randomElement([10, 15, 20, 25]) : null,
                'estimated_ready_at' => $timestamps['estimated_ready_at'] ?? null,
                'prep_extended_minutes' => null,
                'ready_at' => $timestamps['ready_at'] ?? null,
                'rider_search_started_at' => $timestamps['rider_search_started_at'] ?? null,
                'rider_assigned_at' => $timestamps['rider_assigned_at'] ?? null,
                'rider_arrived_restaurant_at' => $timestamps['rider_arrived_restaurant_at'] ?? null,
                'picked_up_at' => $timestamps['picked_up_at'] ?? null,
                'delivered_at' => $timestamps['delivered_at'] ?? null,
                'pickup_code' => in_array($status, self::RIDER_STATUSES) ? strtoupper(Str::random(4)) : null,
                'proof_of_delivery_path' => $status === 'delivered' ? 'proofs/' . Str::uuid() . '.jpg' : null,
            ]);

            // Order items
            foreach ($orderItemsData as $oid) {
                $orderItem = OrderItem::create([
                    'order_id' => $order->id,
                    'menu_item_id' => $oid['menu_item']->id,
                    'menu_item_variant_id' => $oid['variant']?->id,
                    'quantity' => $oid['qty'],
                    'unit_price' => $oid['unit_price'],
                    'special_instructions' => null,
                ]);

                foreach ($oid['addons'] as $addon) {
                    OrderItemAddon::create([
                        'order_item_id' => $orderItem->id,
                        'menu_item_addon_id' => $addon->id,
                        'price' => $addon->price,
                    ]);
                }
            }

            // Payment
            $paymentStatus = match (true) {
                $status === 'delivered' => 'paid',
                in_array($status, ['cancelled_by_customer', 'cancelled_by_restaurant', 'cancelled_no_rider', 'failed_delivery', 'rejected_by_restaurant']) => 'refunded',
                $paymentMethod === 'cod' => 'pending',
                default => 'pending',
            };

            Payment::create([
                'order_id' => $order->id,
                'method' => $paymentMethod,
                'status' => $paymentStatus,
                'amount' => $totalAmount,
                'refunded_amount' => $paymentStatus === 'refunded' ? $totalAmount : 0,
                'transaction_reference' => $paymentMethod !== 'cod' ? strtoupper(Str::random(12)) : null,
                'paid_at' => $status === 'delivered' ? $timestamps['delivered_at'] : null,
                'refunded_at' => $paymentStatus === 'refunded' ? ($timestamps['placed_at']->copy()->addMinutes(30)) : null,
            ]);

            // Rider pool offer
            if (in_array($status, self::POOL_OFFER_STATUSES)) {
                $escalation = match ($status) {
                    'cancelled_no_rider' => 'auto_cancelled',
                    default => fake()->randomElement(['initial', 'initial', 'widened', 'incentivized']),
                };
                RiderPoolOffer::create([
                    'order_id' => $order->id,
                    'search_radius_km' => $escalation === 'initial' ? 3.0 : 8.0,
                    'incentive_amount' => $escalation === 'incentivized' ? fake()->randomElement([10, 20, 30]) : 0,
                    'escalation_stage' => $escalation,
                    'admin_assigned' => false,
                ]);
            }

            // Status history
            $this->createStatusHistory($order, $status, $timestamps);

            // Delivered-only: earnings + reviews
            if ($status === 'delivered') {
                $basePay = 40.00;
                $distancePay = round(fake()->randomFloat(2, 10, 60), 2);
                $waitingPay = fake()->boolean(25) ? fake()->randomElement([10, 15, 20, 25]) : 0;
                $tipAmount = 0;
                $totalEarned = $basePay + $distancePay + $waitingPay;

                RiderEarning::create([
                    'rider_id' => $riderId,
                    'order_id' => $order->id,
                    'base_pay' => $basePay,
                    'distance_pay' => $distancePay,
                    'waiting_pay' => $waitingPay,
                    'incentive_pay' => 0,
                    'tip_amount' => $tipAmount,
                    'total_earned' => $totalEarned,
                ]);

                // Restaurant review — 70% of delivered orders
                if (fake()->boolean(70)) {
                    $rating = fake()->randomElement([5, 5, 5, 4, 4, 4, 3, 2, 1]);
                    RestaurantReview::create([
                        'order_id' => $order->id,
                        'customer_id' => $customer->id,
                        'restaurant_id' => $restaurant->id,
                        'rating' => $rating,
                        'comment' => $rating >= 4
                            ? fake()->randomElement([
                                'Masarap! Babalik kami ulit.',
                                'Sulit na sulit ang presyo!',
                                'Palagi kaming nagorder dito.',
                                'Fresh ang pagkain, highly recommended!',
                            ])
                            : fake()->randomElement([
                                'Okay lang, pero matagal dumating.',
                                'Medyo maalat para sa amin.',
                                'Sana mas mainit pag dating.',
                            ]),
                        'photo_path' => null,
                        'restaurant_reply' => null,
                        'replied_at' => null,
                    ]);
                }

                // Rider review — 60% of delivered orders
                if (fake()->boolean(60) && $riderId) {
                    $rating = fake()->randomElement([5, 5, 5, 4, 4, 4, 3, 2, 1]);
                    RiderReview::create([
                        'order_id' => $order->id,
                        'customer_id' => $customer->id,
                        'rider_id' => $riderId,
                        'rating' => $rating,
                        'comment' => $rating >= 4
                            ? fake()->randomElement([
                                'Mabilis at maayos ang delivery!',
                                'Napaka-professional ng rider. Salamat!',
                                'Buo at mainit ang pagkain nang dumating.',
                                'Palagi siyang on-time. 5 stars!',
                            ])
                            : fake()->randomElement([
                                'Matagal dumating ang order.',
                                'Hindi masyadong nag-uupdate ng location.',
                            ]),
                    ]);
                }
            }
        }
    }

    /**
     * Build a chronologically-consistent timestamp map for a given status.
     */
    private function buildTimestamps(string $status, Carbon $placedAt): array
    {
        $ts = ['placed_at' => $placedAt->copy()];

        $terminalFood = ['rejected_by_restaurant', 'cancelled_by_customer'];
        $terminalRestaurant = ['cancelled_by_restaurant'];

        if (in_array($status, $terminalFood)) {
            if ($status === 'cancelled_by_customer') {
                // Cancelled before acceptance — no further timestamps
            }
            // rejected_by_restaurant — also no accepted_at
            return $ts;
        }

        // Accepted
        if (!in_array($status, ['placed'])) {
            $ts['accepted_at'] = $placedAt->copy()->addMinutes(rand(2, 8));
            $ts['estimated_ready_at'] = $ts['accepted_at']->copy()->addMinutes(rand(10, 25));
        }

        if (in_array($status, $terminalRestaurant)) {
            return $ts;
        }

        if ($status === 'accepted' || $status === 'preparing') {
            $ts['ready_at'] = $status === 'preparing'
                ? $ts['accepted_at']->copy()->addMinutes(rand(5, 15))
                : null;
            return $ts;
        }

        // ready → finding_rider
        if (!isset($ts['accepted_at'])) {
            return $ts;
        }
        $ts['ready_at'] = $ts['accepted_at']->copy()->addMinutes(rand(10, 25));
        $ts['rider_search_started_at'] = $ts['accepted_at']->copy();

        if (in_array($status, ['finding_rider', 'cancelled_no_rider'])) {
            return $ts;
        }

        // Rider assigned
        $ts['rider_assigned_at'] = $ts['rider_search_started_at']->copy()->addMinutes(rand(2, 10));

        if ($status === 'rider_assigned') return $ts;

        // At restaurant
        $ts['rider_arrived_restaurant_at'] = $ts['rider_assigned_at']->copy()->addMinutes(rand(5, 15));

        if ($status === 'at_restaurant') return $ts;

        // Picked up
        $ts['picked_up_at'] = $ts['rider_arrived_restaurant_at']->copy()->addMinutes(rand(2, 10));

        if ($status === 'picked_up') return $ts;

        // On the way → arrived → delivered/failed
        $arrivedAt = $ts['picked_up_at']->copy()->addMinutes(rand(10, 30));

        if ($status === 'on_the_way') return $ts;

        if (in_array($status, ['arrived', 'delivered', 'failed_delivery'])) {
            $ts['delivered_at'] = $status === 'delivered'
                ? $arrivedAt->copy()->addMinutes(rand(1, 5))
                : null;
        }

        return $ts;
    }

    /**
     * Write OrderStatusHistory entries tracing the order's lifecycle.
     */
    private function createStatusHistory(Order $order, string $status, array $timestamps): void
    {
        $flow = [
            'placed'                  => ['placed_at',                    'customer'],
            'accepted'                => ['accepted_at',                   'restaurant'],
            'preparing'               => ['accepted_at',                   'restaurant'],
            'ready'                   => ['ready_at',                      'restaurant'],
            'finding_rider'           => ['rider_search_started_at',       'system'],
            'rider_assigned'          => ['rider_assigned_at',             'system'],
            'at_restaurant'           => ['rider_arrived_restaurant_at',   'rider'],
            'picked_up'               => ['picked_up_at',                  'rider'],
            'on_the_way'              => ['picked_up_at',                  'rider'],
            'arrived'                 => ['picked_up_at',                  'rider'],
            'delivered'               => ['delivered_at',                  'rider'],
            'rejected_by_restaurant'  => ['placed_at',                     'restaurant'],
            'cancelled_by_customer'   => ['placed_at',                     'customer'],
            'cancelled_by_restaurant' => ['accepted_at',                   'restaurant'],
            'cancelled_no_rider'      => ['rider_search_started_at',       'system'],
            'failed_delivery'         => ['delivered_at',                  'rider'],
        ];

        // Always write placed
        OrderStatusHistory::create([
            'order_id' => $order->id,
            'status' => 'placed',
            'changed_by' => 'customer',
            'note' => null,
            'created_at' => $timestamps['placed_at'],
        ]);

        // Write the terminal status if it's not 'placed'
        if ($status !== 'placed' && isset($flow[$status])) {
            [$tsKey, $actor] = $flow[$status];
            $createdAt = $timestamps[$tsKey] ?? $timestamps['placed_at'];
            OrderStatusHistory::create([
                'order_id' => $order->id,
                'status' => $status,
                'changed_by' => $actor,
                'note' => null,
                'created_at' => $createdAt,
            ]);
        }
    }
}
