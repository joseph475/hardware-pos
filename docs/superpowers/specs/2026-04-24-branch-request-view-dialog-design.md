# Branch Request View Dialog — Design Spec

**Date:** 2026-04-24

## Overview

Add a read-only "View Details" action to every row in the branch requests table so users can inspect a request's items without leaving the page.

## What's Changing

### 1. New file: `view-request-dialog.tsx`

Located at `app/(dashboard)/purchasing/branch-requests/view-request-dialog.tsx`.

A Dialog component (matching the `view-po-dialog.tsx` pattern) that receives a `BranchStockRequestWithRelations` and renders:

**Header**
- Request ID (first 8 chars, uppercased, monospace)
- Status badge (using `STATUS_CONFIG` already defined in `branch-requests-client.tsx`)
- Metadata row: requesting branch (main-branch view only), created by, date

**Notes block** — shown only when `req.notes` is non-empty; same muted background style used in `view-po-dialog.tsx`

**Items table** (scrollable, max-h ~55vh)
| Column | Value |
|--------|-------|
| Product | `item.product.name` |
| SKU | `item.product.sku` |
| Qty | `item.quantity` |

**Footer**
- Single "Close" button (outline variant)

No server action needed — all data is already in `BranchStockRequestWithRelations`.

### 2. Updated file: `branch-requests-client.tsx`

- Add `viewTarget` state (`BranchStockRequestWithRelations | null`)
- Add "View Details" `DropdownMenuItem` (first item, visible for every row regardless of status or role)
- Render `<ViewRequestDialog>` at the bottom of the component

## Constraints

- Read-only: no status mutations from this dialog
- Works for both main-branch users (who see the "Branch" column) and sub-branch users
- No new data fetching — uses data already loaded by the page
