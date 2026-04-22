# Inventory POS — Claude Project Context

## What This Is
A multi-branch inventory and point-of-sale system. Businesses can manage products, stock, purchases, and sales across multiple branches. Users have role-based access (owner, super_admin, manager, cashier). Demo mode is supported for quick role-based testing.

## Tech Stack
- **Framework**: Next.js 16.1.7 (App Router), React 19.2.3
- **Auth**: Clerk (`@clerk/nextjs` v7.0.4) — `proxy.ts` handles auth middleware
- **Database**: Supabase (Postgres) via `@supabase/supabase-js` v2.99.2 + `@supabase/ssr` v0.9.0 — always use the **service role admin client** (bypasses RLS)
- **UI**: shadcn/ui (`shadcn` v4, style: `base-nova`) built on **Base UI** (`@base-ui/react` v1.3), NOT Radix UI
- **Styling**: Tailwind CSS v4 (CSS-first, no `tailwind.config.ts` — configured via `@theme` in `globals.css`)
- **Fonts**: Geist Sans + Geist Mono (`next/font/google`, CSS vars: `--font-geist-sans`, `--font-geist-mono`)
- **Forms**: React Hook Form v7 + Zod v4 (`zod/v4`)
- **State**: Zustand v5 (cart store at `lib/store/cart.ts`)
- **Charts**: Recharts v3
- **Toasts**: Sonner v2
- **Icons**: Lucide React v0.577
- **Date**: date-fns v4
- **Bundler**: Turbopack (top-level `turbopack` key in `next.config.ts`)

## Project Structure
```
app/
  (auth)/
    sign-in/[[...sign-in]]/   # Clerk sign-in (with demo mode panel)
    sign-up/[[...sign-up]]/   # Clerk sign-up
  (dashboard)/                # All authenticated pages
    dashboard/                # Overview/stats
    pos/                      # Point of sale
    inventory/
      products/               # Product catalog
      stock/                  # Stock levels
      transfers/              # Branch-to-branch stock transfers
      adjustments/            # Manual stock adjustments
    purchasing/
      orders/                 # Purchase orders
      suppliers/              # Supplier management
    reports/sales/            # Sales reports
    settings/
      branches/               # Branch management
      categories/             # Product categories
      users/                  # User management
      organization/           # Org settings
    layout.tsx                # Dashboard layout — fetches profile, seeds providers
    page.tsx                  # Redirects to /dashboard
  api/webhooks/clerk/         # Clerk webhook handler
  layout.tsx                  # Root layout (ClerkProvider, Geist fonts, Sonner, dark mode)
  globals.css                 # Tailwind v4 @theme + global styles
components/
  ui/                         # shadcn/ui component wrappers (Base UI based)
  auth/                       # demo-login-buttons.tsx
  pos/                        # POS-specific components
  layout/                     # Sidebar, nav
lib/
  actions/                    # Server actions ('use server')
  context/                    # React context providers
  store/                      # Zustand stores
  supabase/                   # Supabase client helpers
  utils/                      # Shared utilities
  cache-tags.ts               # Centralized cache tag constants
types/
  database.ts                 # Full DB type definitions
supabase/migrations/          # SQL migration files (5 total)
```

## Loading Skeletons
Every route has a `loading.tsx` file — Next.js wraps it in Suspense automatically, giving instant visual feedback while server data loads. Do not remove these. When adding a new route, always create a matching `loading.tsx` with a skeleton that mirrors the page's visual structure.

Existing `loading.tsx` files:
- `app/(dashboard)/dashboard/loading.tsx`
- `app/(dashboard)/pos/loading.tsx`
- `app/(dashboard)/inventory/products/loading.tsx`
- `app/(dashboard)/inventory/stock/loading.tsx`
- `app/(dashboard)/inventory/adjustments/loading.tsx`
- `app/(dashboard)/inventory/transfers/loading.tsx`
- `app/(dashboard)/purchasing/orders/loading.tsx`
- `app/(dashboard)/purchasing/suppliers/loading.tsx`
- `app/(dashboard)/settings/branches/loading.tsx`
- `app/(dashboard)/settings/users/loading.tsx`
- `app/(dashboard)/settings/categories/loading.tsx`
- `app/(dashboard)/settings/organization/loading.tsx`
- `app/(dashboard)/reports/sales/loading.tsx`
- `app/(dashboard)/reports/transactions/loading.tsx`
- `app/(dashboard)/reports/z-report/loading.tsx`

All skeletons import `Skeleton` from `@/components/ui/skeleton`.

## Database
Single-org setup. All tables have `org_id` that references `'00000000-0000-0000-0000-000000000001'` (hardcoded constant `ORG_ID` in server actions).

Key tables: `organizations`, `branches`, `profiles`, `categories`, `products`, `inventory`, `inventory_movements`, `transactions`, `transaction_items`, `stock_transfers`, `stock_transfer_items`, `purchase_orders`, `purchase_order_items`, `suppliers`

