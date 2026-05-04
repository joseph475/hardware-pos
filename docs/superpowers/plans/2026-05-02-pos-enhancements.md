# POS Enhancements: Tax Fix, Receipt Customer Name & Credit/Utang

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix Add Tax display gap in the payment dialog, add customer name to receipts, and build a Credit/Utang (Accounts Receivable) payment method with a dedicated tracking page.

**Architecture:** Three independent work streams — (1) a two-line presentation fix for the payment dialog and receipt when items have per-item Add Tax set; (2) threading `customerName` through `ReceiptData`; (3) a new `credit` payment method backed by an `accounts_receivable` DB table, a server-action layer, and a new AR dashboard page.

**Tech Stack:** Next.js 16 App Router, Supabase service-role client, Zustand cart store (`lib/store/cart.ts`), Base UI dialogs via shadcn/ui wrappers, Tailwind CSS v4, TypeScript.

---

## Already Implemented — Verify Before Starting

Two of the five requested features already exist. Confirm them manually before starting:

1. **Split Payment** — open POS, choose "Split" from the payment method strip, enter amounts for both legs, verify the "Remaining" counter reaches zero before Confirm is enabled.
2. **Recent Sales Reprint** — open POS topbar → "Recent Sales", click the print icon on any completed transaction, confirm the receipt dialog renders with the original items and total.

If both work, proceed.

---

### Task 1: Fix Add Tax Row Missing from Payment Dialog Summary

**Root cause:** `totalAddTax()` is included in `cart.total()` but the payment dialog summary panel never shows it. When any item has `add_tax_pct > 0`, the displayed Subtotal + Tax ≠ Total, which confuses cashiers.

**Files:**
- Modify: `components/pos/payment-dialog.tsx`

- [ ] **Step 1: Destructure `totalAddTax` from cart store**

Line 85 of `payment-dialog.tsx` currently reads:
```ts
const { items, bundleItems, clearCart, subtotal, totalDiscount, tax, total } = useCartStore()
```
Change to:
```ts
const { items, bundleItems, clearCart, subtotal, totalDiscount, totalAddTax, tax, total } = useCartStore()
```

- [ ] **Step 2: Add derived value near the other order-level consts**

After line 158 (`const itemCount = ...`), add:
```ts
const orderAddTax = totalAddTax()
```

- [ ] **Step 3: Insert Add Tax row into the summary panel**

The summary `<div className="space-y-1 text-sm">` block spans roughly lines 387–404. After the Discount row and before the Tax row, add:
```tsx
{orderAddTax > 0 && (
  <div className="flex justify-between">
    <span className="text-muted-foreground">Add Tax</span>
    <span className="text-blue-600 dark:text-blue-400">+{formatCurrency(orderAddTax)}</span>
  </div>
)}
```

- [ ] **Step 4: Verify manually**
  1. `npm run dev`
  2. Add a product to cart, set its Tax% to 6
  3. Open any payment method → payment dialog must now show an "Add Tax" line
  4. Confirm: Subtotal + Add Tax + Tax (org %) = Total

- [ ] **Step 5: Commit**
```bash
git add components/pos/payment-dialog.tsx
git commit -m "fix: show Add Tax row in payment dialog summary when items have per-item tax"
```

---

### Task 2: Add Add Tax Line to Receipt

**Files:**
- Modify: `components/pos/receipt-dialog.tsx`
- Modify: `components/pos/payment-dialog.tsx`

- [ ] **Step 1: Extend ReceiptData with `addTaxAmount`**

In `receipt-dialog.tsx`, in the `ReceiptData` interface, add after `taxAmount: number`:
```ts
addTaxAmount?: number
```

- [ ] **Step 2: Render the Add Tax row in ReceiptContent**

In `ReceiptContent`, after the discount row (`{data.discountAmount > 0 && row(...)}`), add:
```tsx
{(data.addTaxAmount ?? 0) > 0 && row("Add Tax:", `+${data.formatCurrency(data.addTaxAmount ?? 0)}`)}
```

