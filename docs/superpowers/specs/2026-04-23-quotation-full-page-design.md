# Quotation Full-Page Form

**Date:** 2026-04-23  
**Status:** Approved

## Problem

The current quotation create/edit experience uses a right-side Sheet (`max-w-2xl`). The narrow width makes product details — names, SKUs, prices, per-item discounts — hard to read and manage, especially when a quote has many line items.

## Solution

Replace the Sheet with a dedicated full-page route for both creating and editing draft quotations. The page uses a two-column layout that gives line items the full available width on the left, with form metadata and totals on the right.

Non-draft quotations (sent, accepted, rejected, etc.) continue to use the existing `QuotationDetailSheet` — no change there.

## User Flow

### Creating a new quotation
1. User clicks **New Quotation** on `/quotations`
2. `CustomerSelectDialog` opens (unchanged) — user picks a customer
3. On confirm, navigate to `/quotations/new?customer_id=X`
4. Server page fetches customer name from the customers list using `customer_id`; form loads with customer pre-filled (read-only)
5. User fills in items, details → clicks **Save Draft** → redirected back to `/quotations`
6. Cancel → redirected back to `/quotations`

### Editing a draft quotation
1. User clicks a draft row in the quotations table
2. Navigate to `/quotations/[id]/edit`
3. Full-page form loads with all existing data pre-filled
4. User makes changes → clicks **Update Quote** → redirected back to `/quotations`
5. Cancel → redirected back to `/quotations`

## Page Layout

```
┌─────────────────────────────────────────────────────────────┐
│ ← Quotations    New Quotation — Juan dela Cruz       [Draft] │  ← top bar
├────┬────────────────────────────────────┬────────────────────┤
│    │  LINE ITEMS                        │  QUOTE DETAILS     │
│ S  │  [Search by name or SKU…       ]  │  Customer (rdonly) │
│ i  │                                    │  Branch            │
│ d  │  ┌──────────────────────────────┐  │  Valid Until       │
│ e  │  │ [img] HDMI Cable  − 2 +  ₱598│  │  Discount (₱)     │
│ b  │  │ [img] USB-C Hub   − 1 +  ₱1,299│ │  Notes            │
│ a  │  │ [img] Keyboard    − 1 +  ₱2,499│ │                   │
│ r  │  └──────────────────────────────┘  │  ┌─────────────┐  │
│    │                                    │  │ Subtotal    │  │
│    │  + Search to add more items        │  │ Discount    │  │
│    │                                    │  │ Total       │  │
│    │                                    │  └─────────────┘  │
│    │                                    │  [Save Draft]     │
│    │                                    │  [Cancel]         │
└────┴────────────────────────────────────┴────────────────────┘
```

- **Left column** (flex: 1) — product search command bar + line items list. Each item shows: thumbnail, name, SKU, qty stepper, unit price input, discount input, line total, remove button. Serial number slots appear below items that require them.
- **Right column** (~280px) — customer (read-only), branch select (owner only; read-only for manager/cashier), valid until date, overall discount, notes textarea. Below the fields: subtotal / discount / grand total summary. At the bottom: Save Draft (or Update Quote for edits) and Cancel buttons.

## Components & Files

### New files

| Path | Purpose |
|------|---------|
| `app/(dashboard)/quotations/new/page.tsx` | Server component. Reads `customer_id` from `searchParams`. Fetches customers, branches, products. Renders `QuotationFormClient`. |
| `app/(dashboard)/quotations/new/loading.tsx` | Skeleton matching the two-col layout. |
| `app/(dashboard)/quotations/[id]/edit/page.tsx` | Server component. Fetches quotation by `id`, branches, products. Renders `QuotationFormClient`. |
| `app/(dashboard)/quotations/[id]/edit/loading.tsx` | Same skeleton as `/new/loading.tsx`. |
| `app/(dashboard)/quotations/components/quotation-form-client.tsx` | Client component. The full-page form — extracted and adapted from `quotation-dialog.tsx`. No Sheet wrapper. Accepts same props minus `open`/`onOpenChange`. On save success, calls `router.push('/quotations')`. |

### Modified files

| Path | Change |
|------|--------|
| `app/(dashboard)/quotations/quotations-client.tsx` | After customer picker confirms: `router.push('/quotations/new?customer_id=' + id)` instead of opening Sheet. Clicking a draft table row: `router.push('/quotations/' + id + '/edit')` instead of opening Sheet. |
| `app/(dashboard)/quotations/components/quotation-dialog.tsx` | Delete — fully replaced by `quotation-form-client.tsx`. Non-draft viewing is handled by `QuotationDetailSheet` (unchanged). |

### Unchanged files

- `app/(dashboard)/quotations/components/quotation-detail-sheet.tsx` — non-draft view stays as-is
- `lib/actions/quotations.ts` — server actions unchanged; `createQuotation` and `updateQuotation` already exist
- `components/pos/customer-select-dialog.tsx` — pre-step dialog unchanged

## Form Behavior

- **Customer field**: always read-only on the page (set via search param or from DB record)
- **Branch field**: editable select for `owner`; read-only display for `manager`/`cashier`
- **Save**: calls `createQuotation` (new) or `updateQuotation` (edit), then `router.push('/quotations')`
- **Cancel**: `router.push('/quotations')`
- **Validation**: same Zod schema as current dialog — at least one item required, customer and branch required
- **Pending state**: Save button shows "Saving…" and is disabled during the server action

## Not in scope

- Auto-save / draft-on-navigate-away
- Converting a quote to a sale from the edit page (that stays in the list via dropdown)
- Editing non-draft quotations (still view-only via `QuotationDetailSheet`)