The `profiles` table links Clerk users (`clerk_user_id`) to roles and branches. Roles: `owner`, `super_admin`, `manager`, `cashier`.

Migrations (7 total):
1. `001_initial_schema.sql` — Tables, RLS, indexes
2. `002_seed_data.sql` — Initial seed data
3. `003_add_currency_to_organizations.sql` — Currency field
4. `004_add_tax_rate_to_organizations.sql` — Tax rate field
5. `005_add_owner_role.sql` — Owner role support
6. `006_add_qr_payment.sql` — Adds `gcash`/`maya` to `payment_method` enum; adds `gcash_qr_url`/`maya_qr_url` TEXT columns to `organizations`
7. `007_production_improvements.sql` — Adds `void_reason`/`voided_by`/`voided_at` to `transactions`; adds `receipt_header`/`receipt_footer`/`max_cashier_discount_pct` to `organizations`

**Important**: The `Database` type in `types/database.ts` has empty `Relationships: []` for all tables. Supabase join queries (e.g. `.select('*, transaction_items(...)')`) return `never` type — always cast with `as any[]` and re-type manually.

## Server Actions Pattern
All DB writes go through `lib/actions/*.ts` files marked `'use server'`.

```ts
// Standard pattern for every server action file
function getAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function someAction(params) {
  const { userId } = await auth()  // Clerk auth check
  if (!userId) throw new Error('Unauthorized')
  const supabase = getAdminClient()
  // ... do work ...
  revalidatePath('/some/path')
}
```

## Client Components Pattern
Pages are server components that fetch data and pass it to `*-client.tsx` client components.

```ts
// Standard client mutation pattern
const router = useRouter()
const [isPending, startTransition] = useTransition()

function handleSave(values) {
  startTransition(async () => {
    await someServerAction(values)
    router.refresh()  // Re-fetches server component data
  })
}
```

## Base UI Gotchas (CRITICAL)
This project uses `@base-ui/react`, NOT Radix UI. Key differences:

1. **DropdownMenu items use `onClick`, NOT `onSelect`**
   ```tsx
   <DropdownMenuItem onClick={() => doSomething()}>Edit</DropdownMenuItem>
   ```

2. **SelectValue needs explicit children for display label** — it does NOT auto-reflect `SelectItem` text
   ```tsx
   <SelectValue placeholder="Select category">
     {categories.find(c => c.id === watch('category_id'))?.name ?? 'Select category'}
   </SelectValue>
   ```

3. **SheetTrigger with a Button child** — use `render` prop + `nativeButton={true}` to avoid nested-button warning
   ```tsx
   <SheetTrigger render={<Button />} nativeButton={true}>
     Button Label
   </SheetTrigger>
   ```
   Or wrap children in SheetTrigger using `render`:
   ```tsx
   <SheetTrigger render={<Button />}>
     <Plus className="h-4 w-4" />
     Open Sheet
   </SheetTrigger>
   ```

4. **Controlled Sheets/Dialogs** — always make them controlled when you need to close them programmatically after a save:
   ```tsx
   const [open, setOpen] = React.useState(false)
   // In onSubmit: setOpen(false)
   ```

5. **Zod import** — use `import { z } from 'zod/v4'` (not `'zod'`)

## Supabase Join Disambiguation
When a table has multiple FK columns pointing to the same table, Supabase requires explicit FK disambiguation:
```ts
// WRONG — ambiguous, returns null
.select('profiles(full_name)')

// CORRECT — specify which FK
.select('creator:profiles!created_by(full_name)')
```

## Role-Based Access
- `cashier`: POS only, cannot approve transfers, cannot access settings
- `manager`: All operations except user/branch management
- `super_admin`: Full access including user/branch management, but NOT organization settings
- `owner`: Top-level role — only role that can access **Settings → Organization** (currency, tax rate, QR payment URLs)

Role checks should be done **server-side** in server actions (throw error) AND **client-side** (hide UI). Get role from the `profiles` table via `clerk_user_id`.

## Demo Mode
When `NEXT_PUBLIC_DEMO_MODE=true`, the sign-in page shows a panel with one-click login buttons for each role (Owner, Super Admin, Manager, Cashier). Demo credentials are stored in `DEMO_*` env vars and handled by `lib/actions/demo.ts` + `components/auth/demo-login-buttons.tsx`.

## Context Providers
- `lib/context/user-profile.tsx` — `useUserProfile()` hook `{ profile, branch, loading, refetch }` (SSR-seeded)
- `lib/context/currency.tsx` — currency formatting context, reads from org settings
- `lib/context/tax-rate-sync.tsx` — syncs org tax rate to cart store

