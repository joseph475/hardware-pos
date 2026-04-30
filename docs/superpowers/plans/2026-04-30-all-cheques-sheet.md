# All Cheques Sheet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "View All Cheques" side sheet to the Purchase Orders page that lists every cheque across all POs sorted by date, with click-through to manage each PO's cheques.

**Architecture:** A new `getAllCheques()` server action fetches all cheques joined with PO + supplier info. A new `AllChequesSheet` component renders a side sheet with a table; clicking a row opens the existing `ChequeDetailsDialog`. The sheet is triggered by a button in the `OrdersClient` header.

**Tech Stack:** Next.js App Router, React, Supabase (service role), shadcn/ui Sheet, `@base-ui/react`, Tailwind CSS v4, `lib/format.ts` for date/number formatting.

---

### Task 1: Add `getAllCheques()` server action

**Files:**
- Modify: `lib/actions/purchasing.ts`

- [ ] **Step 1: Add the `ChequeWithPO` export type** after the existing `PurchaseOrderCheque` import at the top of the cheque section (around line 456).

  Append this type to the end of `lib/actions/purchasing.ts`:

  ```ts
  export type ChequeWithPO = {
    id: string
    check_name: string
    check_number: string
    check_date: string
    amount: number
    po_id: string
    po_total: number
    supplier_name: string
  }
  ```

- [ ] **Step 2: Add the `getAllCheques()` function** immediately after the type above:

  ```ts
  export async function getAllCheques(): Promise<ChequeWithPO[]> {
    const { userId } = await auth()
    if (!userId) throw new Error('Unauthorized')

    const supabase = getAdminClient()
    const { data, error } = await supabase
      .from('purchase_order_cheques')
      .select('*, po:purchase_orders!po_id(id, total, supplier:suppliers!supplier_id(name))')
      .order('check_date', { ascending: false })

    if (error) throw new Error(error.message)

    return ((data ?? []) as any[]).map((c: any) => ({
      id: c.id,
      check_name: c.check_name,
      check_number: c.check_number,
      check_date: c.check_date,
      amount: Number(c.amount),
      po_id: c.po_id,
      po_total: Number(c.po?.total ?? 0),
      supplier_name: c.po?.supplier?.name ?? 'Unknown',
    }))
  }
  ```

- [ ] **Step 3: Verify TypeScript compiles**

  ```bash
  cd /Users/joseph-macbookpro-m3/Documents/Apps/practice/hardware-pos && npx tsc --noEmit 2>&1 | head -20
  ```

  Expected: no errors related to `purchasing.ts`.

- [ ] **Step 4: Commit**

  ```bash
  git add lib/actions/purchasing.ts
  git commit -m "feat: add getAllCheques server action"
  ```

---

### Task 2: Create `AllChequesSheet` component

**Files:**
- Create: `components/purchasing/all-cheques-sheet.tsx`

- [ ] **Step 1: Create the file** at `components/purchasing/all-cheques-sheet.tsx`:

  ```tsx
  "use client"

  import * as React from "react"
  import { Banknote } from "lucide-react"
  import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
  } from "@/components/ui/sheet"
  import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
  } from "@/components/ui/table"
  import { Button } from "@/components/ui/button"
  import { formatDate, formatNumber } from "@/lib/format"
  import { getAllCheques } from "@/lib/actions/purchasing"
  import { ChequeDetailsDialog } from "@/components/purchasing/cheque-details-dialog"
  import type { ChequeWithPO, POWithRelations } from "@/lib/actions/purchasing"

  interface Props {
    fullOrders: POWithRelations[]
  }

  export function AllChequesSheet({ fullOrders }: Props) {
    const [open, setOpen] = React.useState(false)
    const [cheques, setCheques] = React.useState<ChequeWithPO[]>([])
    const [chequePO, setChequePO] = React.useState<{ id: string; total: number } | null>(null)

    async function fetchCheques() {
      const data = await getAllCheques()
      setCheques(data)
    }

    React.useEffect(() => {
      if (open) fetchCheques()
    }, [open])

    function handleRowClick(cheque: ChequeWithPO) {
      setChequePO({ id: cheque.po_id, total: cheque.po_total })
    }

    function handleDialogClose(v: boolean) {
      if (!v) {
        setChequePO(null)
        fetchCheques()
      }
    }

    return (
      <>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger render={<Button variant="outline" />} nativeButton={true}>
            <Banknote className="size-4 mr-2" />
            View All Cheques
          </SheetTrigger>
          <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
            <SheetHeader>
              <SheetTitle>All Cheques</SheetTitle>
            </SheetHeader>

            {cheques.length === 0 ? (
              <p className="text-sm text-muted-foreground mt-4">No cheques recorded yet.</p>
            ) : (
              <div className="mt-4 border rounded-md overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-border hover:bg-transparent">
                      <TableHead className="pl-4">Date</TableHead>
                      <TableHead>Payee</TableHead>
                      <TableHead>Check #</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="pr-4">PO</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cheques.map((c) => (
                      <TableRow
                        key={c.id}
                        className="border-b border-border/50 cursor-pointer hover:bg-muted/40"
                        onClick={() => handleRowClick(c)}
                      >
                        <TableCell className="pl-4 tabular-nums text-sm">
                          {formatDate(c.check_date)}
                        </TableCell>
                        <TableCell className="text-sm">{c.check_name}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {c.check_number}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm tabular-nums">
                          {formatNumber(c.amount)}
                        </TableCell>
                        <TableCell className="pr-4 text-xs text-muted-foreground">
                          <span className="font-mono">{c.po_id.slice(0, 8).toUpperCase()}</span>
                          <span className="ml-1 text-muted-foreground/70">· {c.supplier_name}</span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            <p className="text-xs text-muted-foreground mt-3 text-right">
              {cheques.length} cheque{cheques.length !== 1 ? "s" : ""}
            </p>
          </SheetContent>
        </Sheet>

        <ChequeDetailsDialog
          po={chequePO}
          open={!!chequePO}
          onOpenChange={handleDialogClose}
        />
      </>
    )
  }
  ```

