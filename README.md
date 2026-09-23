# FoodJett

FoodJett is a multi-role food ordering and delivery platform built with Laravel, Inertia, React, and TypeScript. It supports customers, restaurants, riders, and administrators, including role-scoped dashboards, restaurant/rider approval, hosted PayMongo checkout, cash-on-delivery collection, and rider cash remittance.

## Technology

| Layer          | Technology                                                    |
| -------------- | ------------------------------------------------------------- |
| Backend        | Laravel 13, PHP 8.3+                                          |
| Frontend       | React 19, TypeScript, Inertia.js 3                            |
| Styling        | Tailwind CSS 4, Radix UI, Lucide icons                        |
| Authentication | Laravel Fortify, email verification, 2FA, passkeys            |
| Database       | MariaDB/MySQL for the application; SQLite in-memory for tests |
| Payments       | PayMongo hosted checkout for GCash/card; internal COD flow    |
| Quality        | PHPUnit, PHPStan/Larastan, Pint, Vite Plus checks             |

## Implemented features

### Role-based authentication

- Four roles: `admin`, `restaurant`, `rider`, and `customer`.
- One-to-one role profiles attached to the shared `users` table.
- Customer, restaurant, and rider registration flows.
- Restaurant and rider accounts remain on their pending page until approved.
- Suspended or banned accounts are logged out by global middleware.
- Route middleware supports single or multiple roles and profile approval checks.
- Administrators are created from the command line; there is no public admin registration.

### Ordering and payments

- Customers select COD, GCash, or card during checkout.
- GCash/card checkouts use PayMongo's hosted checkout page.
- Online-payment orders are created only after server-side verification confirms payment.
- COD orders are created immediately with a pending payment.
- Rider delivery confirmation records cash collection and increases `cash_on_hand`.
- Failed COD delivery leaves the payment pending for administrator follow-up.
- Riders at or above their cash remittance limit cannot accept COD orders.
- Rider remittance requests and administrator confirmation are supported.
- Payment status changes are recorded separately from order status history.

### Admin panel

The custom admin interface is implemented with Inertia React—no external admin package is used.

Currently functional:

- Dashboard metrics and recent activity.
- Escalated unassigned-order warning.
- Paginated and searchable restaurant list.
- Restaurant approval queue with submitted documents.
- Restaurant profile, menu preview, recent orders, rating, and prep-time accuracy.
- Restaurant approval/rejection and account suspension/reactivation.
- Rider approval queue, document moderation, delivery history, performance metrics, and account suspension/reactivation.
- Per-document verification and rejection reasons for restaurant and rider applications.
- Paginated order operations list with status, restaurant, date-range, and order-number filters.
- Full order detail with items, delivery address, status/payment timelines, and rider-pool context.
- Escalated unassigned-order queue with 20-second polling and distance-sorted manual rider assignment.
- Order cancellation, internal refund recording, and auditable administrator actions.
- Paginated dispute reports with resolve/reject decisions and administrator attribution.
- Paginated and searchable rider cash remittances.
- Audit entries for restaurant and rider moderation actions.

The sidebar also establishes routes and placeholder pages for customers, categories, promotions, transactions, payouts, reviews, platform settings, delivery zones, administrators, and audit logs. Those modules do not yet contain their final business features.

## Application routes

| Area       | Prefix        | Access                                                 |
| ---------- | ------------- | ------------------------------------------------------ |
| Admin      | `/admin`      | Active, verified admin                                 |
| Restaurant | `/restaurant` | Restaurant; approval required outside the pending page |
| Rider      | `/rider`      | Rider; approval required outside the pending page      |
| Customer   | `/customer`   | Active, verified customer                              |

Public registration endpoints:

- `/register` — customer registration
- `/register/restaurant` — restaurant registration
- `/register/rider` — rider registration

## Local setup with XAMPP/MariaDB

### Requirements

- PHP 8.3 or newer with the extensions required by Laravel
- Composer
- Node.js and npm
- MariaDB/MySQL, such as the MariaDB server included with XAMPP

Ensure XAMPP's PHP executable is available on `PATH`, or substitute `php` below with the full executable path, such as `C:\xampp\php\php.exe`.

### Installation

1. Clone the project and install dependencies:

```bash
git clone <your-repository-url>
cd foodjett
composer install
npm install
```

2. Copy the environment file and generate an application key:

```bash
copy .env.example .env
php artisan key:generate
```

On macOS/Linux, use `cp .env.example .env` instead.

3. Start MariaDB in XAMPP and create an empty database named `foodjett` using phpMyAdmin or the MariaDB client.

4. Configure `.env`:

