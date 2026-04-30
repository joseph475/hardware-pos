---
title: All Cheques Sheet — Purchase Orders Page
date: 2026-04-30
status: approved
---

## Overview

Add a "View All Cheques" side sheet to the Purchase Orders page that displays every cheque issued across all POs, sorted by check date latest-first. Clicking a cheque row opens the existing `ChequeDetailsDialog` for that PO so the user can manage cheques in-place.

## Entry Point

A **"View All Cheques"** button (Banknote icon) is added to the top-right header of the Purchase Orders page, alongside the existing "New PO" button. It opens a right-anchored sheet.

## Sheet Contents

- **Title:** "All Cheques"
- **Table columns:** Date · Payee (check_name) · Check # · Amount · PO (short ID + supplier name)
- **Sort order:** `check_date` descending (latest first)
- **Row interaction:** clicking any row opens `ChequeDetailsDialog` for that row's PO
- **Empty state:** "No cheques recorded yet."

## Data Flow

### New server action — `getAllCheques()`

Added to `lib/actions/purchasing.ts`. Queries `purchase_order_cheques` joined with `purchase_orders` and `suppliers`, ordered by `check_date DESC`. Returns an array of:

```ts
{
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

### Client-side fetching

`AllChequesSheet` fetches via `getAllCheques()` when opened (same pattern as `ChequeDetailsDialog` uses `getPOCheques`). When the inner `ChequeDetailsDialog` closes, the sheet re-fetches its list to reflect any adds/edits/deletes.

### PO object lookup

`fullOrders` (already in `OrdersClient`) is passed into `AllChequesSheet` so it can find the full `POWithRelations` object needed by `ChequeDetailsDialog`.

## Files

| File | Change |
|------|--------|
| `lib/actions/purchasing.ts` | Add `getAllCheques()` |
| `components/purchasing/all-cheques-sheet.tsx` | New component |
| `app/(dashboard)/purchasing/orders/orders-client.tsx` | Add button + render sheet |

## Out of Scope

- Filtering/searching within the sheet (not requested)
- Pagination (expected to be a small dataset)
- Adding/deleting cheques directly from the sheet (managed via ChequeDetailsDialog)