- [ ] **Step 3: Pass `addTaxAmount` when building ReceiptData in payment-dialog.tsx**

In the `setReceiptData({...})` call (around line 251), add:
```ts
addTaxAmount: orderAddTax > 0 ? orderAddTax : undefined,
```

- [ ] **Step 4: Commit**
```bash
git add components/pos/receipt-dialog.tsx components/pos/payment-dialog.tsx
git commit -m "fix: add Add Tax line to receipt when per-item tax is present"
```

---

### Task 3: Add Customer Name to Receipt

**Files:**
- Modify: `components/pos/receipt-dialog.tsx`
- Modify: `components/pos/payment-dialog.tsx`

- [ ] **Step 1: Extend ReceiptData with `customerName`**

In `receipt-dialog.tsx` `ReceiptData` interface, add after `cashierName: string`:
```ts
customerName?: string | null
```

- [ ] **Step 2: Render customer name after the Cashier line**

In `ReceiptContent`, after:
```tsx
<ReceiptLine>{`Cashier: ${data.cashierName}`}</ReceiptLine>
```
Add:
```tsx
{data.customerName && (
  <ReceiptLine>{`Customer: ${data.customerName}`}</ReceiptLine>
)}
```

- [ ] **Step 3: Pass `customerName` when building ReceiptData in payment-dialog.tsx**

`PaymentDialog` already receives `customerName` as a prop (line 46). In `setReceiptData({...})`, add:
```ts
customerName: customerName ?? undefined,
```

- [ ] **Step 4: Verify**
  1. In POS, select a customer (via the customer step), complete a cash transaction
  2. Receipt dialog must show "Customer: [Name]" on the line below "Cashier: [Name]"
  3. Complete a transaction without a customer — that line must be absent

- [ ] **Step 5: Commit**
```bash
git add components/pos/receipt-dialog.tsx components/pos/payment-dialog.tsx
git commit -m "feat: add customer name to POS receipt"
```

---

### Task 4: DB Migration — Credit Enum Value + AR Table

**Files:**
- Create: `supabase/migrations/026_credit_payment.sql`

- [ ] **Step 1: Create the migration file**

Create `supabase/migrations/026_credit_payment.sql` with:
```sql
-- Add 'credit' to the payment_method enum
ALTER TYPE payment_method ADD VALUE IF NOT EXISTS 'credit';

-- Accounts Receivable — one row per credit sale
CREATE TABLE IF NOT EXISTS accounts_receivable (
  id             UUID          NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id         UUID          NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id      UUID          NOT NULL REFERENCES branches(id)      ON DELETE CASCADE,
  transaction_id UUID          NOT NULL REFERENCES transactions(id)  ON DELETE CASCADE,
  customer_name  TEXT          NOT NULL,
  amount_due     NUMERIC(12,2) NOT NULL,
  amount_paid    NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes          TEXT,
  cashier_id     UUID          NOT NULL REFERENCES profiles(id),
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ar_org_id    ON accounts_receivable(org_id);
CREATE INDEX IF NOT EXISTS idx_ar_branch_id ON accounts_receivable(branch_id);
```

- [ ] **Step 2: Apply migration**

Via MCP (`mcp__claude_ai_Supabase__apply_migration`) or paste directly into the Supabase SQL editor for project `ulgfpurffyfrtdlahoal`.

- [ ] **Step 3: Commit**
```bash
git add supabase/migrations/026_credit_payment.sql
git commit -m "feat: add credit payment_method enum value and accounts_receivable table"
```

---

### Task 5: Update TypeScript DB Types

**Files:**
- Modify: `types/database.ts`

- [ ] **Step 1: Add `'credit'` to the three `payment_method` union literals**

Find lines ~632 (Row), ~656 (Insert), ~680 (Update) — the three places `payment_method` is typed. Append `| "credit"` to each:

