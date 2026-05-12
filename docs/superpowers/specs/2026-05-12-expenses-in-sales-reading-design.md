# Expenses in Sales Reading — Design Spec

**Date:** 2026-05-12
**Feature:** Show Total Sales, Less: Expenses, and Cash on Hand in the X/Z Reading report

---

## Overview

Integrate the existing `expenses` table into the Sales Reading report (X-reading and Z-reading) so managers can see net Cash on Hand after deducting expenses from total revenue.

---

## Data Layer

**File:** `lib/actions/reports.ts` — `getSalesReading`

Add `expensesTotal: number` to `SalesReadingData`:

```ts
export type SalesReadingData = {
  // ...existing fields...
  expensesTotal: number
}
```

Inside `getSalesReading`, after the transaction query, add an expenses query:

- **Z-reading (all-time):** no date filter — sum all `expenses.amount` where `org_id = ORG_ID`
- **X-reading (date range):** filter `expenses.date >= date_from` and `expenses.date <= date_to`, then sum amounts

`cashOnHand` is computed client-side as `totalRevenue - expensesTotal` — not stored in the return type.

---

## UI Changes

**File:** `app/(dashboard)/reports/z-report/z-report-client.tsx`

### 1. Cash Summary Card (new)

Positioned between the stat cards and the existing summary table. Styled like a receipt ledger:

```
Total Sales (Revenue)    ₱ XX,XXX.XX
Less: Expenses         − ₱  X,XXX.XX
─────────────────────────────────────
Cash on Hand             ₱ XX,XXX.XX
```

- Cash on Hand label and value are bold and slightly larger
- If `cashOnHand` is negative, render the value in `text-destructive` (red)

### 2. Summary Table Rows (added)

After the existing "Total Revenue" row, add:
- `Less: Expenses` → `− formatCurrency(expensesTotal)`
- `Cash on Hand` → `formatCurrency(cashOnHand)` with bold font weight and a top border/separator

### 3. Print Output (`PrintContent`)

After the existing summary rows in the print template, add:
- `Less: Expenses` row with right-aligned amount
- `Cash on Hand` row with right-aligned bold amount

No individual expense line items in print — totals only.

---

## Data Flow

No changes to `page.tsx` or component props are required. Because `expensesTotal` is returned as part of `SalesReadingData`, all existing data flows work automatically:

- **Initial load:** `page.tsx` calls `getSalesReading` server-side → `initialData` includes `expensesTotal`
- **Mode switch / date change:** `fetchData()` in the client calls `getSalesReading` → `setData(readingResult)` updates the whole state including `expensesTotal`

---

## Scope

- No new routes, pages, or migrations required
- No changes to the Expenses CRUD page
- No changes to `page.tsx` or client component props
- The `cashOnHand` value is always derived — never stored

---

## Files to Change

| File | Change |
|------|--------|
| `lib/actions/reports.ts` | Add `expensesTotal` to `SalesReadingData` type and query in `getSalesReading` |
| `app/(dashboard)/reports/z-report/z-report-client.tsx` | Add cash summary card, two summary table rows, two print rows |
