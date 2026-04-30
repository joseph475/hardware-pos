# Home Credit Installments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Home Credit as a POS payment method with optional downpayment + terms, backed by a separate `installment_plans` table, and a new `/installments` page where managers/owners can mark HC payouts as received.

**Architecture:** `payment_method` PostgreSQL enum gains a `home_credit` value; a new `installment_plans` table (one row per HC transaction) stores downpayment, HC amount, terms, and payout status. The POS payment dialog gains an HC section; a new dashboard page lists all HC transactions filterable by status.

**Tech Stack:** Next.js 16 App Router · Supabase (service-role client) · TypeScript · shadcn/ui on Base UI · Tailwind CSS v4 · Sonner toasts · Lucide icons · `lib/format.ts` for date formatting

---

## File Map

| Action | File |
|---|---|
| Create | `supabase/migrations/021_home_credit_installments.sql` |
| Modify | `types/database.ts` |
| Create | `lib/actions/installments.ts` |
| Modify | `lib/actions/transactions.ts` |
| Modify | `components/pos/payment-dialog.tsx` |
| Modify | `app/(dashboard)/pos/pos-client.tsx` |
| Create | `app/(dashboard)/installments/page.tsx` |
| Create | `app/(dashboard)/installments/loading.tsx` |
| Create | `app/(dashboard)/installments/installments-client.tsx` |
| Modify | `components/layout/sidebar.tsx` |

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/021_home_credit_installments.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- supabase/migrations/021_home_credit_installments.sql

-- Add home_credit to the payment_method enum
ALTER TYPE payment_method ADD VALUE IF NOT EXISTS 'home_credit';

-- Create installment_plans table
CREATE TABLE IF NOT EXISTS installment_plans (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  transaction_id  UUID NOT NULL UNIQUE REFERENCES transactions(id) ON DELETE CASCADE,
  downpayment     NUMERIC(14,2) NOT NULL DEFAULT 0,
  hc_amount       NUMERIC(14,2) NOT NULL,
  terms           INTEGER NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'received')),
  received_at     TIMESTAMPTZ,
  received_by     UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_installment_plans_org_id ON installment_plans(org_id);
CREATE INDEX IF NOT EXISTS idx_installment_plans_status ON installment_plans(status);
CREATE INDEX IF NOT EXISTS idx_installment_plans_transaction_id ON installment_plans(transaction_id);
```

- [ ] **Step 2: Apply the migration via Supabase MCP**

Use the `mcp__claude_ai_Supabase__apply_migration` tool with the SQL above and migration name `021_home_credit_installments`.

- [ ] **Step 3: Verify the table and enum exist**

Use `mcp__claude_ai_Supabase__execute_sql` to run:
```sql
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'installment_plans' ORDER BY ordinal_position;
```
Expected: rows for id, org_id, transaction_id, downpayment, hc_amount, terms, status, received_at, received_by, created_at.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/021_home_credit_installments.sql
git commit -m "feat: add installment_plans table and home_credit payment enum value"
```

---

## Task 2: TypeScript Types

**Files:**
- Modify: `types/database.ts`

- [ ] **Step 1: Add `home_credit` to the payment_method union**

Find every occurrence of the payment_method union type in `types/database.ts` (Row, Insert, Update for the `transactions` table — lines ~542, ~566, ~590). Add `"home_credit"` to each:

```typescript
// Before (3 places):
payment_method: "cash" | "card" | "split" | "gcash" | "maya" | "check" | "e_wallet";

// After (3 places):
payment_method: "cash" | "card" | "split" | "gcash" | "maya" | "check" | "e_wallet" | "home_credit";
```

- [ ] **Step 2: Add the `installment_plans` table type**

