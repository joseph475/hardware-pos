# POS Receipt Printing — Design Spec

**Date:** 2026-03-22
**Status:** Approved

---

## Overview

After a cashier confirms payment at the POS, a thermal-style receipt automatically triggers `window.print()`. No extra clicks required. The receipt renders into `document.body` via a React portal; `@media print` CSS ensures only the receipt is visible when printing. This works with 80mm thermal POS printers and regular printers alike.

---

## Approach

**Portal + `window.print()` + CSS `@media print`** (no new dependencies)

- After `createTransaction` resolves successfully, receipt data is assembled from existing in-scope state (cart, user profile, currency context) plus the returned transaction ID.
- A `<ReceiptPrint>` component portals a `<div id="pos-receipt">` into `document.body`. It is purely presentational — it never calls `window.print()`.
- `window.print()` is called from a `useEffect` inside `PaymentDialog`, watching `receiptData`.
- `@media print` hides all body children except `#pos-receipt` using `body > *:not(#pos-receipt) { display: none !important }`. In normal view `#pos-receipt` is `display: none`.

---

## Files Changed

### 1. `lib/actions/transactions.ts`

**Change:** `createTransaction` return type from `Promise<void>` to `Promise<{ id: string }>`.

All existing `throw` paths remain unchanged — the function still throws on any error. Only the happy-path ending changes: return `{ id: transaction.id }` after all inventory mutations complete.

```ts
export async function createTransaction(params: { ... }): Promise<{ id: string }> {
  // ... all existing logic unchanged, including all throw paths ...
  // At the very end, after inventory mutations:
  revalidateTag(CACHE_TAGS.INVENTORY, {})
  revalidateTag(CACHE_TAGS.INVENTORY_MOVEMENTS, {})
  revalidatePath('/inventory')
  revalidatePath('/inventory/adjustments')
  return { id: transaction.id }
}
```

No other logic changes. Callers that previously `await`ed without using the return value (none currently exist besides `PaymentDialog`) are unaffected.

---

### 2. `app/globals.css`

Add at the end of the file:

```css
/* ── Receipt print ─────────────────────────────────────────── */
#pos-receipt {
  display: none;
}

@media print {
  body > *:not(#pos-receipt) {
    display: none !important;
  }
  #pos-receipt {
    display: block !important;
    font-family: 'Courier New', Courier, monospace;
    font-size: 12px;
    line-height: 1.4;
    color: #000;
    background: #fff;
    width: 100%;
    max-width: 300px;  /* ~80mm at screen DPI */
    margin: 0 auto;
    padding: 8px 0;
  }
}
```

The selector `body > *:not(#pos-receipt)` applies `display: none !important` to all direct body children (Next.js root div, Clerk overlays, Sonner toaster, any portalled modals) to ensure only the receipt prints.

---

### 3. `components/pos/receipt-print.tsx` (new file)

A `'use client'` component. Purely presentational — renders the receipt HTML, never triggers printing.

**SSR guard:** Use a `mounted` state (not `typeof document`) to avoid hydration mismatch:

```ts
const [mounted, setMounted] = React.useState(false)
React.useEffect(() => { setMounted(true) }, [])
if (!mounted) return null
```

**`ReceiptData` interface (exported):**

```ts
export interface ReceiptData {
  transactionId: string        // full UUID — display first 8 chars uppercase, e.g. "A1B2C3D4"
  timestamp: Date              // Date object captured at time of confirmation
  branchName: string           // branch.name, fallback: 'Store'
  branchAddress: string | null // branch.address, omit row if null
  branchPhone: string | null   // branch.phone, omit row if null
  cashierName: string          // profile.full_name, fallback: 'Cashier'
  items: Array<{
    name: string               // product name, truncate to 22 chars with '…' if longer
    qty: number
    unitPrice: number
    discountAmount: number     // per-item discount already factored into lineTotal
    lineTotal: number          // unit_price * qty - discountAmount
  }>
  subtotal: number             // pre-discount, pre-tax total
  discountAmount: number       // order-level discount (sum of per-item discounts)
  taxAmount: number            // pre-computed from cart.tax()
  taxRate: number              // from useCurrency().taxRate, e.g. 0.12 → display "12%"
  total: number                // final amount charged
  paymentMethod: 'cash' | 'card' | 'split'
  cashTendered?: number        // only present for paymentMethod === 'cash'
  change?: number              // cashTendered - total, only for cash
  splitCash?: number           // only present for paymentMethod === 'split'
  splitCard?: number           // only present for paymentMethod === 'split'
  formatCurrency: (n: number) => string
}
```

**Receipt layout (~42 chars wide, monospace):**

```
========================================
          BRANCH NAME HERE
     123 Main Street, Downtown
         +1-555-0100
========================================
Date: 2026-03-22      Time: 14:30:05
Receipt #: A1B2C3D4
Cashier: John Doe
----------------------------------------
Item                    Qty      Total
----------------------------------------
Widget A                  2      20.00
  (Discount: -2.00)
Short Name                1       5.00
----------------------------------------
Subtotal:                        23.00
Discount:                        -2.00
Tax (12%):                        2.52
----------------------------------------
TOTAL:                           23.52
========================================
Payment: Cash
Tendered:                        30.00
Change:                           6.48
========================================
     Thank you for your purchase!
========================================
```

**Rendering rules:**

