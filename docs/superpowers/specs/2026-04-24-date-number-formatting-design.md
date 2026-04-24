# Date & Number Formatting — Hydration-Safe Utilities

**Date:** 2026-04-24

## Problem

React hydration errors fire whenever a client component calls `toLocaleDateString()`, `toLocaleTimeString()`, or `toLocaleString()` directly in JSX. The Node.js server renders with its locale; the browser renders with the user's locale. The outputs differ → React logs a hydration mismatch. This keeps recurring because there is no shared utility to reach for — developers write the natural JS idiom and the bug appears later.

## Solution

Create `lib/format.ts` with three SSR-safe formatting functions backed by `date-fns` and `Intl.NumberFormat` with an explicit locale. Replace all bare `toLocale*` calls in JSX across the codebase. Document the rule in CLAUDE.md.

## Utility Design (`lib/format.ts`)

```ts
formatDate(value: string | Date): string
// Output: "Apr 24, 2026"
// Uses: date-fns format(date, 'MMM d, yyyy')

formatDateLong(value: string | Date): string
// Output: "Thursday, April 24, 2026"
// Uses: date-fns format(date, 'EEEE, MMMM d, yyyy')
// Used by: dashboard heading only

formatTime(value: string | Date): string
// Output: "2:30 PM"
// Uses: date-fns format(date, 'h:mm a')

formatNumber(n: number): string
// Output: "1,234"
// Uses: Intl.NumberFormat('en-US').format(n)  — explicit locale, stable across environments
```

Accepts `string | Date` so it works with Supabase ISO timestamp strings and JS `Date` objects alike. Uses `date-fns` `format()` (not `toLocale*`) so the output string is byte-identical between Node.js and browser — no locale inference, no mismatch possible.

## Migration Scope

All bare `toLocale*` calls in JSX are replaced. `suppressHydrationWarning` props that exist solely to paper over these calls are also removed.

| File | Lines | Change |
|------|-------|--------|
| `app/(dashboard)/purchasing/branch-requests/branch-requests-client.tsx` | 155 | `formatDate(req.created_at)` |
| `app/(dashboard)/inventory/transfers/transfers-client.tsx` | 124 | `formatDate(t.created_at)` + remove `suppressHydrationWarning` |
| `app/(dashboard)/inventory/stock/stock-client.tsx` | 231 | `formatDate(row.updated_at)` + remove `suppressHydrationWarning` |
| `app/(dashboard)/dashboard/dashboard-client.tsx` | 156, 164, 172 | `formatNumber(...)` |
| `app/(dashboard)/dashboard/dashboard-client.tsx` | 191 | `formatDateLong(new Date())` + remove `suppressHydrationWarning` |
| `app/(dashboard)/reports/products/product-report-client.tsx` | 263 | `formatNumber(product.units)` |
| `app/(dashboard)/reports/sales/sales-client.tsx` | 141, 155 | `formatNumber(...)` |
| `components/pos/recent-sales-sheet.tsx` | 99, 105 | `formatTime(iso)` + `formatDate(...)` |
| `components/pos/receipt-dialog.tsx` | 70, 71 | `formatDate(timestamp)` + `formatTime(timestamp)` |
| `components/pos/void-with-pin-dialog.tsx` | 69 | `formatTime(created_at)` |

Calls that are inside event handlers or non-JSX function bodies (e.g. CSV export, print helpers) are left as-is — they do not participate in SSR.

## CLAUDE.md Addition

A new "Date & Number Formatting" section is added to CLAUDE.md:

```
## Date & Number Formatting (CRITICAL — prevents hydration errors)
Never call `toLocaleDateString()`, `toLocaleTimeString()`, or `toLocaleString()` directly
in JSX. Use the shared utilities from `lib/format.ts`:
- `formatDate(value)` — "Apr 24, 2026"
- `formatDateLong(value)` — "Thursday, April 24, 2026"
- `formatTime(value)` — "2:30 PM"
- `formatNumber(n)` — "1,234"
These use date-fns and explicit-locale Intl, so output is identical on server and client.
```

## What Is Not Changing

- Calls inside event handlers, CSV exports, or `mounted`-gated print previews — these never run during SSR.
- Server components (e.g. `z-report/page.tsx`) — no hydration involved.
- `date-fns` is already a project dependency; no new packages needed.