Find the `Tables` section in `types/database.ts`. Add after the `expenses` table entry (or before `inventory` — alphabetical doesn't matter, just keep it grouped). Insert:

```typescript
      installment_plans: {
        Row: {
          id: string;
          org_id: string;
          transaction_id: string;
          downpayment: number;
          hc_amount: number;
          terms: number;
          status: "pending" | "received";
          received_at: string | null;
          received_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          transaction_id: string;
          downpayment?: number;
          hc_amount: number;
          terms: number;
          status?: "pending" | "received";
          received_at?: string | null;
          received_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string;
          transaction_id?: string;
          downpayment?: number;
          hc_amount?: number;
          terms?: number;
          status?: "pending" | "received";
          received_at?: string | null;
          received_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
```

- [ ] **Step 3: Type-check**

```bash
cd /Users/joseph-macbookpro-m3/Documents/Apps/practice/hardware-pos && npx tsc --noEmit 2>&1 | head -30
```
Expected: no new errors related to `installment_plans` or `payment_method`.

- [ ] **Step 4: Commit**

```bash
git add types/database.ts
git commit -m "feat: add installment_plans types and home_credit payment method to database types"
```

---

## Task 3: Installments Server Action

**Files:**
- Create: `lib/actions/installments.ts`

- [ ] **Step 1: Create the server action file**

```typescript
// lib/actions/installments.ts
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

async function getProfile() {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')
  const supabase = getAdminClient()
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('clerk_user_id', userId)
    .single()
  if (error || !profile) throw new Error('Profile not found')
  return profile as { id: string; role: string }
}

export type InstallmentPlanRow = {
  id: string
  transaction_id: string
  downpayment: number
  hc_amount: number
  terms: number
  status: 'pending' | 'received'
  received_at: string | null
  created_at: string
  customer_name: string | null
  sale_total: number
  transaction_date: string
}

export async function getInstallmentPlans(filter?: 'pending' | 'received'): Promise<InstallmentPlanRow[]> {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')

  const supabase = getAdminClient()

  let query = supabase
    .from('installment_plans')
    .select('*')
    .eq('org_id', ORG_ID)
    .order('created_at', { ascending: false })

  if (filter) {
    query = query.eq('status', filter)
  }

  const { data: plans, error } = await query
  if (error) throw new Error(error.message)
  if (!plans || plans.length === 0) return []

  const transactionIds = (plans as any[]).map((p) => p.transaction_id)

  const { data: transactions } = await supabase
    .from('transactions')
    .select('id, total, created_at, customer_id')
    .in('id', transactionIds)

  const txMap = new Map<string, { total: number; created_at: string; customer_id: string | null }>()
  for (const tx of (transactions as any[]) ?? []) {
    txMap.set(tx.id, { total: tx.total, created_at: tx.created_at, customer_id: tx.customer_id })
  }

  const customerIds = [...new Set(
    (transactions as any[])?.map((t) => t.customer_id).filter(Boolean) ?? []
  )]

  const customerMap = new Map<string, string>()
  if (customerIds.length > 0) {
    const { data: customers } = await supabase
      .from('customers')
      .select('id, name')
      .in('id', customerIds)
    for (const c of (customers as any[]) ?? []) {
      customerMap.set(c.id, c.name)
    }
  }

  return (plans as any[]).map((plan) => {
    const tx = txMap.get(plan.transaction_id)
    return {
      id: plan.id,
      transaction_id: plan.transaction_id,
      downpayment: plan.downpayment,
      hc_amount: plan.hc_amount,
      terms: plan.terms,
      status: plan.status,
      received_at: plan.received_at,
      created_at: plan.created_at,
      customer_name: tx?.customer_id ? (customerMap.get(tx.customer_id) ?? null) : null,
      sale_total: tx?.total ?? 0,
      transaction_date: tx?.created_at ?? plan.created_at,
    }
  })
}

export async function markInstallmentReceived(planId: string): Promise<void> {
  const profile = await getProfile()
  if (profile.role === 'cashier') throw new Error('Unauthorized: only managers and owners can mark installments as received')

  const supabase = getAdminClient()

  const { error } = await supabase
    .from('installment_plans')
    .update({
      status: 'received',
      received_at: new Date().toISOString(),
      received_by: profile.id,
    })
    .eq('id', planId)
    .eq('org_id', ORG_ID)

  if (error) throw new Error(error.message)
  revalidatePath('/installments')
}
```

- [ ] **Step 2: Type-check**

```bash
cd /Users/joseph-macbookpro-m3/Documents/Apps/practice/hardware-pos && npx tsc --noEmit 2>&1 | head -30
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/actions/installments.ts
git commit -m "feat: add getInstallmentPlans and markInstallmentReceived server actions"
```

---

## Task 4: Extend createTransaction for Home Credit

**Files:**
- Modify: `lib/actions/transactions.ts`

- [ ] **Step 1: Add `home_credit` to the `payment_method` param type and add HC params**

In `lib/actions/transactions.ts`, find the `createTransaction` function signature (line ~67). Change the `payment_method` union to include `'home_credit'` and add three optional HC params:

```typescript
export async function createTransaction(params: {
  items: TxItem[]
  bundleItems?: TxBundleItem[]
  subtotal: number
  discount_amount: number
  tax_amount: number
  total: number
  payment_method: 'cash' | 'card' | 'split' | 'gcash' | 'maya' | 'check' | 'e_wallet' | 'home_credit'
  customer_id?: string | null
  notes?: string
  check_bank_name?: string | null
  check_date?: string | null
  check_number?: string | null
  check_name?: string | null
  check_amount?: number | null
  ewallet_provider?: string | null
  ewallet_reference?: string | null
  hc_downpayment?: number | null
  hc_terms?: number | null
  hc_amount?: number | null
}): Promise<{ id: string }> {
```

- [ ] **Step 2: Insert into `installment_plans` after the transaction insert**

In `createTransaction`, find the line after the transaction is inserted and confirmed (after `if (txError || !transaction) throw ...`, around line 159). Add the HC insert block:

```typescript
  // After: if (txError || !transaction) throw new Error(...)

  if (params.payment_method === 'home_credit' && params.hc_amount != null && params.hc_terms != null) {
    const ORG_ID = '00000000-0000-0000-0000-000000000001'
    await supabase.from('installment_plans').insert({
      org_id: ORG_ID,
      transaction_id: transaction.id,
      downpayment: params.hc_downpayment ?? 0,
      hc_amount: params.hc_amount,
      terms: params.hc_terms,
      status: 'pending',
    })
  }
```

- [ ] **Step 3: Type-check**

```bash
cd /Users/joseph-macbookpro-m3/Documents/Apps/practice/hardware-pos && npx tsc --noEmit 2>&1 | head -30
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add lib/actions/transactions.ts
git commit -m "feat: extend createTransaction to create installment_plans record for home_credit payments"
```

---

## Task 5: Payment Dialog — Home Credit UI

**Files:**
- Modify: `components/pos/payment-dialog.tsx`

- [ ] **Step 1: Add `home_credit` to the `PaymentMethod` type and add HC state**

At line 32, change:
```typescript
type PaymentMethod = "cash" | "card" | "split" | "gcash" | "maya" | "check" | "e_wallet"
```
to:
```typescript
type PaymentMethod = "cash" | "card" | "split" | "gcash" | "maya" | "check" | "e_wallet" | "home_credit"
```

After line 103 (`const [receiptOpen, setReceiptOpen] = React.useState(false)`), add HC state:
```typescript
  const [hcDownpayment, setHcDownpayment] = React.useState("")
  const [hcTerms, setHcTerms] = React.useState<number | null>(null)
```

- [ ] **Step 2: Update `paymentMethodLabel` to handle `home_credit`**

In the `paymentMethodLabel` function, add before the final `return`:
```typescript
  if (method === "home_credit") return "Home Credit"
```

- [ ] **Step 3: Add HC validation and update `canConfirm`**

After the `isEwalletValid` declaration (~line 182), add:
```typescript
  const hcDownpaymentNum = parseFloat(hcDownpayment) || 0
  const hcAmountComputed = Math.max(0, orderTotal - hcDownpaymentNum)
  const isHcValid =
    paymentMethod === "home_credit"
      ? hcTerms !== null && hcAmountComputed > 0
      : true
```

Update `canConfirm` to include Home Credit:
```typescript
  const canConfirm =
    paymentMethod === "card" ||
    (paymentMethod === "cash" && isCashValid) ||
    (paymentMethod === "split" && isSplitValid) ||
    (paymentMethod === "check" && isCheckValid) ||
    (paymentMethod === "e_wallet" && isEwalletValid) ||
    (isQrPayment && qrConfirmed) ||
    (paymentMethod === "home_credit" && isHcValid)
```

- [ ] **Step 4: Pass HC params to `createTransaction` in `handleConfirm`**

Inside `handleConfirm`, in the `createTransaction` call, add after `ewallet_reference`:
```typescript
        hc_downpayment: paymentMethod === "home_credit" ? hcDownpaymentNum : null,
        hc_terms: paymentMethod === "home_credit" ? hcTerms : null,
        hc_amount: paymentMethod === "home_credit" ? hcAmountComputed : null,
```

- [ ] **Step 5: Reset HC state in `handleOpenChange`**

Inside `handleOpenChange`, in the `if (!value)` block, add:
```typescript
        setHcDownpayment("")
        setHcTerms(null)
```

- [ ] **Step 6: Add the Home Credit UI section in the dialog JSX**

After the Check payment block (after the closing `}` of `{paymentMethod === "check" && (...)}`, before `<DialogFooter>`), add:

```tsx
        {/* Home Credit payment */}
        {paymentMethod === "home_credit" && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="hc-downpayment">
                Downpayment <span className="text-muted-foreground text-xs">(optional)</span>
              </Label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-sm text-muted-foreground">
                  {currencySymbol}
                </span>
                <Input
                  id="hc-downpayment"
                  type="number"
                  min={0}
                  max={orderTotal}
                  step="0.01"
                  placeholder="0.00"
                  value={hcDownpayment}
                  onChange={(e) => setHcDownpayment(e.target.value)}
                  className="pl-6"
                  autoFocus
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Leave blank if fully financed by Home Credit.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>Terms <span className="text-destructive">*</span></Label>
              <div className="flex gap-2 flex-wrap">
                {[3, 6, 12, 18, 24].map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setHcTerms(t)}
                    className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
                      hcTerms === t
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background text-foreground hover:bg-muted"
                    }`}
                  >
                    {t} mos
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-lg bg-muted/50 p-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Downpayment collected now</span>
                <span className="font-medium">{formatCurrency(hcDownpaymentNum)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">HC amount (awaiting payout)</span>
                <span className="font-medium">{formatCurrency(hcAmountComputed)}</span>
              </div>
            </div>
          </div>
        )}
