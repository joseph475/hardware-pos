# Date & Number Formatting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create SSR-safe `lib/format.ts` formatting utilities and migrate all bare `toLocale*` calls in JSX to eliminate recurring React hydration errors.

**Architecture:** A single `lib/format.ts` module exports four functions backed by `date-fns format()` and explicit-locale `Intl.NumberFormat`. All client component JSX that currently calls `toLocaleDateString/toLocaleTimeString/toLocaleString` is updated to use these utilities. `suppressHydrationWarning` props added only to paper over this class of bug are removed.

**Tech Stack:** date-fns v4 (already installed), TypeScript, Next.js App Router client components

---

## File Map

| Action | File |
|--------|------|
| **Create** | `lib/format.ts` |
| **Modify** | `app/(dashboard)/purchasing/branch-requests/branch-requests-client.tsx` |
| **Modify** | `app/(dashboard)/inventory/transfers/transfers-client.tsx` |
| **Modify** | `app/(dashboard)/inventory/stock/stock-client.tsx` |
| **Modify** | `app/(dashboard)/dashboard/dashboard-client.tsx` |
| **Modify** | `app/(dashboard)/reports/sales/sales-client.tsx` |
| **Modify** | `app/(dashboard)/reports/products/product-report-client.tsx` |
| **Modify** | `components/pos/recent-sales-sheet.tsx` |
| **Modify** | `components/pos/receipt-dialog.tsx` |
| **Modify** | `components/pos/void-with-pin-dialog.tsx` |
| **Modify** | `CLAUDE.md` |

---

### Task 1: Create `lib/format.ts`

**Files:**
- Create: `lib/format.ts`

- [ ] **Step 1: Create the utility file**

```ts
import { format, parseISO } from "date-fns"

function toDate(value: string | Date): Date {
  return typeof value === "string" ? parseISO(value) : value
}

export function formatDate(value: string | Date): string {
  return format(toDate(value), "MMM d, yyyy")
}

export function formatDateLong(value: string | Date): string {
  return format(toDate(value), "EEEE, MMMM d, yyyy")
}

export function formatTime(value: string | Date): string {
  return format(toDate(value), "h:mm a")
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat("en-US").format(n)
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors related to `lib/format.ts`

- [ ] **Step 3: Commit**

```bash
git add lib/format.ts
git commit -m "feat: add SSR-safe date/number formatting utilities"
```

---

### Task 2: Migrate inventory date cells

**Files:**
- Modify: `app/(dashboard)/purchasing/branch-requests/branch-requests-client.tsx:154-156`
- Modify: `app/(dashboard)/inventory/transfers/transfers-client.tsx:123-125`
- Modify: `app/(dashboard)/inventory/stock/stock-client.tsx:230-232`

- [ ] **Step 1: Update branch-requests-client.tsx**

Add the import at the top of the file (after existing imports):
```ts
import { formatDate } from "@/lib/format"
```

Replace line 154-156:
```tsx
// BEFORE
<TableCell className="text-sm text-muted-foreground" suppressHydrationWarning>
  {new Date(req.created_at).toLocaleDateString()}
</TableCell>

// AFTER
<TableCell className="text-sm text-muted-foreground">
  {formatDate(req.created_at)}
</TableCell>
```

- [ ] **Step 2: Update transfers-client.tsx**

Add the import at the top of the file (after existing imports):
```ts
import { formatDate } from "@/lib/format"
```

Replace lines 123-125:
```tsx
// BEFORE
<TableCell className="font-mono text-xs text-muted-foreground" suppressHydrationWarning>
  {new Date(t.created_at).toLocaleDateString()}
</TableCell>

// AFTER
<TableCell className="font-mono text-xs text-muted-foreground">
  {formatDate(t.created_at)}
</TableCell>
```

- [ ] **Step 3: Update stock-client.tsx**

Add the import at the top of the file (after existing imports):
```ts
import { formatDate } from "@/lib/format"
```

Replace lines 230-232:
```tsx
// BEFORE
<TableCell className="pr-4 text-xs text-muted-foreground font-mono" suppressHydrationWarning>
  {new Date(row.updated_at).toLocaleDateString()}
