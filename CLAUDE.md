# Inventory POS — Claude Project Context

## What This Is
A multi-branch inventory and point-of-sale system with role-based access (owner, manager, cashier) and demo mode support.

## Tech Stack
- **Framework**: Next.js 16 (App Router), React 19
- **Auth**: Clerk (`@clerk/nextjs` v7) — `proxy.ts` handles auth middleware
- **Database**: Supabase (Postgres) — always use the **service role admin client** (bypasses RLS)
- **UI**: shadcn/ui built on **Base UI** (`@base-ui/react` v1.3), NOT Radix UI
- **Styling**: Tailwind CSS v4 (CSS-first, no `tailwind.config.ts` — configured via `@theme` in `globals.css`)
- **Forms**: React Hook Form v7 + Zod v4 (`import { z } from 'zod/v4'`)
- **State**: Zustand v5 (cart store at `lib/store/cart.ts`)
- **Toasts**: Sonner v2 | **Icons**: Lucide React | **Date**: date-fns v4
- **Bundler**: Turbopack (top-level `turbopack` key in `next.config.ts`)

## Database
Single-org setup. All tables have `org_id = '00000000-0000-0000-0000-000000000001'` (constant `ORG_ID` in server actions).

Key tables: `organizations`, `branches`, `profiles`, `categories`, `products`, `inventory`, `inventory_movements`, `transactions`, `transaction_items`, `stock_transfers`, `stock_transfer_items`, `purchase_orders`, `purchase_order_items`, `suppliers`

Roles: `owner`, `manager`, `cashier` (stored in `profiles` linked to Clerk via `clerk_user_id`).

**Supabase join type gotcha**: `Relationships: []` is empty for all tables — join queries return `never`. Always cast with `as any[]` and re-type manually.

**Supabase FK disambiguation**: When multiple FKs point to the same table:
```ts
.select('creator:profiles!created_by(full_name)')  // NOT .select('profiles(full_name)')
```

## Migrations (7 total)
1. `001_initial_schema.sql` — Tables, RLS, indexes
2. `002_seed_data.sql` — Seed data
3. `003_add_currency_to_organizations.sql`
4. `004_add_tax_rate_to_organizations.sql`
5. `005_add_owner_role.sql`
6. `006_add_qr_payment.sql` — `gcash`/`maya` payment enum + QR URL columns
7. `007_production_improvements.sql` — `void_reason`/`voided_by`/`voided_at` on transactions; `receipt_header`/`receipt_footer`/`max_cashier_discount_pct` on organizations

## Server Actions Pattern
All DB writes go through `lib/actions/*.ts` marked `'use server'`. Use `getAdminClient()` (service role), check `auth()` first, call `revalidatePath()` after writes.

## Client Components Pattern
Pages = server components fetching data → pass to `*-client.tsx` client components. Client mutations use `useTransition` + `router.refresh()`.

## Base UI Gotchas (CRITICAL)
This project uses `@base-ui/react`, NOT Radix UI:

1. **DropdownMenu**: use `onClick`, NOT `onSelect`
2. **SelectValue**: requires explicit children — does NOT auto-reflect `SelectItem` text
   ```tsx
   <SelectValue placeholder="Select">{items.find(i => i.id === watch('id'))?.name ?? 'Select'}</SelectValue>
   ```
3. **SheetTrigger + Button**: use `render` prop to avoid nested-button warning
   ```tsx
   <SheetTrigger render={<Button />} nativeButton={true}>Label</SheetTrigger>
   ```
4. **Controlled Sheets/Dialogs**: use `useState` + set `false` in `onSubmit` to close programmatically

## Loading Skeletons
Every route needs a `loading.tsx` (Next.js auto-wraps in Suspense). When adding a new route, create a matching skeleton that mirrors the page structure. All skeletons import `Skeleton` from `@/components/ui/skeleton`.

## Role-Based Access
- `cashier`: POS only — no transfers approval, no settings
- `manager`: All operations except user/branch management
- `owner`: Full access including Settings → Organization, Branches, Users

Enforce server-side (throw in actions) AND client-side (hide UI).

## Context Providers
- `lib/context/user-profile.tsx` — `useUserProfile()` → `{ profile, branch, loading, refetch }` (SSR-seeded via `initialProfile`/`initialBranch` props)
- `lib/context/currency.tsx` — currency formatting
- `lib/context/tax-rate-sync.tsx` — syncs org tax rate to cart store

## Cart Store (`lib/store/cart.ts`)
- `addItem(product)`, `loadHeldOrder(items)`, `subtotal()`, `totalDiscount()`, `tax()`, `total()` (call as functions)
- `discount` is a percentage (0–100)

## POS Payment Methods
`cash`, `card`, `split`, `gcash`, `maya`. GCash/Maya buttons only appear if QR URLs are set in org settings. QR URLs stored in `organizations.gcash_qr_url` / `organizations.maya_qr_url`.

## Barcode Scanner
POS search `onKeyDown`: Enter → exact barcode match first, then single filtered result, else error toast.

## Key Files
| File | Purpose |
|------|---------|
| `lib/actions/transactions.ts` | POS sale + hold + void, `getTransactions`, `clearExpiredHeldOrders` |
| `lib/actions/products.ts` | Product CRUD |
| `lib/actions/categories.ts` | Category CRUD |
| `lib/actions/transfers.ts` | Stock transfer create + status updates |
| `lib/actions/inventory.ts` | Stock adjustments, `getPOSProducts` |
| `lib/actions/purchasing.ts` | Purchase orders + suppliers |
| `lib/actions/users.ts` | User profile management |
| `lib/actions/organization.ts` | Org settings — `updateOwnerSettings` for owner-only fields |
| `lib/actions/reports.ts` | Sales report + `getZReport(date)` |
| `lib/actions/demo.ts` | Demo mode login |
| `lib/context/user-profile.tsx` | `useUserProfile()` hook — SSR-seeded |
| `lib/cache-tags.ts` | Cache tag constants |
| `types/database.ts` | DB row types |
| `components/pos/payment-dialog.tsx` | Payment confirmation + QR display |
| `components/pos/receipt-dialog.tsx` | Receipt preview + print |
| `components/pos/hold-order-dialog.tsx` | Hold order |
| `components/pos/held-orders-sheet.tsx` | Resume/delete held orders |
| `proxy.ts` | Clerk auth middleware |

## Profile Role Gotcha
`ensureProfile()` defaults new users to `role: "cashier"`. After a DB reset, fix manually:
```sql
UPDATE profiles SET role = 'owner'   WHERE email = 'markjoseph475+owner@gmail.com';
UPDATE profiles SET role = 'manager' WHERE email = 'markjoseph475+manager@gmail.com';
```

## Local Dev Warning
The parent `practice/` directory has `node_modules.bak` / `package.json.bak` — **do NOT restore**. Blank page? Run `rm -rf .next` then restart.

# Supabase project ID: ulgfpurffyfrtdlahoal (hardware-pos, ap-southeast-1)