```

- [ ] **Step 7: Type-check**

```bash
cd /Users/joseph-macbookpro-m3/Documents/Apps/practice/hardware-pos && npx tsc --noEmit 2>&1 | head -30
```
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add components/pos/payment-dialog.tsx
git commit -m "feat: add Home Credit payment method to payment dialog with downpayment and terms fields"
```

---

## Task 6: POS Client — Add Home Credit Button

**Files:**
- Modify: `app/(dashboard)/pos/pos-client.tsx`

- [ ] **Step 1: Add `home_credit` to the `PaymentMethod` type**

At line 42, change:
```typescript
type PaymentMethod = "cash" | "card" | "split" | "gcash" | "maya" | "check" | "e_wallet"
```
to:
```typescript
type PaymentMethod = "cash" | "card" | "split" | "gcash" | "maya" | "check" | "e_wallet" | "home_credit"
```

- [ ] **Step 2: Add Home Credit to the `paymentMethods` array**

`CreditCard` is already imported at line 11. In the `paymentMethods` array (line ~407), add Home Credit after the `check` entry and before the GCash/Maya spread:

```typescript
  const paymentMethods: { value: PaymentMethod; label: string; icon: React.ReactNode }[] = [
    { value: "cash", label: "Cash", icon: <Banknote className="h-4 w-4" /> },
    { value: "card", label: "Card", icon: <CreditCard className="h-4 w-4" /> },
    { value: "e_wallet", label: "E-Wallet", icon: <Wallet className="h-4 w-4" /> },
    { value: "check", label: "Check", icon: <CheckSquare className="h-4 w-4" /> },
    { value: "home_credit", label: "Home Credit", icon: <CreditCard className="h-4 w-4" /> },
    { value: "split", label: "Split", icon: <SplitSquareHorizontal className="h-4 w-4" /> },
    ...(gcashQrUrl ? [{ value: "gcash" as const, label: "GCash", icon: <Smartphone className="h-4 w-4" /> }] : []),
    ...(mayaQrUrl ? [{ value: "maya" as const, label: "Maya", icon: <Smartphone className="h-4 w-4" /> }] : []),
  ]
```

