# Inventory POS

A multi-branch inventory and point-of-sale system. Manage products, stock, purchases, and sales across multiple branches with role-based access control.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) + React 19 |
| Auth | Clerk v7 |
| Database | Supabase (Postgres) |
| UI | shadcn/ui on Base UI v1.3 |
| Styling | Tailwind CSS v4 |
| State | Zustand v5 |
| Forms | React Hook Form + Zod v4 |
| Charts | Recharts v3 |

## Role Permissions

Four roles are supported: **Owner**, **Super Admin**, **Manager**, and **Cashier**.

> Owner and Super Admin see **All Branches**; Manager and Cashier see their assigned branch only.
> Owner and Super Admin are equivalent in permissions throughout the system.

<table>
  <thead>
    <tr>
      <th>Section / Feature</th>
      <th align="center">Owner</th>
      <th align="center">Super Admin</th>
      <th align="center">Manager</th>
      <th align="center">Cashier</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td colspan="5"><strong>Navigation</strong></td>
    </tr>
    <tr>
      <td>Dashboard</td>
      <td align="center">✅</td>
      <td align="center">✅</td>
      <td align="center">✅</td>
      <td align="center">✅</td>
    </tr>
    <tr>
      <td>POS</td>
      <td align="center">❌</td>
      <td align="center">❌</td>
      <td align="center">✅</td>
      <td align="center">✅</td>
    </tr>
    <tr>
      <td>Inventory</td>
      <td align="center">✅</td>
      <td align="center">✅</td>
      <td align="center">✅</td>
      <td align="center">✅</td>
    </tr>
    <tr>
      <td>Purchasing</td>
      <td align="center">✅</td>
      <td align="center">✅</td>
      <td align="center">✅</td>
      <td align="center">❌</td>
    </tr>
    <tr>
      <td>Reports</td>
      <td align="center">✅</td>
      <td align="center">✅</td>
      <td align="center">✅</td>
      <td align="center">✅</td>
    </tr>
    <tr>
      <td>Settings</td>
      <td align="center">✅</td>
      <td align="center">✅</td>
      <td align="center">✅</td>
      <td align="center">❌</td>
    </tr>
    <tr>
      <td colspan="5"><strong>POS</strong></td>
    </tr>
    <tr>
      <td>Process sales</td>
      <td align="center">❌</td>
      <td align="center">❌</td>
      <td align="center">✅</td>
      <td align="center">✅</td>
    </tr>
    <tr>
      <td>Hold / resume orders</td>
      <td align="center">❌</td>
      <td align="center">❌</td>
      <td align="center">✅</td>
      <td align="center">✅</td>
    </tr>
    <tr>
      <td colspan="5"><strong>Inventory</strong></td>
    </tr>
    <tr>
      <td>View products &amp; stock</td>
      <td align="center">✅</td>
      <td align="center">✅</td>
      <td align="center">✅</td>
      <td align="center">✅</td>
    </tr>
    <tr>
      <td>Add / edit / delete products</td>
      <td align="center">✅</td>
      <td align="center">✅</td>
      <td align="center">✅</td>
      <td align="center">❌</td>
    </tr>
    <tr>
      <td>Create stock transfer</td>
      <td align="center">✅</td>
      <td align="center">✅</td>
      <td align="center">✅</td>
      <td align="center">✅</td>
    </tr>
    <tr>
      <td>Approve / update transfer status</td>
      <td align="center">✅</td>
      <td align="center">✅</td>
      <td align="center">✅</td>
      <td align="center">❌</td>
    </tr>
    <tr>
      <td>Create stock adjustment</td>
      <td align="center">✅</td>
      <td align="center">✅</td>
      <td align="center">✅</td>
      <td align="center">❌</td>
    </tr>
    <tr>
      <td colspan="5"><strong>Purchasing</strong></td>
    </tr>
    <tr>
      <td>View purchase orders</td>
      <td align="center">✅</td>
      <td align="center">✅</td>
      <td align="center">✅</td>
      <td align="center">❌</td>
    </tr>
    <tr>
      <td>Create purchase order</td>
      <td align="center">✅</td>
      <td align="center">✅</td>
      <td align="center">✅</td>
      <td align="center">❌</td>
    </tr>
    <tr>
      <td>Approve / update PO status</td>
      <td align="center">✅</td>
      <td align="center">✅</td>
      <td align="center">✅</td>
      <td align="center">❌</td>
    </tr>
    <tr>
      <td>Receive goods (mark received)</td>
      <td align="center">✅</td>
      <td align="center">✅</td>
      <td align="center">✅</td>
      <td align="center">❌</td>
    </tr>
    <tr>
      <td>Add / edit suppliers</td>
      <td align="center">✅</td>
      <td align="center">✅</td>
      <td align="center">✅</td>
      <td align="center">❌</td>
    </tr>
    <tr>
      <td colspan="5"><strong>Reports</strong></td>
    </tr>
    <tr>
      <td>View sales reports</td>
      <td align="center">✅</td>
      <td align="center">✅</td>
      <td align="center">✅</td>
      <td align="center">✅</td>
    </tr>
    <tr>
      <td colspan="5"><strong>Settings</strong></td>
    </tr>
    <tr>
      <td>Manage categories</td>
      <td align="center">✅</td>
      <td align="center">✅</td>
      <td align="center">✅</td>
      <td align="center">❌</td>
    </tr>
    <tr>
      <td>Manage branches</td>
      <td align="center">✅</td>
      <td align="center">✅</td>
      <td align="center">✅</td>
      <td align="center">❌</td>
    </tr>
    <tr>
      <td>Manage users &amp; roles</td>
      <td align="center">✅</td>
      <td align="center">✅</td>
      <td align="center">❌</td>
      <td align="center">❌</td>
    </tr>
    <tr>
      <td>Organization settings</td>
      <td align="center">✅</td>
      <td align="center">✅</td>
      <td align="center">❌</td>
      <td align="center">❌</td>
    </tr>
  </tbody>
