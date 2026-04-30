# Home Credit Installment Payment — Design Spec

**Date:** 2026-04-29  
**Status:** Approved

---

## Context

The store accepts Home Credit (HC) as a financing option at the POS. When a customer uses HC, the store may collect an optional downpayment upfront; the remainder is financed by HC, which pays the store in a single lump sum after the sale. The store needs to track which HC sales have been paid out and which are still pending.

---

## User Flow

### At the POS (payment dialog)

1. Cashier selects **Home Credit** as payment method.
2. Enters an optional **downpayment** amount (collected from the customer at the counter). If left blank/₱0, HC finances the full total.
3. Picks **terms**: 3 / 6 / 12 / 18 / 24 months.
4. A summary auto-computes: `HC Amount = Total − Downpayment`.
5. Cashier confirms the sale. The transaction is saved as `payment_method = 'home_credit'` and a linked `installment_plans` record is created with status `pending`.

### On the Installments tracking page (`/installments`)

- All roles can view the list.
- Manager/Owner sees a **Mark Received** button on pending rows.
- Clicking it records `status = 'received'` and `received_at = now()` on the `installment_plans` row.

---

## Data Model

### New table: `installment_plans`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `org_id` | `uuid` | FK → organizations |
| `transaction_id` | `uuid` | FK → transactions (unique — one plan per transaction) |
| `downpayment` | `numeric(14,2)` | 0 if fully financed |
| `hc_amount` | `numeric(14,2)` | Amount HC owes the store |
| `terms` | `integer` | Number of months (3/6/12/18/24) |
| `status` | `text` | `'pending'` or `'received'` |
| `received_at` | `timestamptz` | Nullable — set when marked received |
| `received_by` | `uuid` | FK → profiles — who marked it |
| `created_at` | `timestamptz` | |

### Existing `transactions` table

- Add `'home_credit'` to the `payment_method` enum.

### TypeScript types (`types/database.ts`)

Add `InstallmentPlan` row type matching the table above.

---

## Architecture

### Migration

New file: `supabase/migrations/021_home_credit_installments.sql`
- Alter `payment_method` enum to add `'home_credit'`
- Create `installment_plans` table with indexes on `org_id`, `transaction_id`, `status`

### Server actions (`lib/actions/installments.ts`)

- `getInstallmentPlans({ status? })` — fetch all plans for the org, joined with transaction (date, total) and customer name. Cast join result as `any[]`.
- `markInstallmentReceived(planId)` — set `status = 'received'`, `received_at = now()`, `received_by = profile.id`. Restrict to manager/owner.

### `lib/actions/transactions.ts`

- In `createTransaction()`: after inserting the transaction row, if `payment_method === 'home_credit'`, insert into `installment_plans`.
- New params: `hc_downpayment?: number`, `hc_terms?: number`, `hc_amount?: number`.

### Payment dialog (`components/pos/payment-dialog.tsx`)

- Add `home_credit` to the payment method tab list.
- When selected, show:
  - Downpayment input (optional, numeric, `₱` prefix)
  - Terms picker (chip buttons: 3 / 6 / 12 / 18 / 24)
  - Auto-computed summary: downpayment collected now + HC amount awaiting payout
- Validation: terms must be selected; `hc_amount` must be > 0.
- Pass `hc_downpayment`, `hc_terms`, `hc_amount` to `createTransaction()`.

### Installments page

| File | Purpose |
|---|---|
| `app/(dashboard)/installments/page.tsx` | Server component — fetch initial data, pass to client |
| `app/(dashboard)/installments/loading.tsx` | Skeleton mirroring page structure |
| `app/(dashboard)/installments/installments-client.tsx` | Client — table, status filter, mark received |

### Sidebar (`components/layout/sidebar.tsx`)

Add nav item under a suitable location (top-level or under a section):
```ts
{ label: 'Installments', href: '/installments', icon: CreditCard, roles: ['owner', 'manager', 'cashier'] }
```
"Mark Received" button hidden client-side for cashiers; server action enforces role check too.

---

## Component Details

### `installments-client.tsx`

- **State:** `filter: 'all' | 'pending' | 'received'`, `search: string`, `isPending` (transition)
- **Summary chips:** total pending count + sum, total received count + sum
- **Table columns:** Date · Customer · Sale Total · Downpayment · HC Amount · Terms · Status badge · Action
- **Mark Received:** calls `markInstallmentReceived(id)` in a `useTransition`, then `router.refresh()`
- **Cashier guard:** hide Mark Received button when `profile.role === 'cashier'`

---

## Role Access

| Action | Cashier | Manager | Owner |
|---|---|---|---|
| Process HC payment at POS | ✅ | ✅ | ✅ |
| View installments page | ✅ | ✅ | ✅ |
| Mark as Received | ❌ | ✅ | ✅ |

---

## Verification

1. At POS, select Home Credit → enter ₱2,500 downpayment, pick 12 months → confirm sale → verify transaction saved with `payment_method = 'home_credit'` and `installment_plans` row created with `status = 'pending'`.
2. Try with ₱0 downpayment → verify `hc_amount = total`.
3. Open `/installments` as cashier → list shows, Mark Received button absent.
4. Open as manager → click Mark Received → row updates to Received with today's date.
5. Filter by Pending / Received — correct rows shown.
6. Summary chips reflect correct counts and sums.