Line ~632 (Row):
```ts
payment_method: "cash" | "card" | "split" | "gcash" | "maya" | "check" | "e_wallet" | "home_credit" | "credit";
```
Line ~656 (Insert):
```ts
payment_method: "cash" | "card" | "split" | "gcash" | "maya" | "check" | "e_wallet" | "home_credit" | "credit";
```
Line ~680 (Update, optional):
```ts
payment_method?: "cash" | "card" | "split" | "gcash" | "maya" | "check" | "e_wallet" | "home_credit" | "credit";
```

- [ ] **Step 2: Add `accounts_receivable` table type**

After the last table entry inside `Tables: { ... }`, add:
```ts
accounts_receivable: {
  Row: {
    id: string;
    org_id: string;
    branch_id: string;
    transaction_id: string;
    customer_name: string;
    amount_due: number;
    amount_paid: number;
    notes: string | null;
    cashier_id: string;
    created_at: string;
  };
  Insert: {
    id?: string;
    org_id: string;
    branch_id: string;
    transaction_id: string;
    customer_name: string;
    amount_due: number;
    amount_paid?: number;
    notes?: string | null;
    cashier_id: string;
    created_at?: string;
  };
  Update: {
    id?: string;
    org_id?: string;
    branch_id?: string;
    transaction_id?: string;
    customer_name?: string;
    amount_due?: number;
    amount_paid?: number;
    notes?: string | null;
    cashier_id?: string;
    created_at?: string;
  };
  Relationships: [];
};
```

- [ ] **Step 3: Commit**
```bash
git add types/database.ts
git commit -m "feat: add credit payment method and accounts_receivable types to database.ts"
```

---

### Task 6: Server Actions — AR Entry Creation + Queries

**Files:**
- Create: `lib/actions/ar.ts`
- Modify: `lib/actions/transactions.ts`

- [ ] **Step 1: Create `lib/actions/ar.ts`**

```ts
'use server'

import { createClient } from '@supabase/supabase-js'
import { auth } from '@clerk/nextjs/server'
import { revalidatePath } from 'next/cache'
import type { Database } from '@/types/database'

const ORG_ID = '00000000-0000-0000-0000-000000000001'

function getAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function createAREntry(params: {
  transaction_id: string
  customer_name: string
  amount_due: number
  branch_id: string
  cashier_id: string
  notes?: string | null
}) {
  const supabase = getAdminClient()
  const { error } = await supabase.from('accounts_receivable').insert({
    org_id: ORG_ID,
    branch_id: params.branch_id,
    transaction_id: params.transaction_id,
    customer_name: params.customer_name,
    amount_due: params.amount_due,
    amount_paid: 0,
    notes: params.notes ?? null,
    cashier_id: params.cashier_id,
  })
  if (error) throw new Error(error.message)
  revalidatePath('/accounts-receivable')
}

export type AREntry = {
  id: string
  transaction_id: string
  customer_name: string
  amount_due: number
  amount_paid: number
  balance: number
  notes: string | null
  created_at: string
  branch_name: string
  cashier_name: string
}

export async function getAREntries(): Promise<AREntry[]> {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')
  const supabase = getAdminClient()

  const { data, error } = await supabase
    .from('accounts_receivable')
    .select('*, branch:branches!branch_id(name), cashier:profiles!cashier_id(full_name)')
    .eq('org_id', ORG_ID)
    .order('created_at', { ascending: false }) as any

  if (error) throw new Error(error.message)
  return (data ?? []).map((r: any) => ({
    id: r.id,
    transaction_id: r.transaction_id,
    customer_name: r.customer_name,
    amount_due: r.amount_due,
    amount_paid: r.amount_paid,
    balance: r.amount_due - r.amount_paid,
    notes: r.notes,
    created_at: r.created_at,
    branch_name: r.branch?.name ?? '—',
    cashier_name: r.cashier?.full_name ?? '—',
  }))
}
```

- [ ] **Step 2: Wire AR entry creation into `createTransaction`**

In `lib/actions/transactions.ts`, after the existing `home_credit` block (around line 178), add:
```ts
if (params.payment_method === 'credit') {
  const ORG_ID = '00000000-0000-0000-0000-000000000001'
  await supabase.from('accounts_receivable').insert({
    org_id: ORG_ID,
    branch_id: profile.branch_id,
    transaction_id: transaction.id,
    customer_name: params.credit_customer_name ?? 'Unknown Customer',
    amount_due: params.total,
    amount_paid: 0,
    cashier_id: profile.id,
  })
}
```

