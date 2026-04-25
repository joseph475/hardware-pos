-- Migration 016: Multi-supplier product support
-- Adds per-supplier cost tracking, per-supplier stock, and COGS allocation per transaction item

-- ============================================================
-- product_suppliers: each product can have multiple suppliers
-- each with their own cost price
-- ============================================================

CREATE TABLE product_suppliers (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id  UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  cost_price  NUMERIC(12,2) NOT NULL DEFAULT 0,
  is_default  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (product_id, supplier_id)
);

CREATE INDEX idx_product_suppliers_product  ON product_suppliers(product_id);
CREATE INDEX idx_product_suppliers_supplier ON product_suppliers(supplier_id);

-- ============================================================
-- product_supplier_stock: stock broken down by supplier+branch
-- Total across suppliers = inventory.quantity for that product+branch
-- ============================================================

CREATE TABLE product_supplier_stock (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id  UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  branch_id   UUID NOT NULL REFERENCES branches(id)  ON DELETE CASCADE,
  quantity    NUMERIC(12,2) NOT NULL DEFAULT 0,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (product_id, supplier_id, branch_id)
);

CREATE INDEX idx_pss_product  ON product_supplier_stock(product_id);
CREATE INDEX idx_pss_supplier ON product_supplier_stock(supplier_id);
CREATE INDEX idx_pss_branch   ON product_supplier_stock(branch_id);

-- ============================================================
-- transaction_item_supplier_costs: COGS allocation per line item
-- Tracks which supplier's units were consumed and at what cost
-- ============================================================

CREATE TABLE transaction_item_supplier_costs (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_item_id UUID NOT NULL REFERENCES transaction_items(id) ON DELETE CASCADE,
  supplier_id         UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  quantity            NUMERIC(12,2) NOT NULL,
  unit_cost           NUMERIC(12,2) NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tisc_transaction_item ON transaction_item_supplier_costs(transaction_item_id);
CREATE INDEX idx_tisc_supplier         ON transaction_item_supplier_costs(supplier_id);

-- ============================================================
-- Migrate existing products.supplier_id → product_suppliers
-- ============================================================

INSERT INTO product_suppliers (product_id, supplier_id, cost_price, is_default)
SELECT id, supplier_id, cost_price, true
FROM products
WHERE supplier_id IS NOT NULL;
