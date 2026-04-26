# Bundles / Packages Feature — Design Spec
**Date:** 2026-04-25

## Context

The POS currently sells individual products. Operators want to create pre-defined bundles (e.g. "Paint Starter Kit = 2× Paint Can + 1× Roller + 1× Brush Tray") sold at a fixed bundle price. Bundles must be searchable in POS and quotation creation. Stock is deducted from individual components at the time of sale, not at bundle creation.

---

## Data Model

### New tables (single migration)

```sql
bundles
  id             UUID PK default gen_random_uuid()
  org_id         UUID NOT NULL → organizations
  name           TEXT NOT NULL
  description    TEXT
  price          NUMERIC(12,2) NOT NULL default 0
  image_url      TEXT
  is_active      BOOLEAN NOT NULL default TRUE
  created_at     TIMESTAMPTZ default now()
  updated_at     TIMESTAMPTZ default now()

bundle_items
  id             UUID PK default gen_random_uuid()
  bundle_id      UUID NOT NULL → bundles (ON DELETE CASCADE)
  product_id     UUID NOT NULL → products
  quantity       NUMERIC(12,3) NOT NULL default 1
```

### Migration change to existing table

```sql
ALTER TABLE transaction_items ADD COLUMN bundle_id UUID REFERENCES bundles(id);
ALTER TABLE transaction_items ALTER COLUMN product_id DROP NOT NULL;
```

`product_id` is currently `NOT NULL` in the schema — it must be made nullable. A `transaction_items` row represents either a product sale (`product_id` set) or a bundle sale (`bundle_id` set), never both.

### TypeScript types (`types/database.ts`)

Add `Bundle`, `BundleItem`, and `BundleWithItems` types. Extend `TransactionItem` with nullable `bundle_id`.

---

## Bundle Management UI

**Route:** `/inventory/bundles`

**Files:**
- `app/(dashboard)/inventory/bundles/page.tsx` — server component, fetches bundles via `getBundles()`
- `app/(dashboard)/inventory/bundles/bundles-client.tsx` — client component, table + sheet
- `app/(dashboard)/inventory/bundles/loading.tsx` — skeleton
- `lib/actions/bundles.ts` — server actions

**List view:** Table with columns: Name, Price, Items (count), Status (Active/Inactive), Actions (Edit, Toggle active).

**Create/Edit sheet:**
- Fields: Name (required), Description (optional), Price (required, > 0), Image URL (optional)
- Product picker: searchable dropdown of active products showing current stock. User selects a product, enters quantity, clicks "Add". Items list shows each component with remove button.
- Validation: at least 1 component required; price > 0; no duplicate products in the same bundle.

**Server actions (`lib/actions/bundles.ts`):**
- `getBundles()` — fetch all bundles with items for the org
- `createBundle(data)` — insert bundle + bundle_items in a transaction
- `updateBundle(id, data)` — update bundle + replace bundle_items
- `toggleBundleActive(id, isActive)` — soft enable/disable

**Role access:** Manager and owner only. Cashiers cannot access `/inventory/bundles`.

---

## POS Integration

**Product fetch:** Add `getPOSBundles(branchId)` to `lib/actions/inventory.ts`. Returns active bundles whose every component product is also active and has stock > 0 **at the given branch** (same branch-scoping as `getPOSProducts`). Cached under `pos-products` tag.

**Search:** In `pos-client.tsx`, bundles are merged into the search dropdown alongside products. Bundles show a small "Bundle" badge. Matched by name.

**Cart:** Extend `lib/store/cart.ts` to support bundle cart items:
```ts
type CartItem = ProductCartItem | BundleCartItem
BundleCartItem: { type: 'bundle', bundle_id, name, price, quantity, items: BundleItem[] }
```

**Checkout stock validation:** Before payment, for each bundle in cart: check every component has `stock >= bundle_items.quantity × cart quantity`. If any component is short, block payment with descriptive toast.

**Transaction recording (`lib/actions/transactions.ts`):**
- For each bundle cart item: insert one `transaction_items` row with `bundle_id` set, `product_id` null, price = bundle price.
- For each component of the bundle: update `inventory` (deduct `quantity × cart_qty`) and insert `inventory_movements` with `type = 'sale'`, `reference_id = transaction.id`.

**Refresh button:** Icon button (`RefreshCw` from Lucide) beside the POS search field. Calls `router.refresh()` to re-fetch products + bundles.

---

## Quotation Integration

**Product fetch (`app/(dashboard)/quotations/new/page.tsx`):** Also fetch active bundles and pass to the form client.

**Search:** In `quotation-form-client.tsx`, bundles appear in the product search dropdown with a "Bundle" badge. Adding a bundle creates a line item with `bundle_id`, `name`, and `price` = bundle price.

**Refresh button:** Same `RefreshCw` icon button beside the quotation product search field.

---

## Edge Cases

| Scenario | Handling |
|---|---|
| Component out of stock at checkout | Pre-validate before payment; block with toast naming the short component |
| Bundle component deactivated | `getPOSBundles` filters out bundles with any inactive component |
| Bundle component has zero stock | Bundle not shown in POS (filtered by `getPOSBundles`) |
| Editing a bundle after sales | Allowed; historical `transaction_items` retain the `bundle_id` snapshot |
| Bundle quantity in cart > 1 | Deduct `bundle_items.quantity × cart_item.quantity` per component |
| Cache stale after bundle create/edit | `revalidateTag('pos-products')` called in all bundle mutations |

---

## Sidebar Navigation

Add "Bundles" link under the Inventory section in `components/layout/sidebar.tsx`, visible to manager and owner roles only (same role-guard pattern used for other inventory links).

---

## Verification

1. Create a bundle with 2+ components in `/inventory/bundles` — verify it appears in the list.
2. Search for the bundle name in POS — verify it appears with "Bundle" badge.
3. Add bundle to cart, proceed to payment — verify component stock is deducted correctly in `/inventory/stock`.
4. Try to purchase a bundle when a component is out of stock — verify payment is blocked with a clear error.
5. Search for the bundle in new quotation — verify it appears and can be added as a line item.
6. Click refresh button in POS after adding a new product — verify it appears without a page navigation.
7. Deactivate a bundle component product — verify the bundle no longer appears in POS search.