Also add `credit_customer_name` to the `createTransaction` params interface (after `installment_company`, around line 88):
```ts
credit_customer_name?: string | null
```

And add `'credit'` to the `payment_method` union in the params type (line 74):
```ts
payment_method: 'cash' | 'card' | 'split' | 'gcash' | 'maya' | 'check' | 'e_wallet' | 'home_credit' | 'credit'
```

- [ ] **Step 3: Commit**
```bash
git add lib/actions/ar.ts lib/actions/transactions.ts
git commit -m "feat: add AR server actions and wire credit payment to AR entry creation in createTransaction"
```

---

### Task 7: Credit Payment UI in PaymentDialog

**Files:**
- Modify: `components/pos/payment-dialog.tsx`
- Modify: `components/pos/receipt-dialog.tsx`

- [ ] **Step 1: Add `'credit'` to the local `PaymentMethod` type (line 32)**

```ts
type PaymentMethod = "cash" | "card" | "split" | "gcash" | "maya" | "check" | "e_wallet" | "home_credit" | "credit"
```

- [ ] **Step 2: Add `paymentMethodLabel` entry**

In the `paymentMethodLabel` function (line 56), before the final return:
```ts
if (method === "credit") return "Credit (Utang)"
```

- [ ] **Step 3: Add credit customer name state**

After the `hcAccountNumber` state (around line 107), add:
```ts
const [creditCustomerName, setCreditCustomerName] = React.useState("")
```

- [ ] **Step 4: Reset credit state on dialog close and pre-fill from selected customer**

In `handleOpenChange` (around line 344), inside the `if (!value)` block, add:
```ts
setCreditCustomerName("")
```

Also add a `useEffect` after the other useEffects (around line 135) to pre-fill the name when the cashier switches to credit and a customer is already selected:
```ts
React.useEffect(() => {
  if (paymentMethod === "credit" && customerName && !creditCustomerName) {
    setCreditCustomerName(customerName)
  }
}, [paymentMethod]) // eslint-disable-line react-hooks/exhaustive-deps
```

- [ ] **Step 5: Add credit validation and wire `canConfirm`**

After the `isHcValid` const, add:
```ts
const isCreditValid =
  paymentMethod === "credit" ? creditCustomerName.trim() !== "" : true
```

Update `canConfirm` to include:
```ts
(paymentMethod === "credit" && isCreditValid)
```

- [ ] **Step 6: Pass `credit_customer_name` to `createTransaction`**

In `handleConfirm` → the `createTransaction({...})` call, add:
```ts
credit_customer_name: paymentMethod === "credit" ? creditCustomerName.trim() : null,
```

- [ ] **Step 7: Pass `creditCustomerName` to ReceiptData**

The `customerName` field was added in Task 3. In `setReceiptData({...})`, update the `customerName` line to prefer the credit-override:
```ts
customerName: paymentMethod === "credit"
  ? creditCustomerName.trim()
  : (customerName ?? undefined),
```

- [ ] **Step 8: Add the credit UI section in the dialog body**

After the HomeCredit (`home_credit`) section block, add:
```tsx
{/* Credit / Utang */}
{paymentMethod === "credit" && (
  <div className="space-y-3">
    <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
      This sale will be recorded as credit (utang). Enter the customer&apos;s name below.
    </div>
    <div className="space-y-1.5">
      <Label htmlFor="credit-name">Customer Name</Label>
      <Input
        id="credit-name"
        placeholder="e.g. Juan dela Cruz"
        value={creditCustomerName}
        onChange={(e) => setCreditCustomerName(e.target.value)}
        autoFocus
      />
    </div>
  </div>
)}
```

- [ ] **Step 9: Add `'credit'` label in `receipt-dialog.tsx` payment display**

In `receipt-dialog.tsx`, the payment method label expression (around line 176), add before the catch-all:
```tsx
data.paymentMethod === "credit" ? "Credit (Utang)" :
```

