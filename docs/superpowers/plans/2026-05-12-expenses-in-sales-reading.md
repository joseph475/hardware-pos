# Expenses in Sales Reading — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show Total Sales, Less: Expenses, and Cash on Hand in the X/Z Reading report by pulling expenses from the existing `expenses` table.

**Architecture:** Extend `SalesReadingData` with `expensesTotal`, query the `expenses` table inside `getSalesReading` filtered by the same date range as transactions, then render a cash summary card + two summary table rows + two print rows in the client component.

**Tech Stack:** Next.js 15 App Router, Supabase (service role), TypeScript, Tailwind CSS v4, shadcn/ui on Base UI

---

## Files to Modify

| File | Change |
|------|--------|
| `lib/actions/reports.ts` | Add `expensesTotal: number` to `SalesReadingData`; query `expenses` table in `getSalesReading` |
| `app/(dashboard)/reports/z-report/z-report-client.tsx` | Add cash summary card, two rows to summary table, two rows to print output |

---

## Task 1: Extend `SalesReadingData` and query expenses in `getSalesReading`

**Files:**
- Modify: `lib/actions/reports.ts`

- [ ] **Step 1: Add `expensesTotal` to the `SalesReadingData` type**

In `lib/actions/reports.ts`, find the `SalesReadingData` type (around line 349) and add the new field:

```ts
export type SalesReadingData = {
  salesCount: number
  totalRevenue: number
  totalDiscounts: number
  avgTransactionValue: number
  voidCount: number
  voidedTotal: number
  byPaymentMethod: { method: string; count: number; total: number }[]
  hourlyBreakdown: { hour: number; revenue: number; count: number }[]
  dailyBreakdown: { date: string; revenue: number; count: number }[]
  transactions: SalesReadingTransaction[]
  expensesTotal: number   // ← add this
}
```

- [ ] **Step 2: Query the `expenses` table inside `getSalesReading`**

In `getSalesReading`, after `await Promise.all([...])` (the customer + item count fetches, around line 424) and before the `totalRevenue` calculation, add:

```ts
// Expenses total for the same period
let expQuery = supabase
  .from('expenses')
  .select('amount')
  .eq('org_id', ORG_ID)

if (params.mode === 'z-reading' && params.date) {
  expQuery = expQuery.lte('date', params.date)
} else if (params.mode === 'x-reading' && params.date_from && params.date_to) {
  expQuery = expQuery.gte('date', params.date_from).lte('date', params.date_to)
}
// all-time: no date filter — sum all expenses

const { data: expRows } = await expQuery
const expensesTotal = (expRows ?? []).reduce((sum: number, e: any) => sum + (e.amount ?? 0), 0)
```

- [ ] **Step 3: Include `expensesTotal` in the return value**

At the bottom of `getSalesReading`, in the `return { ... }` block, add `expensesTotal`:

```ts
return {
  salesCount,
  totalRevenue,
  totalDiscounts,
  avgTransactionValue,
  voidCount,
  voidedTotal,
  byPaymentMethod,
  hourlyBreakdown,
  dailyBreakdown,
  transactions,
  expensesTotal,   // ← add this
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd /Users/joseph-macbookpro-m3/Documents/Apps/practice/hardware-pos
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors related to `expensesTotal` or `SalesReadingData`.

- [ ] **Step 5: Commit**

```bash
git add lib/actions/reports.ts
git commit -m "feat: add expensesTotal to getSalesReading and SalesReadingData"
```

---

## Task 2: Add cash summary card to the client

**Files:**
- Modify: `app/(dashboard)/reports/z-report/z-report-client.tsx`

- [ ] **Step 1: Add the cash summary card between stat cards and summary table**

In `z-report-client.tsx`, find the `{/* Summary table */}` comment (around line 362). Directly above it, insert the cash summary card. `cashOnHand` is computed inline as `data.totalRevenue - data.expensesTotal`.

```tsx
{/* Cash on Hand summary */}
{!(isPending || analyticsLoading) && (
  <Card>
    <CardContent className="p-0">
      <table className="w-full text-sm">
        <tbody>
          <tr className="border-b border-border">
            <td className="px-4 py-3 font-medium">Total Sales (Revenue)</td>
            <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(data.totalRevenue)}</td>
          </tr>
          <tr className="border-b border-border">
            <td className="px-4 py-3 font-medium text-muted-foreground">Less: Expenses</td>
            <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
              − {formatCurrency(data.expensesTotal)}
            </td>
          </tr>
          <tr>
            <td className="px-4 py-3 font-bold text-base">Cash on Hand</td>
            <td className={`px-4 py-3 text-right tabular-nums font-bold text-base ${
              data.totalRevenue - data.expensesTotal < 0 ? "text-destructive" : ""
            }`}>
              {formatCurrency(data.totalRevenue - data.expensesTotal)}
            </td>
          </tr>
        </tbody>
      </table>
    </CardContent>
  </Card>
)}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/\(dashboard\)/reports/z-report/z-report-client.tsx
git commit -m "feat: add cash on hand summary card to sales reading"
```

---

## Task 3: Add expenses rows to the summary table

**Files:**
- Modify: `app/(dashboard)/reports/z-report/z-report-client.tsx`

- [ ] **Step 1: Add two rows after "Total Revenue" in the summary table**

In the Summary `<Table>` (inside the `<Card>` with `CardTitle` "Summary", around line 371), find the "Total Revenue" `<TableRow>` and add two rows directly after it:

```tsx
<TableRow>
  <TableCell className="font-medium">Total Revenue</TableCell>
  <TableCell className="text-right tabular-nums">{formatCurrency(data.totalRevenue)}</TableCell>