</TableCell>

// AFTER
<TableCell className="pr-4 text-xs text-muted-foreground font-mono">
  {formatDate(row.updated_at)}
</TableCell>
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no new errors

- [ ] **Step 5: Commit**

```bash
git add app/\(dashboard\)/purchasing/branch-requests/branch-requests-client.tsx \
        app/\(dashboard\)/inventory/transfers/transfers-client.tsx \
        app/\(dashboard\)/inventory/stock/stock-client.tsx
git commit -m "fix: use formatDate utility in inventory/transfers/branch-requests"
```

---

### Task 3: Migrate dashboard

**Files:**
- Modify: `app/(dashboard)/dashboard/dashboard-client.tsx`

- [ ] **Step 1: Add import**

Add after the existing imports at the top of `dashboard-client.tsx`:
```ts
import { formatDateLong, formatNumber } from "@/lib/format"
```

- [ ] **Step 2: Replace toLocaleString() on stat values**

There are three `.toLocaleString()` calls inside the `STATS` array (around lines 156, 164, 172). Replace each:

```tsx
// BEFORE (line ~156)
value: data.transactionCount.toLocaleString(),

// AFTER
value: formatNumber(data.transactionCount),
```

```tsx
// BEFORE (line ~164)
value: data.itemsSold.toLocaleString(),

// AFTER
value: formatNumber(data.itemsSold),
```

```tsx
// BEFORE (line ~172)
value: data.activeProducts.toLocaleString(),

// AFTER
value: formatNumber(data.activeProducts),
```

- [ ] **Step 3: Replace dashboard heading date**

Around line 189-197, replace the `<p>` element:
```tsx
// BEFORE
<p className="text-sm text-muted-foreground" suppressHydrationWarning>
  Overview for today —{" "}
  {new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })}
</p>

// AFTER
<p className="text-sm text-muted-foreground">
  Overview for today — {formatDateLong(new Date())}
</p>
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no new errors

- [ ] **Step 5: Commit**

```bash
git add app/\(dashboard\)/dashboard/dashboard-client.tsx
git commit -m "fix: use formatNumber and formatDateLong in dashboard"
```

---

### Task 4: Migrate reports

**Files:**
- Modify: `app/(dashboard)/reports/sales/sales-client.tsx`
- Modify: `app/(dashboard)/reports/products/product-report-client.tsx`

- [ ] **Step 1: Update sales-client.tsx**

Add the import after existing imports:
```ts
import { formatNumber } from "@/lib/format"
```

Replace the two `.toLocaleString()` calls in the STATS array (around lines 141 and 155):
```tsx
// BEFORE (line ~141)
value: data.transactionCount.toLocaleString(),

// AFTER
value: formatNumber(data.transactionCount),
```

```tsx
// BEFORE (line ~155)
value: data.itemsSold.toLocaleString(),

// AFTER
value: formatNumber(data.itemsSold),
```

- [ ] **Step 2: Update product-report-client.tsx**

Add the import after existing imports:
```ts
import { formatNumber } from "@/lib/format"
```

Replace line ~263:
```tsx
// BEFORE
{product.units.toLocaleString()}

// AFTER
{formatNumber(product.units)}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no new errors

- [ ] **Step 4: Commit**

```bash
git add app/\(dashboard\)/reports/sales/sales-client.tsx \
        app/\(dashboard\)/reports/products/product-report-client.tsx
git commit -m "fix: use formatNumber in sales and product reports"
```

---

### Task 5: Migrate POS components

**Files:**
- Modify: `components/pos/receipt-dialog.tsx`
- Modify: `components/pos/void-with-pin-dialog.tsx`
- Modify: `components/pos/recent-sales-sheet.tsx`

- [ ] **Step 1: Update receipt-dialog.tsx**