```env
APP_NAME=FoodJett
APP_URL=http://localhost:8000

DB_CONNECTION=mariadb
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=foodjett
DB_USERNAME=root
DB_PASSWORD=
```

Adjust the username, password, port, and database name for your local MariaDB installation.

5. Create the schema, optional development data, and public storage link:

```bash
php artisan migrate
php artisan db:seed
php artisan storage:link
```

Seeding is optional. The development seeder creates sample restaurants, riders, customers, orders, and this local administrator:

```text
Email: admin@foodjett.ph
Password: password
```

Never use the seeded password in a deployed environment.

6. Start development services:

```bash
composer dev
```

Alternatively, run Laravel and Vite separately:

```bash
php artisan serve
npm run dev
```

The default development URL is `http://localhost:8000`.

## Creating an administrator

Create an administrator without exposing a public registration route:

```bash
php artisan make:admin "Admin Name" admin@example.com "a-strong-password"
```

The command creates both the `users` record and its one-to-one `admins` profile.

## PayMongo configuration

Add PayMongo test or live credentials to `.env`:

```env
PAYMONGO_SECRET_KEY=
PAYMONGO_PUBLIC_KEY=
PAYMONGO_WEBHOOK_SECRET=
PAYMONGO_BASE_URL=https://api.paymongo.com
```

The webhook endpoint is:

```text
POST /webhooks/paymongo
```

For local webhook testing, expose the application through a secure public tunnel and register its HTTPS webhook URL with PayMongo. The customer callback is not trusted by itself: FoodJett retrieves the checkout session from PayMongo before creating an order.

Default order fees can also be configured:

```env
DEFAULT_DELIVERY_FEE=50
DEFAULT_SERVICE_FEE=10
```

## Development commands

```bash
# Start Laravel, the queue worker, logs, and Vite
composer dev

# Build production frontend assets
npm run build

# Generate sample application data
php artisan db:seed

# Show registered routes
php artisan route:list
```

## Testing and code quality

```bash
# Full PHP quality pipeline: Pint, PHPStan, and PHPUnit
composer test

# CI-oriented frontend and backend checks
composer ci:check

# PHPUnit only
php artisan test

# PHP formatting
composer lint

# PHP static analysis
composer types:check

# TypeScript checking
npm run types:check

# Frontend formatting and lint checks
npm run check
```

PHPUnit uses SQLite in-memory through `phpunit.xml`, so CI does not require the local XAMPP/MariaDB database. Application development continues to use the MariaDB connection configured in `.env`.

## Project structure

```text
app/
├── Actions/Orders/             Shared order creation logic
├── Console/Commands/           Administrator creation command
├── Http/Controllers/Admin/     Admin dashboard, approvals, and order operations
├── Http/Middleware/            Role, approval, and active-account checks
├── Models/                     Marketplace domain models
├── Policies/                   Role and ownership authorization
└── Services/PayMongo/          PayMongo client and verification

resources/js/
├── components/admin/           Reusable admin data table and pagination
├── layouts/admin-layout.tsx    Admin navigation and header
├── pages/admin/                Admin dashboard and management pages
├── pages/auth/                 Authentication and role registration
├── pages/customer/             Customer pages and checkout
├── pages/restaurant/           Restaurant pages
└── pages/rider/                Rider orders and remittances

tests/Feature/
├── Admin/                      Admin dashboard, approvals, and order workflows
├── Auth/                       Authentication and registration
├── Authorization/              Ownership policies
└── Payments/                   PayMongo and COD cash-flow tests
```

## Current business rules and known gaps

- An active restaurant or rider in admin metrics means an approved profile attached to an active user account. Restaurant operating status and rider availability are separate concerns.
- Dashboard revenue is gross payment value marked paid today, not net platform commission.
- Restaurant suspension changes the owner's user status and forces the restaurant closed. Reactivation does not automatically reopen it.
- Prep-time accuracy counts orders whose `ready_at` timestamp is on or before `estimated_ready_at`.
- Restaurant approval and individual document verification are separate states.
- Restaurant and rider registration do not yet upload approval documents. Document upload should be added to registration or a dedicated onboarding/profile-completion step using the public storage disk.
- Nearby-rider ordering uses straight-line Haversine distance from the restaurant, not road distance or ETA.
- Administrator refunds currently update FoodJett's payment ledger and status history only; PayMongo API refunds still need a gateway-specific integration and reconciliation flow.
- Administrator cancellation does not automatically refund a paid order or notify participants; those workflows should be added once notification and refund policy are defined.
- Most remaining admin navigation modules are placeholders; only the modules listed as functional above should be treated as complete.

## License

This project is open-sourced under the [MIT license](LICENSE).