- [ ] **Step 2: Verify TypeScript compiles**

  ```bash
  cd /Users/joseph-macbookpro-m3/Documents/Apps/practice/hardware-pos && npx tsc --noEmit 2>&1 | head -20
  ```

  Expected: no new errors.

- [ ] **Step 3: Commit**

  ```bash
  git add components/purchasing/all-cheques-sheet.tsx
  git commit -m "feat: add AllChequesSheet component"
  ```

---

### Task 3: Wire button into OrdersClient

**Files:**
- Modify: `app/(dashboard)/purchasing/orders/orders-client.tsx`

- [ ] **Step 1: Add the import** for `AllChequesSheet`. In `orders-client.tsx`, add after the existing `ChequeDetailsDialog` import (line 36):

  ```tsx
  import { AllChequesSheet } from "@/components/purchasing/all-cheques-sheet"
  ```

- [ ] **Step 2: Add the sheet to the header**. The header `div` currently looks like this (lines 130–157):

  ```tsx
  {/* Header */}
  <div className="flex items-center justify-between">
    <div>
      <h1 className="text-xl font-semibold text-foreground">Purchase Orders</h1>
      <p className="text-sm text-muted-foreground mt-0.5">
        Track orders from your suppliers
      </p>
    </div>
    {!isMainBranch && (
      <a
        href="/purchasing/branch-requests"
        className="text-sm text-muted-foreground underline"
      >
        Use Stock Requests instead
      </a>
    )}
    {isMainBranch && (
      <NewPOSheet
        suppliers={suppliers}
        branches={branches}
        products={products}
        productSupplierCosts={productSupplierCosts}
        userBranchId={userBranchId}
        userRole={userRole}
        onSuccess={() => {}}
        editingPO={editingPO}
        onEditClose={() => setEditingPO(null)}
      />
    )}
  </div>
  ```

  Replace it with:

  ```tsx
  {/* Header */}
  <div className="flex items-center justify-between">
    <div>
      <h1 className="text-xl font-semibold text-foreground">Purchase Orders</h1>
      <p className="text-sm text-muted-foreground mt-0.5">
        Track orders from your suppliers
      </p>
    </div>
    <div className="flex items-center gap-2">
      <AllChequesSheet fullOrders={fullOrders} />
      {!isMainBranch && (
        <a
          href="/purchasing/branch-requests"
          className="text-sm text-muted-foreground underline"
        >
          Use Stock Requests instead
        </a>
      )}
      {isMainBranch && (
        <NewPOSheet
          suppliers={suppliers}
          branches={branches}
          products={products}
          productSupplierCosts={productSupplierCosts}
          userBranchId={userBranchId}
          userRole={userRole}
          onSuccess={() => {}}
          editingPO={editingPO}
          onEditClose={() => setEditingPO(null)}
        />
      )}
    </div>
  </div>
  ```

- [ ] **Step 3: Verify TypeScript compiles**

  ```bash
  cd /Users/joseph-macbookpro-m3/Documents/Apps/practice/hardware-pos && npx tsc --noEmit 2>&1 | head -20
  ```

  Expected: no errors.

- [ ] **Step 4: Manual smoke test**
  - Start dev server: `npm run dev`
  - Navigate to `/purchasing/orders`
  - Confirm "View All Cheques" button appears in the top-right header
  - Click it — sheet opens listing all cheques sorted by date (latest first)
  - Click a cheque row — `ChequeDetailsDialog` opens for that PO
  - Add or edit a cheque in the dialog, then close it — sheet list refreshes
  - Confirm empty state ("No cheques recorded yet.") if no cheques exist

- [ ] **Step 5: Commit**

  ```bash
  git add app/(dashboard)/purchasing/orders/orders-client.tsx
  git commit -m "feat: wire AllChequesSheet into Purchase Orders page header"
  ```
