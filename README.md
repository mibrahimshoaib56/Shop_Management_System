# Centralized Shop & Inventory Management System

A production-ready, monolithic web application that unifies **product catalog management, customer storefront, supplier restocking, real-time inventory tracking, point-of-sale (POS) billing, Khata credit ledger, financial analytics, and automated profit calculation** into a single, cohesive codebase engineered for **1-click deployment on Vercel**.

---

## Architecture Overview

This project has been restructured as a **unified TypeScript Monolith**:
- **Frontend SPA**: React 18, TypeScript, Tailwind CSS, Vite, TanStack React Query v5, Zustand.
- **Serverless API**: Native TypeScript Vercel Functions (`api/index.ts` and `api/routes/*.ts`), connecting directly to PostgreSQL via `pg` connection pooling.
- **Single Root Build**: Deploys as a single Vercel project with zero external server dependencies.

```
┌────────────────────────────────────────────────────────┐
│                      VERCEL                            │
│                                                        │
│  ┌────────────────────────┐   ┌─────────────────────┐  │      SSL / TLS
│  │   React SPA (Vite)     │   │ Node.js Serverless  │  │ ────────────────► PostgreSQL
│  │   /dist/               │   │ /api/* Handlers     │  │                  (Neon / Supabase /
│  │   • POS Billing        │   │ • Auth & Users      │  │                   Render / Local)
│  │   • Public Storefront  │   │ • Products & Stock  │  │                  • Row Locks (FOR UPDATE)
│  │   • Khata Ledger       │   │ • Sales & Khata     │  │                  • ACID Transactions
│  │   • Analytics Dashboard│   │ • Analytics & Report│  │                  • Auto-migration on start
│  └────────────────────────┘   └─────────────────────┘  │
└────────────────────────────────────────────────────────┘
```

---

## Features

| Module | Capability |
|---|---|
| **Public Storefront** | Responsive customer catalog with search, category filtering, and self-service receipt lookup by phone. |
| **POS Billing** | Barcode-scanner compatible, multi-item cart, instant checkout with row-level locks preventing overselling. |
| **Khata Credit Ledger** | Udhaar / customer ledger tracking credit sales, partial payments, and live balance calculations. |
| **Inventory Management** | Stock levels, minimum stock alerts, damaged/lost stock write-offs with automatic financial loss tracking. |
| **Purchases & Suppliers** | Supplier directory and purchase orders with automated weighted stock incrementing. |
| **Financial Analytics** | Today's revenue & profit KPIs, historical trends (daily/weekly/monthly), top-selling products, and category margins. |
| **Reports** | On-demand CSV export for Sales, Inventory, Purchases, Profitability, and Customer Khata. |
| **Authentication & RBAC** | JWT authentication with role-based access control (Admin vs Cashier) and server-side token revocation on logout. |

---

## Project Structure

```
Shop-and-Inventory/
├── api/                            # Vercel Serverless Functions (Node.js/TypeScript)
│   ├── index.ts                    # Central API gateway & router (/api/v1/*)
│   ├── dev-server.ts               # Local standalone API server (port 3001)
│   ├── db.ts                       # PostgreSQL connection pool & auto-migration
│   ├── auth.ts                     # JWT signing/verification, RBAC, error envelopes
│   └── routes/
│       ├── analytics.ts            # KPIs, trends, category revenue
│       ├── auth.ts                 # /auth/login, /auth/logout, /auth/me
│       ├── categories.ts           # Category CRUD
│       ├── customers.ts            # Customer directory & Khata ledger
│       ├── products.ts             # Products catalog & stock adjustments
│       ├── public.ts               # Public catalog & customer invoice lookup
│       ├── purchases.ts            # Supplier restocking & purchase orders
│       ├── reports.ts              # CSV report generation
│       ├── sales.ts                # Checkout (FOR UPDATE locks), refunds
│       ├── suppliers.ts            # Supplier management
│       └── users.ts                # Cashier/Admin user management
├── src/                            # React Frontend
│   ├── components/                 # Modals, Navbar, Layout, RoleGate, UI elements
│   ├── pages/                      # PosPage, DashboardPage, CustomerCatalogPage, ...
│   ├── stores/                     # authStore, cartStore, uiStore (Zustand)
│   ├── lib/                        # Axios client, QueryClient, formatters
│   └── types/                      # TypeScript API data contracts
├── package.json                    # Monorepo scripts and dependencies
├── vite.config.ts                  # Vite config with /api proxy to local dev server
├── vercel.json                     # Vercel deployment routes and serverless runtime
├── tsconfig.json                   # TypeScript config for frontend
├── tsconfig.api.json               # TypeScript config for serverless API
└── .env.example                    # Environment variable template
```

---

## Local Development Quickstart

### 1. Clone & Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env`:

```bash
copy .env.example .env
```

Set your PostgreSQL connection string in `.env`:

```ini
DATABASE_URL=postgresql://username:password@your-db-host/dbname
JWT_SECRET=your-random-32-character-secret-key
```

> **Note**: Database tables and the default admin user (`admin` / `admin1234`) will be automatically created on the first API request!

### 3. Start Development Servers

Run both the Vite frontend and local API simultaneously:

```bash
npm run dev:all
```

- **Frontend**: [http://localhost:5173](http://localhost:5173)
- **API Dev Server**: [http://localhost:3001/api](http://localhost:3001/api)

Or run them individually:
- `npm run dev` — starts the Vite frontend
- `npm run dev:api` — starts the TypeScript API dev server with file watching

---

## Deploying to Vercel (1-Click)

1. Push your repository to GitHub or GitLab.
2. In the [Vercel Dashboard](https://vercel.com/new), click **Import Project** and select this repository.
3. Keep default settings:
   - **Framework Preset**: Vite
   - **Root Directory**: `./`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Add the following **Environment Variables**:
   - `DATABASE_URL`: Your PostgreSQL connection string (Neon, Supabase, Render, etc.).
   - `JWT_SECRET`: A secure random secret string for JWT authentication.
5. Click **Deploy**.

Vercel will automatically build the React frontend and deploy the `api/index.ts` serverless function. On the first cold start, the database tables and default admin will initialize automatically.

---

## Default Credentials

- **Username**: `admin`
- **Password**: `admin1234`

*(Be sure to change the admin password upon first login under Settings → User Management)*