Add the import after existing imports:
```ts
import { formatDate, formatTime } from "@/lib/format"
```

Replace lines 70-71 inside `ReceiptContent`:
```tsx
// BEFORE
const date = data.timestamp.toLocaleDateString()
const time = data.timestamp.toLocaleTimeString()

// AFTER
const date = formatDate(data.timestamp)
const time = formatTime(data.timestamp)
```

- [ ] **Step 2: Update void-with-pin-dialog.tsx**

Add the import after existing imports:
```ts
import { formatTime } from "@/lib/format"
```

Replace lines 69-72:
```tsx
// BEFORE
const time = new Date(transaction.created_at).toLocaleTimeString([], {
  hour: "2-digit",
  minute: "2-digit",
})

// AFTER
const time = formatTime(transaction.created_at)
```

- [ ] **Step 3: Update recent-sales-sheet.tsx**

Add the import after existing imports:
```ts
import { formatDate, formatTime } from "@/lib/format"
```

Remove the local `formatTime` helper function (lines ~98-100):
```tsx
// DELETE this entire function:
function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}
```

Replace the `dateLabel` computation (line ~104-105):
```tsx
// BEFORE
: new Date(selectedDate + "T12:00:00").toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })

// AFTER
: formatDate(selectedDate + "T12:00:00")
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no new errors

- [ ] **Step 5: Commit**

```bash
git add components/pos/receipt-dialog.tsx \
        components/pos/void-with-pin-dialog.tsx \
        components/pos/recent-sales-sheet.tsx
git commit -m "fix: use formatDate/formatTime utilities in POS components"
```

---

### Task 6: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Add Date & Number Formatting section**

In `CLAUDE.md`, find the `## Base UI Gotchas (CRITICAL)` section and insert the following new section **directly before it**:

```markdown
## Date & Number Formatting (CRITICAL — prevents hydration errors)
Never call `toLocaleDateString()`, `toLocaleTimeString()`, or `toLocaleString()` directly in JSX. Node.js and the browser resolve locale differently → React hydration mismatch. Use the shared utilities from `lib/format.ts` instead:
- `formatDate(value)` — "Apr 24, 2026"
- `formatDateLong(value)` — "Thursday, April 24, 2026"
- `formatTime(value)` — "2:30 PM"
- `formatNumber(n)` — "1,234"
All accept `string | Date`. Safe to call during SSR — output is identical on server and client.
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add date/number formatting rule to CLAUDE.md"
```

---

### Task 7: Final verification

- [ ] **Step 1: Full TypeScript check**

```bash
npx tsc --noEmit
```

Expected: zero errors

- [ ] **Step 2: Confirm no unguarded toLocale* remain in JSX**

```bash
grep -rn "toLocaleDateString\|toLocaleTimeString\|toLocaleString" \
  --include="*.tsx" \
  app/ components/ \
  | grep -v "// " \
  | grep -v "node_modules"
```

Expected output — only lines that are inside non-JSX function bodies (event handlers, CSV exports, `mounted`-gated print helpers). There should be **zero** occurrences directly inside JSX return statements without a guarding function wrapper.

Remaining acceptable calls (not in JSX render path):
- `transactions-client.tsx` — inside `handleExportCSV()` function body
- `z-report-client.tsx` — inside `{mounted && createPortal(...)}` (client-only after mount)
- `held-orders-sheet.tsx` — inside `formatTime()` helper called from JSX (acceptable: this component's helper is only invoked client-side after data loads; mark with `suppressHydrationWarning` if hydration warnings still appear)
- `z-report/page.tsx` — server component, no hydration
- `lib/actions/reports.ts` — server-side only

- [ ] **Step 3: Smoke-test in browser**

Start the dev server and visit:
1. `/` (dashboard) — heading shows full weekday date, stats show comma-formatted numbers
2. `/inventory/stock` — date column shows "Apr 24, 2026" style
3. `/inventory/transfers` — same
4. `/purchasing/branch-requests` — same
5. Open browser console — confirm **no hydration warnings** in the console