Also add `"credit"` to the `paymentMethod` union in `ReceiptData`:
```ts
paymentMethod: "cash" | "card" | "split" | "gcash" | "maya" | "check" | "e_wallet" | "home_credit" | "credit"
```

- [ ] **Step 10: Commit**
```bash
git add components/pos/payment-dialog.tsx components/pos/receipt-dialog.tsx
git commit -m "feat: add credit/utang payment method to PaymentDialog and receipt"
```

---

### Task 8: Credit Button in POS + AR Page + Sidebar

**Files:**
- Modify: `app/(dashboard)/pos/pos-client.tsx`
- Create: `app/(dashboard)/accounts-receivable/page.tsx`
- Create: `app/(dashboard)/accounts-receivable/ar-client.tsx`
- Create: `app/(dashboard)/accounts-receivable/loading.tsx`
- Modify: `components/layout/sidebar.tsx`

- [ ] **Step 1: Add `'credit'` to `PaymentMethod` type and `paymentMethods` array in pos-client.tsx**

Line 42 of `pos-client.tsx`:
```ts
type PaymentMethod = "cash" | "card" | "split" | "gcash" | "maya" | "check" | "e_wallet" | "home_credit" | "credit"
```

In the `paymentMethods` array (line ~407), add after the `home_credit` entry:
```ts
{ value: "credit", label: "Credit", icon: <HandCoins className="h-4 w-4" /> },
```

Add `HandCoins` to the lucide-react import at the top of the file.

**Also update the "Charge →" button onClick** to bypass customer selection when credit is already chosen (the cashier enters the name in the payment dialog instead):

Find the onClick handler (around line 1140):
```tsx
onClick={() => {
  if (selectedCustomerId) {
    setPaymentDialogOpen(true)
  } else {
    setCustomerStepOpen(true)
  }
}}
```
Change to:
```tsx
onClick={() => {
  if (paymentMethod === "credit" || selectedCustomerId) {
    setPaymentDialogOpen(true)
  } else {
    setCustomerStepOpen(true)
  }
}}
```

This lets cashiers process a credit sale without first picking from the customer DB — they type the name directly in the credit dialog.

- [ ] **Step 2: Create `app/(dashboard)/accounts-receivable/page.tsx`**

```tsx
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { getAREntries } from '@/lib/actions/ar'
import { ARClient } from './ar-client'

export const dynamic = 'force-dynamic'

export default async function AccountsReceivablePage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const { data: profileData } = await supabase
    .from('profiles')
    .select('role')
    .eq('clerk_user_id', userId)
    .single()

  const role = (profileData as any)?.role ?? 'cashier'
  const entries = await getAREntries()

  return <ARClient initialEntries={entries} userRole={role} />
}
```

- [ ] **Step 3: Create `app/(dashboard)/accounts-receivable/ar-client.tsx`**