## Cart Store (`lib/store/cart.ts`)
Zustand store for POS cart. Key methods:
- `addItem(product)` — adds or increments
- `loadHeldOrder(items)` — restores a held transaction into the cart
- `subtotal()`, `totalDiscount()`, `tax()`, `total()` — computed values (call as functions)
- Cart `discount` is a percentage (0–100); `totalDiscount()` includes both per-item and overall discounts

## POS Payment Methods
Supported: `cash`, `card`, `split`, `gcash`, `maya`.

- `gcash` and `maya` buttons only appear in the POS if the corresponding QR URL is configured in org settings.
- GCash/Maya payments show a QR image + total amount in the payment dialog. Cashier confirms manually after customer scans.
- QR URLs are stored in `organizations.gcash_qr_url` / `organizations.maya_qr_url` and fetched via `getOrgSettings()`.
- `POSClient` accepts `gcashQrUrl` and `mayaQrUrl` props passed from the server page.

## Barcode Scanner Support
POS search input has an `onKeyDown` handler. When Enter is pressed:
1. Checks for exact barcode match across all products (highest priority)
2. Falls back to adding if exactly one filtered result exists
3. Shows error toast if no match found

Scanners act as keyboards (fast-type + Enter), so no extra setup is needed — just focus the search input.

## UserProfileProvider
`lib/context/user-profile.tsx` — provides `useUserProfile()` hook with `{ profile, branch, loading, refetch }`.

**SSR-seeded (no client fetch on page load):** `app/(dashboard)/layout.tsx` fetches the full profile via `ensureProfile()` (selects `"*, branches(*)"`) and passes it to the provider:
```tsx
<UserProfileProvider initialProfile={profile?.profile ?? null} initialBranch={profile?.branch ?? null}>
```
When `initialProfile` is provided, the client-side `getMyProfile()` fetch is skipped. `refetch()` still works for post-update scenarios (e.g. after saving profile changes).

`ensureProfile()` returns `{ profile: Profile, branch: Branch | null } | null`. The `branches` join result is split out from the profile row before returning.

## Key Files Reference
| File | Purpose |
|------|---------|
| `lib/actions/transactions.ts` | POS sale + hold transactions, inventory deduction |
| `lib/actions/products.ts` | Product CRUD |
| `lib/actions/categories.ts` | Category CRUD |
| `lib/actions/transfers.ts` | Stock transfer create + status updates |
| `lib/actions/inventory.ts` | Stock adjustments, `getPOSProducts` |
| `lib/actions/purchasing.ts` | Purchase orders + suppliers |
| `lib/actions/users.ts` | User profile management |
| `lib/actions/organization.ts` | Org settings (currency, tax rate, QR URLs, receipt header/footer, max cashier discount) — `updateOwnerSettings` for owner-only fields |
| `lib/actions/transactions.ts` | POS sale + hold + void transactions, `getTransactions`, `clearExpiredHeldOrders` |
| `lib/actions/reports.ts` | Sales report data queries + `getZReport(date)` |
| `lib/actions/demo.ts` | Demo mode login helpers |
| `lib/context/user-profile.tsx` | `useUserProfile()` hook — SSR-seeded profile + branch |
| `lib/context/currency.tsx` | Currency formatting context |
| `lib/context/tax-rate-sync.tsx` | Syncs org tax rate to cart store |
| `lib/cache-tags.ts` | Centralized cache tag string constants |
| `types/database.ts` | All DB row types + convenience exports |
| `components/pos/payment-dialog.tsx` | POS payment confirmation → calls `createTransaction`; shows QR image for GCash/Maya |
| `components/pos/receipt-dialog.tsx` | Receipt preview + print after transaction |
| `components/pos/hold-order-dialog.tsx` | Hold order → calls `createHeldTransaction` |
| `components/pos/held-orders-sheet.tsx` | Resume/delete held orders from DB |
| `components/auth/demo-login-buttons.tsx` | Demo mode role quick-login buttons |
| `proxy.ts` | Clerk auth middleware (protects all non-public routes) |

## Commands
```bash
npm run dev      # Start dev server (port 3000)
npm run build    # Production build
npm run lint     # ESLint
```

## Environment Variables
```
# Supabase
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY

# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
CLERK_SECRET_KEY
CLERK_WEBHOOK_SECRET
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/dashboard
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/dashboard

# App
NEXT_PUBLIC_DEFAULT_ORG_ID=00000000-0000-0000-0000-000000000001

# Demo mode (optional)
NEXT_PUBLIC_DEMO_MODE=true
DEMO_SUPER_ADMIN_EMAIL
DEMO_SUPER_ADMIN_PASSWORD
DEMO_MANAGER_EMAIL
DEMO_MANAGER_PASSWORD
DEMO_CASHIER_EMAIL
DEMO_CASHIER_PASSWORD
DEMO_OWNER_EMAIL
DEMO_OWNER_PASSWORD
```
