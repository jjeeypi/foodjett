# 🍔 FoodJett

A modern full-stack web application built with **Laravel 13**, **React 19**, and **Inertia.js** — featuring a complete authentication system with passkeys, two-factor authentication, and a polished settings UI.

---

## ✨ Features

### 🔐 Authentication
- **Email & Password** login and registration
- **Email Verification** — users must verify their email before accessing protected routes
- **Two-Factor Authentication (2FA)** — TOTP-based 2FA with recovery codes
- **Passkeys** — passwordless login using WebAuthn/FIDO2
- **Password Confirmation** — re-prompt for password before sensitive actions
- **Forgot/Reset Password** flow

### 🛠️ User Settings
| Page | Features |
|------|----------|
| **Profile** | Update name, email |
| **Security** | Change password, manage 2FA, manage passkeys |
| **Appearance** | Theme preferences (light/dark mode) |

### 🎨 Frontend
- **React 19** with the React Compiler
- **Inertia.js v3** for seamless SPA-style navigation without an API
- **Tailwind CSS v4** for utility-first styling
- **Radix UI** for accessible, headless components
- **Lucide React** icons
- **Sonner** for toast notifications
- **Dark mode** support out of the box

---

## 🏗️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Laravel 13 (PHP 8.3+) |
| Frontend | React 19 + TypeScript |
| SSR Bridge | Inertia.js v3 |
| Styling | Tailwind CSS v4 |
| Auth | Laravel Fortify |
| Passkeys | `@laravel/passkeys` |
| Build Tool | Vite 8 (via `vite-plus`) |
| Type Safety | TypeScript + PHPStan (Larastan) |
| Linting | Pint (PHP) + ESLint (JS) |
| Testing | PHPUnit 12 |
| Database | SQLite (default) / MySQL / PostgreSQL |

---

## 📁 Project Structure

```
foodjett/
├── app/
│   ├── Actions/
│   │   └── Fortify/          # User creation & password reset logic
│   ├── Concerns/             # Shared validation rule traits
│   ├── Http/
│   │   ├── Controllers/
│   │   │   └── Settings/     # ProfileController, SecurityController
│   │   ├── Middleware/
│   │   └── Requests/
│   ├── Models/
│   │   └── User.php          # With 2FA + Passkey traits
│   └── Providers/
├── database/
│   ├── migrations/           # Users, cache, jobs, passkeys, 2FA columns
│   ├── factories/
│   └── seeders/
├── resources/
│   ├── css/
│   └── js/
│       ├── actions/          # Inertia form actions
│       ├── components/       # Reusable UI components
│       │   └── ui/           # Radix-based base components
│       ├── hooks/            # Custom React hooks
│       ├── layouts/          # App, Auth, Settings layouts
│       ├── pages/
│       │   ├── auth/         # Login, Register, 2FA, Passkey pages
│       │   ├── settings/     # Profile, Security, Appearance pages
│       │   ├── dashboard.tsx
│       │   └── welcome.tsx
│       ├── routes/           # Wayfinder-generated type-safe route helpers
│       └── types/
├── routes/
│   ├── web.php               # Core routes (home, dashboard)
│   └── settings.php          # Profile, security, appearance routes
└── tests/
```

---

## 🚀 Getting Started

### Prerequisites
- PHP **8.3+** with the required extensions
- Composer
- Node.js **18+** & npm

### Quick Setup

```bash
# 1. Clone the repository
git clone <your-repo-url>
cd foodjett

# 2. Run the one-command setup
composer setup
```

The `composer setup` command will:
1. Install PHP dependencies
2. Copy `.env.example` → `.env` and generate an app key
3. Run database migrations
4. Install Node dependencies
5. Build frontend assets

### Manual Setup

```bash
# Install PHP dependencies
composer install

# Set up environment
cp .env.example .env
php artisan key:generate

# Run migrations (creates the SQLite database automatically)
php artisan migrate

# Install Node dependencies
npm install

# Build assets
npm run build
```

---

## 🧑‍💻 Development

### Start the Dev Server

```bash
# Starts Laravel + Vite concurrently
composer dev
```

Or run them separately:

```bash
# Terminal 1 — Laravel
php artisan serve

# Terminal 2 — Vite HMR
npm run dev
```

Visit **http://localhost:8000** in your browser.

---

## ⚙️ Environment Variables

Key variables in `.env` (copy from `.env.example`):

```env
APP_NAME=FoodJett
APP_URL=http://localhost:8000

# Database (SQLite by default)
DB_CONNECTION=mariadb

# Mail (logs to file in dev)
MAIL_MAILER=log

# Queue & Cache (database driver by default)
QUEUE_CONNECTION=database
CACHE_STORE=database
```

For production, configure a real mail driver (SMTP, Mailgun, SES) and a database (MySQL/PostgreSQL).

---

## 🔒 Authentication Features

This project uses **Laravel Fortify** as the authentication backend. The following features are enabled by default:

| Feature | Enabled |
|---------|---------|
| Registration | ✅ |
| Email Verification | ✅ |
| Two-Factor Authentication | ✅ |
| Passkeys (WebAuthn) | ✅ |
| Password Confirmation | ✅ |
| Password Reset | ✅ |

Features can be toggled via `config/fortify.php` or by re-running the Chisel installer.

---

## 🧪 Testing

```bash
# Run the full test suite (includes lint + type checks)
composer test

# Run only PHPUnit tests
php artisan test

# PHP linting (Pint)
composer lint

# PHP static analysis (PHPStan / Larastan)
composer types:check

# TypeScript type checking
npm run types:check

# JS/TS lint check
npm run check
```

---

## 📦 Key Dependencies

### PHP (Composer)
| Package | Purpose |
|---------|---------|
| `laravel/framework` ^13 | Core framework |
| `laravel/fortify` ^1.37 | Authentication backend |
| `inertiajs/inertia-laravel` ^3 | Inertia.js server adapter |
| `laravel/wayfinder` ^0.1 | Type-safe route helpers |
| `laravel/chisel` ^0.1 | Feature installer |

### JavaScript (npm)
| Package | Purpose |
|---------|---------|
| `react` ^19 | UI library |
| `@inertiajs/react` ^3 | Inertia.js React adapter |
| `tailwindcss` ^4 | CSS framework |
| `@radix-ui/*` | Headless accessible components |
| `@laravel/passkeys` ^0.2 | Passkey / WebAuthn support |
| `lucide-react` | Icons |
| `sonner` | Toast notifications |

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Make your changes
4. Run tests (`composer test`)
5. Submit a pull request

---

## 📄 License

This project is open-sourced under the [MIT license](LICENSE).