- `=` rows: full-width `========...`
- `-` rows: full-width `--------...`
- Item name: truncated to 22 chars with `…` if longer
- Per-item discount row: shown (indented `  (Discount: -X.XX)`) only when `item.discountAmount > 0`
- Order discount row: shown only when `discountAmount > 0`
- Tax display: `Math.round(taxRate * 10000) / 100` → e.g. `12%`
- Tax amount: use the pre-computed `taxAmount` value from `ReceiptData`, not re-derived
- Timestamp: `timestamp.toLocaleDateString()` for date, `timestamp.toLocaleTimeString()` for time
- Transaction short ID: `transactionId.slice(0, 8).toUpperCase()`
- Payment section:
  - Cash: show `Tendered` and `Change` rows
  - Card: no extra rows
  - Split: show `Cash: X.XX` and `Card: X.XX` rows
- Branch address row: omit entirely if `branchAddress` is null
- Branch phone row: omit entirely if `branchPhone` is null
- Null branch fallback: `branchName = 'Store'`
- Null profile fallback: `cashierName = 'Cashier'`

---

### 4. `components/pos/payment-dialog.tsx`

**New imports:**

```ts
import { useUserProfile } from '@/lib/context/user-profile'
import { ReceiptPrint, type ReceiptData } from '@/components/pos/receipt-print'
```

**New state:**

```ts
const { profile, branch } = useUserProfile()
const [receiptData, setReceiptData] = React.useState<ReceiptData | null>(null)
```

**`useEffect` for auto-print (in `PaymentDialog` component body):**

```ts
React.useEffect(() => {
  if (receiptData) {
    // Small delay ensures the portal has painted before the print dialog opens
    const t = setTimeout(() => window.print(), 0)
    return () => clearTimeout(t)
  }
}, [receiptData])
```

`window.print()` lives here only — `ReceiptPrint` is purely presentational.

**`handleConfirm` call sequence (exact order):**

```ts
async function handleConfirm() {
  if (!canConfirm) return
  setIsProcessing(true)
  try {
    // 1. Create transaction (now returns { id })
    const result = await createTransaction({ items: items.map(...), subtotal, ... })

    // 2. Build receipt data BEFORE clearing cart (cart state is still intact here)
    setReceiptData({
      transactionId: result.id,
      timestamp: new Date(),
      branchName: branch?.name ?? 'Store',
      branchAddress: branch?.address ?? null,
      branchPhone: branch?.phone ?? null,
      cashierName: profile?.full_name ?? 'Cashier',
      items: items.map(i => ({
        name: i.product.name,
        qty: i.quantity,
        unitPrice: i.unit_price,
        discountAmount: i.discount_amount,
        lineTotal: i.unit_price * i.quantity - i.discount_amount,
      })),
      subtotal: orderSubtotal,
      discountAmount: orderDiscount,
      taxAmount: orderTax,
      taxRate,
      total: orderTotal,
      paymentMethod,
      cashTendered: paymentMethod === 'cash' ? cashTenderedNum : undefined,
      change: paymentMethod === 'cash' ? change : undefined,
      splitCash: paymentMethod === 'split' ? splitCashNum : undefined,
      splitCard: paymentMethod === 'split' ? splitCardNum : undefined,
      formatCurrency,
    })

    // 3. Clear cart AFTER capturing receipt data
    clearCart()

    // 4. Close dialog and reset inputs
    onOpenChange(false)
    setCashTendered('')
    setSplitCash('')
    setSplitCard('')

    // 5. Show success toast
    toast.success('Transaction completed', {
      description: `${itemCount} item${itemCount !== 1 ? 's' : ''} — ${formatCurrency(orderTotal)}`,
    })
  } catch (err) {
    toast.error('Transaction failed', {
      description: err instanceof Error ? err.message : 'Something went wrong',
    })
  } finally {
    setIsProcessing(false)
  }
}
```

**`receiptData` lifecycle:**

- Set after successful `createTransaction`
- `window.print()` fires via `useEffect` — browser opens print dialog; app UI is already closed/reset
- `receiptData` is NOT cleared on dialog close (the dialog closes before print dialog appears; clearing it would unmount the portal before printing)
- `receiptData` is cleared when the dialog re-opens for the next transaction — add to `handleOpenChange`:
  ```ts
  function handleOpenChange(value: boolean) {
    if (!isProcessing) {
      if (value) {
        // Opening fresh — clear any previous receipt
        setReceiptData(null)
      }
      if (!value) {
        setCashTendered('')
        setSplitCash('')
        setSplitCard('')
      }
      onOpenChange(value)
    }
  }
  ```

**Render (at bottom of JSX return):**

```tsx
{receiptData && <ReceiptPrint data={receiptData} />}
```

---

## Data Sources (no extra fetches)

| Receipt Field | Source |
|---|---|
| Branch name, address, phone | `useUserProfile().branch` |
| Cashier name | `useUserProfile().profile?.full_name` |
| Transaction ID | returned from modified `createTransaction` |
| Timestamp | `new Date()` at time of confirmation |
| Items | cart `items` array (captured before `clearCart()`) |
| Subtotal, discount, tax, total | computed cart values already in `PaymentDialog` |
| Tax amount | `orderTax` (pre-computed via `cart.tax()`) |
| Tax rate (for display) | `useCurrency().taxRate` |
| Currency formatter | `useCurrency().formatCurrency` |

---

## Out of Scope

- Email / SMS receipt delivery
- PDF download
- Receipt logo / image
- Org name in header (branch name is sufficient; org name not in any client context)
- Configurable receipt footer message
- Sequential receipt numbering (UUID short ID is used)

---

## Testing Notes

- `window.print()` fires only after a successful transaction, not on cancel or error
- `receiptData` is cleared when dialog re-opens (not on close), so the portal stays mounted through the print dialog lifecycle
- Cash: tendered and change rows appear; split: cash + card rows appear; card: no extra rows
- Print preview shows only the receipt with no app chrome, dialog, toasts, or Clerk overlays
- Items with `discountAmount > 0` show the indented discount line
- SSR renders nothing (component returns null until `mounted === true`)