```tsx
"use client"

import * as React from "react"
import { formatDate } from "@/lib/format"
import { useCurrency } from "@/lib/context/currency"
import type { AREntry } from "@/lib/actions/ar"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Search } from "lucide-react"

interface ARClientProps {
  initialEntries: AREntry[]
  userRole: string
}

export function ARClient({ initialEntries }: ARClientProps) {
  const { formatCurrency } = useCurrency()
  const [search, setSearch] = React.useState("")

  const filtered = initialEntries.filter((e) =>
    e.customer_name.toLowerCase().includes(search.toLowerCase()) ||
    e.transaction_id.toLowerCase().includes(search.toLowerCase())
  )

  const totalDue = initialEntries.reduce((s, e) => s + e.amount_due, 0)
  const totalOutstanding = initialEntries.reduce((s, e) => s + e.balance, 0)

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Accounts Receivable</h1>
          <p className="text-sm text-muted-foreground">Credit sales (utang) tracking</p>
        </div>
        <div className="flex gap-3">
          <div className="rounded-lg border bg-card px-4 py-2 text-center">
            <p className="text-xs text-muted-foreground">Total Billed</p>
            <p className="text-base font-semibold">{formatCurrency(totalDue)}</p>
          </div>
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-2 text-center">
            <p className="text-xs text-muted-foreground">Outstanding</p>
            <p className="text-base font-semibold text-amber-600 dark:text-amber-400">
              {formatCurrency(totalOutstanding)}
            </p>
          </div>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by customer or receipt #"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-muted-foreground text-xs uppercase tracking-wider">
              <th className="px-4 py-3 text-left font-semibold">Date</th>
              <th className="px-4 py-3 text-left font-semibold">Customer</th>
              <th className="px-4 py-3 text-left font-semibold">Cashier</th>
              <th className="px-4 py-3 text-right font-semibold">Amount Due</th>
              <th className="px-4 py-3 text-right font-semibold">Paid</th>
              <th className="px-4 py-3 text-right font-semibold">Balance</th>
              <th className="px-4 py-3 text-left font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                  No credit sales found
                </td>
              </tr>
            ) : (
              filtered.map((entry) => (
                <tr key={entry.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 tabular-nums">{formatDate(entry.created_at)}</td>
                  <td className="px-4 py-3 font-medium">{entry.customer_name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{entry.cashier_name}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(entry.amount_due)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-green-600 dark:text-green-400">
                    {entry.amount_paid > 0 ? formatCurrency(entry.amount_paid) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold">
                    {entry.balance > 0 ? (
                      <span className="text-amber-600 dark:text-amber-400">{formatCurrency(entry.balance)}</span>
                    ) : (
                      <span className="text-green-600 dark:text-green-400">{formatCurrency(0)}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      className={
                        entry.balance <= 0
                          ? "border-transparent bg-green-500/15 text-green-700 dark:text-green-400"
                          : "border-transparent bg-amber-500/15 text-amber-700 dark:text-amber-400"
                      }
                    >
                      {entry.balance <= 0 ? "Paid" : "Unpaid"}
                    </Badge>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Create `app/(dashboard)/accounts-receivable/loading.tsx`**

```tsx
import { Skeleton } from "@/components/ui/skeleton"

export default function ARLoading() {
  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div className="space-y-1.5">
          <Skeleton className="h-6 w-52" />
          <Skeleton className="h-4 w-44" />
        </div>
        <div className="flex gap-3">
          <Skeleton className="h-14 w-32 rounded-lg" />
          <Skeleton className="h-14 w-32 rounded-lg" />
        </div>
      </div>
      <Skeleton className="h-9 w-72" />
      <div className="rounded-xl border overflow-hidden">
        <div className="flex gap-4 px-4 py-3 border-b bg-muted/40">
          {["w-20", "w-32", "w-24", "w-24", "w-20", "w-20", "w-16"].map((w, i) => (
            <Skeleton key={i} className={`h-4 ${w}`} />
          ))}
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex gap-4 px-4 py-3 border-b last:border-0">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-24 ml-auto" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Add AR link to sidebar (`components/layout/sidebar.tsx`)**

Add `Landmark` to the lucide-react import. Then in the `NAV_ENTRIES` array, after the Installments link (around line 100):
```ts
{
  type: "link",
  label: "Accounts Receivable",
  href: "/accounts-receivable",
  icon: Landmark,
  roles: ["owner", "manager", "cashier"],
},
```

- [ ] **Step 6: End-to-end verification**
  1. Open POS — "Credit" button must appear in the payment method strip
  2. Add items, click "Charge →", select Credit, enter "Test Customer", Confirm
  3. Receipt shows "Payment: Credit (Utang)" and "Customer: Test Customer"
  4. Navigate to /accounts-receivable — the entry appears with correct amount_due and Unpaid status
  5. Summary cards reflect the correct Outstanding balance

- [ ] **Step 7: Commit**
```bash
git add app/\(dashboard\)/accounts-receivable/ components/layout/sidebar.tsx app/\(dashboard\)/pos/pos-client.tsx
git commit -m "feat: add Accounts Receivable page, Credit button to POS, and AR sidebar link"
```