</table>

## Getting Started

```bash
npm install
npm run dev       # http://localhost:3000
```

### Required Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
CLERK_WEBHOOK_SECRET=
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/dashboard
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/dashboard

# App
NEXT_PUBLIC_DEFAULT_ORG_ID=00000000-0000-0000-0000-000000000001
```

### Demo Mode (optional)

Set `NEXT_PUBLIC_DEMO_MODE=true` to show a quick-login panel on the sign-in page with one-click access for each role.

```env
NEXT_PUBLIC_DEMO_MODE=true
DEMO_OWNER_EMAIL=
DEMO_OWNER_PASSWORD=
DEMO_SUPER_ADMIN_EMAIL=
DEMO_SUPER_ADMIN_PASSWORD=
DEMO_MANAGER_EMAIL=
DEMO_MANAGER_PASSWORD=
DEMO_CASHIER_EMAIL=
DEMO_CASHIER_PASSWORD=
```

## Project Structure

```
app/
  (auth)/           Sign-in / sign-up pages
  (dashboard)/      All protected routes
  api/webhooks/     Clerk webhook handler
components/
  ui/               shadcn/ui component wrappers
  pos/              POS cart, payment, hold orders
  layout/           Sidebar + navigation
lib/
  actions/          Server actions (all DB writes)
  context/          React context providers
  store/            Zustand cart store
supabase/
  migrations/       SQL migration files
types/
  database.ts       TypeScript DB types
```

## Database Migrations

| # | File | Description |
|---|------|-------------|
| 1 | `001_initial_schema.sql` | Tables, RLS, indexes |
| 2 | `002_seed_data.sql` | Initial seed data |
| 3 | `003_add_currency_to_organizations.sql` | Currency support |
| 4 | `004_add_tax_rate_to_organizations.sql` | Tax rate per org |
| 5 | `005_add_owner_role.sql` | Owner role |

## Commands

```bash
npm run dev      # Start dev server (port 3000)
npm run build    # Production build
npm run lint     # ESLint
```