- [ ] **Step 3: Type-check**

```bash
cd /Users/joseph-macbookpro-m3/Documents/Apps/practice/hardware-pos && npx tsc --noEmit 2>&1 | head -30
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add "app/(dashboard)/pos/pos-client.tsx"
git commit -m "feat: add Home Credit button to POS payment method selector"
```

---

## Task 7: Installments Page

**Files:**
- Create: `app/(dashboard)/installments/page.tsx`
- Create: `app/(dashboard)/installments/loading.tsx`
- Create: `app/(dashboard)/installments/installments-client.tsx`

- [ ] **Step 1: Create the server page component**

```typescript
// app/(dashboard)/installments/page.tsx
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { getInstallmentPlans } from '@/lib/actions/installments'
import { InstallmentsClient } from './installments-client'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

export const dynamic = 'force-dynamic'

export default async function InstallmentsPage() {
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
  const plans = await getInstallmentPlans()

  return <InstallmentsClient initialPlans={plans} userRole={role} />
}
```

- [ ] **Step 2: Create the loading skeleton**

```typescript
// app/(dashboard)/installments/loading.tsx
import { Skeleton } from "@/components/ui/skeleton"

export default function InstallmentsLoading() {
  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div className="space-y-1.5">
          <Skeleton className="h-6 w-44" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-7 w-36 rounded-full" />
          <Skeleton className="h-7 w-36 rounded-full" />
        </div>
      </div>

      <div className="flex gap-3">
        <Skeleton className="h-9 flex-1 max-w-sm" />
        <Skeleton className="h-9 w-16" />
        <Skeleton className="h-9 w-20" />
        <Skeleton className="h-9 w-20" />
      </div>

      <div className="rounded-xl border border-border overflow-hidden">
        <div className="flex gap-4 px-4 py-3 border-b border-border bg-muted/40">
          {["w-24", "w-32", "w-20", "w-24", "w-24", "w-16", "w-20", "w-20"].map((w, i) => (
            <Skeleton key={i} className={`h-4 ${w}`} />
          ))}
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-border/50 last:border-0">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-20 ml-auto" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-8 w-28 rounded-md" />
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create the client component**

```typescript
// app/(dashboard)/installments/installments-client.tsx
"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Search, CreditCard } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { markInstallmentReceived, type InstallmentPlanRow } from "@/lib/actions/installments"
import { useCurrency } from "@/lib/context/currency"
import { formatDate } from "@/lib/format"