</TableRow>
{/* ↓ add these two rows */}
<TableRow>
  <TableCell className="font-medium text-muted-foreground">Less: Expenses</TableCell>
  <TableCell className="text-right tabular-nums text-muted-foreground">
    − {formatCurrency(data.expensesTotal)}
  </TableCell>
</TableRow>
<TableRow className="border-t-2 border-border">
  <TableCell className="font-bold">Cash on Hand</TableCell>
  <TableCell className={`text-right tabular-nums font-bold ${
    data.totalRevenue - data.expensesTotal < 0 ? "text-destructive" : ""
  }`}>
    {formatCurrency(data.totalRevenue - data.expensesTotal)}
  </TableCell>
</TableRow>
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/\(dashboard\)/reports/z-report/z-report-client.tsx
git commit -m "feat: add expenses and cash on hand rows to summary table"
```

---

## Task 4: Add expenses rows to the print output

**Files:**
- Modify: `app/(dashboard)/reports/z-report/z-report-client.tsx`

- [ ] **Step 1: Add `expensesTotal` prop to `PrintContent`**

Find the `PrintContent` component definition (around line 36). Add `expensesTotal: number` to its props interface and destructuring:

```tsx
function PrintContent({
  mode,
  data,
  dateFrom,
  dateTo,
  formatCurrency,
  companyName,
  address1,
  address2,
  logoUrl,
  expensesTotal,    // ← add
}: {
  mode: Mode
  data: SalesReadingData
  dateFrom: string
  dateTo: string
  formatCurrency: (v: number) => string
  companyName?: string | null
  address1?: string | null
  address2?: string | null
  logoUrl?: string | null
  expensesTotal: number   // ← add
}) {
```

- [ ] **Step 2: Add the two rows to the print summary table**

Inside `PrintContent`, find the summary `<table>` (around line 89). After the `Total Revenue` row, add:

```tsx
<tr><td>Total Revenue</td><td style={{ textAlign: "right" }}>{formatCurrency(data.totalRevenue)}</td></tr>
{/* ↓ add these two rows */}
<tr>
  <td>Less: Expenses</td>
  <td style={{ textAlign: "right" }}>− {formatCurrency(expensesTotal)}</td>
</tr>
<tr style={{ borderTop: "1px solid #000" }}>
  <td><strong>Cash on Hand</strong></td>
  <td style={{ textAlign: "right" }}>
    <strong>{formatCurrency(data.totalRevenue - expensesTotal)}</strong>
  </td>
</tr>
```

- [ ] **Step 3: Pass `expensesTotal` when rendering `PrintContent`**

Find the `createPortal(...)` call near the bottom of `ZReportClient` (around line 499). Add the prop:

```tsx
{mounted &&
  createPortal(
    <PrintContent
      mode={mode}
      data={data}
      dateFrom={dateFrom}
      dateTo={dateTo}
      formatCurrency={formatCurrency}
      companyName={companyName}
      address1={address1}
      address2={address2}
      logoUrl={logoUrl}
      expensesTotal={data.expensesTotal}   // ← add
    />,
    document.body
  )}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add app/\(dashboard\)/reports/z-report/z-report-client.tsx
git commit -m "feat: add expenses and cash on hand to print output"
```

---

## Task 5: Manual verification

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

- [ ] **Step 2: Navigate to Sales Reading**

Open `http://localhost:3000/reports/z-report`.

Verify on **Z-Reading (all-time)**:
- Cash on Hand card appears between stat cards and summary table
- Shows Total Sales (Revenue), Less: Expenses, Cash on Hand
- Summary table has the two new rows after Total Revenue
- If there are no expenses, "Less: Expenses" shows `− ₱ 0.00` and Cash on Hand equals Total Revenue

- [ ] **Step 3: Switch to X-Reading and apply a date range**

Pick a date range that covers some expenses (check the `/expenses` page for existing dates).

Verify:
- Expenses figure changes to match only expenses within that date range
- Cash on Hand updates accordingly

- [ ] **Step 4: Test print**

Click the Print button and verify the printed output shows:
- "Less: Expenses" row with total
- "Cash on Hand" row in bold

- [ ] **Step 5: Test negative cash on hand**

If `expensesTotal > totalRevenue`, Cash on Hand should appear in red (`text-destructive`). You can temporarily add a large expense to test this, then delete it after.
