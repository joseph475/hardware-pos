# Cheque Details on Purchase Orders — Design Spec

**Date:** 2026-04-29

## Problem / Motivation

When a supplier is paid by cheque for a received PO, there is currently no way to record or track cheque payment details inside the system. Staff have to track this off-system, making reconciliation error-prone. This feature adds cheque recording directly on received POs, with a visible indicator in the orders list and a filter so managers can quickly find POs with or without cheque records.

## Scope

- New `purchase_order_cheques` table
- Four server actions for CRUD on cheques
- "Manage Cheques" row action on received POs
- Cheque icon indicator in the PO row
- "Has Cheque / No Cheque" filter in the orders list

---

## Data Layer

### New Table: `purchase_order_cheques`

Migration file: `supabase/migrations/025_purchase_order_cheques.sql`

```sql
CREATE TABLE purchase_order_cheques (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  po_id       UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  check_name   TEXT NOT NULL,
  check_number TEXT NOT NULL,
  check_date   DATE NOT NULL,
  amount      NUMERIC(12, 2) NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON purchase_order_cheques (po_id);
CREATE INDEX ON purchase_order_cheques (org_id);
```

### TypeScript Types (`types/database.ts`)

Add `PurchaseOrderChequeRow` interface matching the table columns, and extend `POWithRelations` to include `purchase_order_cheques: Array<{ id: string }>` (used only for the icon/filter check in the list).

---

## Server Actions (`lib/actions/purchasing.ts`)

All follow the pattern: `auth()` → `getAdminClient()` → DB operation → `revalidatePath('/purchasing/orders')`.

| Function | Description |
|---|---|
| `getPOCheques(poId)` | Fetch all cheques for a PO ordered by `created_at asc` |
| `addPOCheque(data)` | Insert cheque; validate that `new amount + existing total ≤ PO total` |
| `updatePOCheque(id, data)` | Update fields; validate total excluding this cheque's old amount |
| `deletePOCheque(id)` | Delete a cheque record |

**Amount validation rule:** Sum of all cheque amounts for a PO must not exceed the PO's `total`. The "Add Cheque" button in the UI is disabled when already at 100%, and the server action also enforces this as a hard check.

---

## UI Changes

### 1. `getPurchaseOrders` query

Add `purchase_order_cheques(id)` to the Supabase select so each fetched PO includes a lightweight array of cheque IDs. Cast with `as any[]` per project pattern.

### 2. Row icon (`orders-client.tsx`)

Render a `Banknote` icon (Lucide, size-3.5, `text-muted-foreground`) inline next to the PO ID when `po.purchase_order_cheques.length > 0`. Tooltip: "Has cheque details".

### 3. Row action (`orders-client.tsx`)

Add "Manage Cheques" (Receipt icon) to the dropdown for received POs only (`status === "received"`). Clicking it opens `ChequeDetailsDialog` with the PO passed as a prop.

### 4. Filter (`orders-client.tsx`)

New `chequeFilter` state (`"all" | "has_cheque" | "no_cheque"`), rendered as a Select dropdown alongside the existing Status/Supplier/Date filters. Label: "Cheque". Applied client-side:

```ts
if (chequeFilter === "has_cheque") filtered = filtered.filter(po => po.purchase_order_cheques.length > 0)
if (chequeFilter === "no_cheque") filtered = filtered.filter(po => po.purchase_order_cheques.length === 0)
```

### 5. New Component: `components/purchasing/cheque-details-dialog.tsx`

**Props:** `po: POWithRelations`, `open: boolean`, `onOpenChange: (v: boolean) => void`

**Layout:**
- Header: "Cheque Details — PO #XXXXXXXX"
- Running total line: e.g. "₱4,500.00 of ₱5,000.00 covered" (colored green when equal, amber otherwise)
- Cheques list table: columns — Check Name, Check No., Date, Amount, Actions (Edit / Delete)
- Below list: "Add Cheque" button — disabled when `chequeTotal >= po.total`
- Inline form (toggled by Add / Edit): React Hook Form + Zod, fields: Check Name, Check Number, Date, Amount

**Zod schema:**
```ts
z.object({
  check_name: z.string().min(1),
  check_number: z.string().min(1),
  check_date: z.string().min(1),   // DATE string YYYY-MM-DD
  amount: z.number().positive(),
})
```

**State:** `cheques` loaded via `getPOCheques` on dialog open, refreshed after each mutation. Edit mode stores the cheque being edited; form resets on cancel.

---

## Verification

1. Apply migration — table created with correct indexes
2. Open orders list → filter "Received" → click "Manage Cheques" on a PO → dialog opens
3. Add a cheque → icon appears in the PO row, "Has Cheque" filter shows the PO
4. Add cheques until total equals PO total → "Add Cheque" button becomes disabled
5. Edit a cheque → amount updated, running total recalculates
6. Delete a cheque → removed from list; if last one, icon disappears from row
7. Filter "No Cheque" → POs with cheques are excluded
8. Server-side: attempt to add a cheque exceeding total via direct action call → error returned