interface InstallmentsClientProps {
  initialPlans: InstallmentPlanRow[]
  userRole: string
}

export function InstallmentsClient({ initialPlans, userRole }: InstallmentsClientProps) {
  const router = useRouter()
  const { formatCurrency } = useCurrency()
  const [filter, setFilter] = React.useState<"all" | "pending" | "received">("all")
  const [search, setSearch] = React.useState("")
  const [isPending, startTransition] = React.useTransition()

  const canMarkReceived = userRole === "manager" || userRole === "owner"

  const filtered = initialPlans.filter((plan) => {
    if (filter !== "all" && plan.status !== filter) return false
    if (search.trim()) {
      const q = search.toLowerCase()
      const customerMatch = plan.customer_name?.toLowerCase().includes(q) ?? false
      if (!customerMatch) return false
    }
    return true
  })

  const pendingPlans = initialPlans.filter((p) => p.status === "pending")
  const receivedPlans = initialPlans.filter((p) => p.status === "received")
  const pendingTotal = pendingPlans.reduce((s, p) => s + p.hc_amount, 0)
  const receivedTotal = receivedPlans.reduce((s, p) => s + p.hc_amount, 0)

  function handleMarkReceived(planId: string) {
    startTransition(async () => {
      try {
        await markInstallmentReceived(planId)
        toast.success("Marked as received")
        router.refresh()
      } catch (err) {
        toast.error("Failed to update", {
          description: err instanceof Error ? err.message : "Something went wrong",
        })
      }
    })
  }

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Home Credit Installments</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Track HC payout status for all installment sales
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Badge className="rounded-full px-3 py-1 text-xs font-semibold bg-yellow-500/10 text-yellow-700 border-yellow-300 dark:text-yellow-400 dark:border-yellow-600">
            {pendingPlans.length} Pending · {formatCurrency(pendingTotal)}
          </Badge>
          <Badge className="rounded-full px-3 py-1 text-xs font-semibold bg-green-500/10 text-green-700 border-green-300 dark:text-green-400 dark:border-green-600">
            {receivedPlans.length} Received · {formatCurrency(receivedTotal)}
          </Badge>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 items-center flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search customer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9"
          />
        </div>
        {(["all", "pending", "received"] as const).map((f) => (
          <Button
            key={f}
            size="sm"
            variant={filter === f ? "default" : "outline"}
            onClick={() => setFilter(f)}
            className="capitalize h-9"
          >
            {f}
          </Button>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead>Date</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead className="text-right">Sale Total</TableHead>
              <TableHead className="text-right">Downpayment</TableHead>
              <TableHead className="text-right">HC Amount</TableHead>
              <TableHead className="text-center">Terms</TableHead>
              <TableHead className="text-center">Status</TableHead>
              {canMarkReceived && <TableHead className="text-center">Action</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={canMarkReceived ? 8 : 7} className="py-16 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <CreditCard className="h-8 w-8 opacity-30" />
                    <p className="text-sm">No installment records found</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((plan) => (
                <TableRow key={plan.id}>
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                    {formatDate(plan.transaction_date)}
                  </TableCell>
                  <TableCell className="text-sm font-medium">
                    {plan.customer_name ?? (
                      <span className="text-muted-foreground italic">No customer</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {formatCurrency(plan.sale_total)}
                  </TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">
                    {plan.downpayment > 0 ? formatCurrency(plan.downpayment) : "—"}
                  </TableCell>
                  <TableCell className="text-right text-sm font-semibold">
                    {formatCurrency(plan.hc_amount)}
                  </TableCell>
                  <TableCell className="text-center text-sm text-muted-foreground">
                    {plan.terms} mos
                  </TableCell>
                  <TableCell className="text-center">
                    {plan.status === "pending" ? (
                      <Badge className="rounded-full text-xs bg-yellow-500/10 text-yellow-700 border-yellow-300 dark:text-yellow-400 dark:border-yellow-600">
                        Pending
                      </Badge>
                    ) : (
                      <div className="flex flex-col items-center gap-0.5">
                        <Badge className="rounded-full text-xs bg-green-500/10 text-green-700 border-green-300 dark:text-green-400 dark:border-green-600">
                          Received
                        </Badge>
                        {plan.received_at && (
                          <span className="text-[11px] text-muted-foreground">
                            {formatDate(plan.received_at)}
                          </span>
                        )}
                      </div>
                    )}
                  </TableCell>
                  {canMarkReceived && (
                    <TableCell className="text-center">
                      {plan.status === "pending" ? (
                        <Button
                          size="sm"
                          variant="default"
                          className="h-7 text-xs"
                          disabled={isPending}
                          onClick={() => handleMarkReceived(plan.id)}
                        >
                          Mark Received
                        </Button>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Type-check**

```bash
cd /Users/joseph-macbookpro-m3/Documents/Apps/practice/hardware-pos && npx tsc --noEmit 2>&1 | head -30
```
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add "app/(dashboard)/installments/"
git commit -m "feat: add installments tracking page with status filter and mark received action"
```

---

## Task 8: Sidebar Navigation

**Files:**
- Modify: `components/layout/sidebar.tsx`

- [ ] **Step 1: Add Installments nav entry**

`CreditCard` is already imported at line 11 in `pos-client.tsx` but NOT in `sidebar.tsx`. In `sidebar.tsx`, add `CreditCard` to the existing import from `lucide-react` (line ~6):

```typescript
// Find the lucide-react import block and add CreditCard
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  BarChart3,
  SlidersHorizontal,
  ArrowLeftRight,
  Truck,
  ClipboardList,
  TrendingUp,
  Building2,
  Users,
  Tag,
  ChevronDown,
  Store,
  Settings2,
  History,
  FileBarChart2,
  Users2,
  PackageSearch,
  Layers,
  Receipt,
  CreditCard,        // add this
} from "lucide-react";
```

- [ ] **Step 2: Add the Installments entry to `NAV_ENTRIES`**

In the `NAV_ENTRIES` array, add after the `Expenses` entry (after line ~93):

```typescript
  {
    type: "link",
    label: "Installments",
    href: "/installments",
    icon: CreditCard,
    roles: ["owner", "manager", "cashier"],
  },
```

- [ ] **Step 3: Type-check**

```bash
cd /Users/joseph-macbookpro-m3/Documents/Apps/practice/hardware-pos && npx tsc --noEmit 2>&1 | head -30
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add components/layout/sidebar.tsx
git commit -m "feat: add Installments nav item to sidebar"
```

---

## Task 9: End-to-End Verification

- [ ] **Step 1: Start the dev server**

```bash
cd /Users/joseph-macbookpro-m3/Documents/Apps/practice/hardware-pos && npm run dev
```

- [ ] **Step 2: Test HC payment at POS**

1. Open the POS page.
2. Add any product to cart.
3. Click the **Home Credit** button — verify it appears alongside Cash, Card, etc.
4. In the payment dialog, verify the HC section appears with a downpayment input and terms chips.
5. Enter a downpayment (e.g. ₱500) and select 12 months.
6. Verify the summary shows downpayment + HC amount = total.
7. Confirm the sale. Verify the transaction completes and the receipt shows.

- [ ] **Step 3: Test fully-financed HC (no downpayment)**

1. Add a product, select Home Credit, leave downpayment blank, pick 6 months.
2. Verify HC amount = full total.
3. Confirm the sale.

- [ ] **Step 4: Verify installment_plans row was created**

Use Supabase MCP: `mcp__claude_ai_Supabase__execute_sql`
```sql
SELECT * FROM installment_plans ORDER BY created_at DESC LIMIT 3;
```
Expected: rows for the two sales above with status = 'pending'.

- [ ] **Step 5: Test the Installments page**

1. Navigate to `/installments` — verify the page loads with both pending rows.
2. Verify summary chips show correct counts and HC amounts.
3. Test search by customer name (if customer was linked).
4. Test filter buttons: Pending / Received / All.

- [ ] **Step 6: Test Mark Received (manager/owner)**

1. As manager or owner, click **Mark Received** on a pending row.
2. Verify the row changes to "Received" with today's date.
3. Verify the summary chips update.

- [ ] **Step 7: Test cashier restriction**

1. Log in as cashier.
2. Navigate to `/installments` — verify the page loads and shows the list.
3. Verify the **Mark Received** button/column is absent.
