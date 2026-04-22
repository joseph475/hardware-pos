-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE user_role AS ENUM ('super_admin', 'manager', 'cashier');
CREATE TYPE inventory_movement_type AS ENUM (
  'sale', 'purchase', 'adjustment', 'transfer_in', 'transfer_out', 'damage'
);
CREATE TYPE purchase_order_status AS ENUM (
  'draft', 'ordered', 'partial', 'received', 'cancelled'
);
CREATE TYPE payment_method AS ENUM ('cash', 'card', 'split');
CREATE TYPE transaction_status AS ENUM ('completed', 'voided', 'held');
CREATE TYPE stock_transfer_status AS ENUM (
  'pending', 'approved', 'in_transit', 'completed', 'cancelled'
);

-- ============================================================
-- TABLES
-- ============================================================

CREATE TABLE organizations (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE branches (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  address     TEXT,
  phone       TEXT,
  timezone    TEXT NOT NULL DEFAULT 'UTC',
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE profiles (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clerk_user_id  TEXT NOT NULL UNIQUE,
  org_id         UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id      UUID REFERENCES branches(id) ON DELETE SET NULL,
  role           user_role NOT NULL DEFAULT 'cashier',
  full_name      TEXT NOT NULL,
  email          TEXT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE categories (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE products (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id         UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  sku            TEXT NOT NULL,
  barcode        TEXT,
  name           TEXT NOT NULL,
  description    TEXT,
  category_id    UUID REFERENCES categories(id) ON DELETE SET NULL,
  unit           TEXT NOT NULL DEFAULT 'pcs',
  cost_price     NUMERIC(12, 2) NOT NULL DEFAULT 0,
  selling_price  NUMERIC(12, 2) NOT NULL DEFAULT 0,
  image_url      TEXT,
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(org_id, sku)
);

CREATE TABLE inventory (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id          UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  branch_id           UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  quantity            NUMERIC(12, 3) NOT NULL DEFAULT 0,
  low_stock_threshold NUMERIC(12, 3) NOT NULL DEFAULT 10,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(product_id, branch_id)
);

CREATE TABLE inventory_movements (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id    UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  branch_id     UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  type          inventory_movement_type NOT NULL,
  quantity      NUMERIC(12, 3) NOT NULL,
  reference_id  UUID,
  notes         TEXT,
  created_by    UUID NOT NULL REFERENCES profiles(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE suppliers (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id        UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  contact_name  TEXT,
  email         TEXT,
  phone         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE purchase_orders (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_id  UUID NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  branch_id    UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  status       purchase_order_status NOT NULL DEFAULT 'draft',
  total        NUMERIC(14, 2) NOT NULL DEFAULT 0,
  notes        TEXT,
  created_by   UUID NOT NULL REFERENCES profiles(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE purchase_order_items (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  po_id              UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_id         UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity_ordered   NUMERIC(12, 3) NOT NULL,
  quantity_received  NUMERIC(12, 3) NOT NULL DEFAULT 0,
  unit_cost          NUMERIC(12, 2) NOT NULL
);

CREATE TABLE transactions (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id        UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  cashier_id       UUID NOT NULL REFERENCES profiles(id),
  subtotal         NUMERIC(14, 2) NOT NULL,
  discount_amount  NUMERIC(14, 2) NOT NULL DEFAULT 0,
  tax_amount       NUMERIC(14, 2) NOT NULL DEFAULT 0,
  total            NUMERIC(14, 2) NOT NULL,
  payment_method   payment_method NOT NULL,
  status           transaction_status NOT NULL DEFAULT 'completed',
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE transaction_items (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_id   UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  product_id       UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  product_name     TEXT NOT NULL,
  quantity         NUMERIC(12, 3) NOT NULL,
  unit_price       NUMERIC(12, 2) NOT NULL,
  discount_amount  NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total            NUMERIC(14, 2) NOT NULL
);

CREATE TABLE stock_transfers (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  from_branch_id  UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  to_branch_id    UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  status          stock_transfer_status NOT NULL DEFAULT 'pending',
  notes           TEXT,
  created_by      UUID NOT NULL REFERENCES profiles(id),
  approved_by     UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE stock_transfer_items (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transfer_id  UUID NOT NULL REFERENCES stock_transfers(id) ON DELETE CASCADE,
  product_id   UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity     NUMERIC(12, 3) NOT NULL
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_branches_org_id ON branches(org_id);
CREATE INDEX idx_profiles_clerk_user_id ON profiles(clerk_user_id);
CREATE INDEX idx_profiles_org_id ON profiles(org_id);
CREATE INDEX idx_profiles_branch_id ON profiles(branch_id);
CREATE INDEX idx_categories_org_id ON categories(org_id);
CREATE INDEX idx_products_org_id ON products(org_id);
CREATE INDEX idx_products_sku ON products(org_id, sku);
CREATE INDEX idx_products_barcode ON products(barcode) WHERE barcode IS NOT NULL;
CREATE INDEX idx_products_category_id ON products(category_id);
CREATE INDEX idx_inventory_product_id ON inventory(product_id);
CREATE INDEX idx_inventory_branch_id ON inventory(branch_id);
CREATE INDEX idx_inventory_movements_product_id ON inventory_movements(product_id);
CREATE INDEX idx_inventory_movements_branch_id ON inventory_movements(branch_id);
CREATE INDEX idx_inventory_movements_created_at ON inventory_movements(created_at);
CREATE INDEX idx_suppliers_org_id ON suppliers(org_id);
CREATE INDEX idx_purchase_orders_branch_id ON purchase_orders(branch_id);
CREATE INDEX idx_purchase_orders_supplier_id ON purchase_orders(supplier_id);
CREATE INDEX idx_purchase_orders_created_at ON purchase_orders(created_at);
CREATE INDEX idx_purchase_order_items_po_id ON purchase_order_items(po_id);
CREATE INDEX idx_transactions_branch_id ON transactions(branch_id);
CREATE INDEX idx_transactions_cashier_id ON transactions(cashier_id);
CREATE INDEX idx_transactions_created_at ON transactions(created_at);
CREATE INDEX idx_transaction_items_transaction_id ON transaction_items(transaction_id);
CREATE INDEX idx_transaction_items_product_id ON transaction_items(product_id);
CREATE INDEX idx_stock_transfers_from_branch ON stock_transfers(from_branch_id);
CREATE INDEX idx_stock_transfers_to_branch ON stock_transfers(to_branch_id);
CREATE INDEX idx_stock_transfer_items_transfer_id ON stock_transfer_items(transfer_id);

-- ============================================================
-- UPDATED_AT TRIGGER FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_inventory_updated_at
  BEFORE UPDATE ON inventory
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_purchase_orders_updated_at
  BEFORE UPDATE ON purchase_orders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_stock_transfers_updated_at
  BEFORE UPDATE ON stock_transfers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE organizations         ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches              ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles              ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories            ENABLE ROW LEVEL SECURITY;
ALTER TABLE products              ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory             ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements   ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers             ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders       ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_items  ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_items     ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_transfers       ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_transfer_items  ENABLE ROW LEVEL SECURITY;

-- Helper: resolve the org_id for the currently authenticated Clerk user
CREATE OR REPLACE FUNCTION auth_org_id()
RETURNS UUID AS $$
  SELECT org_id
  FROM profiles
  WHERE clerk_user_id = auth.uid()::text
  LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Helper: resolve the profile id for the currently authenticated Clerk user
CREATE OR REPLACE FUNCTION auth_profile_id()
RETURNS UUID AS $$
  SELECT id
  FROM profiles
  WHERE clerk_user_id = auth.uid()::text
  LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- organizations: members can read their own org
CREATE POLICY "org_members_select" ON organizations
  FOR SELECT USING (id = auth_org_id());

-- branches: members of the same org
CREATE POLICY "branch_members_select" ON branches
  FOR SELECT USING (org_id = auth_org_id());

CREATE POLICY "branch_managers_insert" ON branches
  FOR INSERT WITH CHECK (org_id = auth_org_id());

CREATE POLICY "branch_managers_update" ON branches
  FOR UPDATE USING (org_id = auth_org_id());

-- profiles: users can read profiles in their org
CREATE POLICY "profiles_org_select" ON profiles
  FOR SELECT USING (org_id = auth_org_id());

CREATE POLICY "profiles_self_update" ON profiles
  FOR UPDATE USING (id = auth_profile_id());

-- categories
CREATE POLICY "categories_org_select" ON categories
  FOR SELECT USING (org_id = auth_org_id());

CREATE POLICY "categories_org_insert" ON categories
  FOR INSERT WITH CHECK (org_id = auth_org_id());

CREATE POLICY "categories_org_update" ON categories
  FOR UPDATE USING (org_id = auth_org_id());

CREATE POLICY "categories_org_delete" ON categories
  FOR DELETE USING (org_id = auth_org_id());

-- products
CREATE POLICY "products_org_select" ON products
  FOR SELECT USING (org_id = auth_org_id());

CREATE POLICY "products_org_insert" ON products
  FOR INSERT WITH CHECK (org_id = auth_org_id());

CREATE POLICY "products_org_update" ON products
  FOR UPDATE USING (org_id = auth_org_id());

CREATE POLICY "products_org_delete" ON products
  FOR DELETE USING (org_id = auth_org_id());

-- inventory: branches in the same org
CREATE POLICY "inventory_org_select" ON inventory
  FOR SELECT USING (
    branch_id IN (SELECT id FROM branches WHERE org_id = auth_org_id())
  );

CREATE POLICY "inventory_org_upsert" ON inventory
  FOR INSERT WITH CHECK (
    branch_id IN (SELECT id FROM branches WHERE org_id = auth_org_id())
  );

CREATE POLICY "inventory_org_update" ON inventory
  FOR UPDATE USING (
    branch_id IN (SELECT id FROM branches WHERE org_id = auth_org_id())
  );

-- inventory_movements: insert-only for org members
CREATE POLICY "inv_movements_org_select" ON inventory_movements
  FOR SELECT USING (
    branch_id IN (SELECT id FROM branches WHERE org_id = auth_org_id())
  );

CREATE POLICY "inv_movements_org_insert" ON inventory_movements
  FOR INSERT WITH CHECK (
    branch_id IN (SELECT id FROM branches WHERE org_id = auth_org_id())
  );

-- suppliers
CREATE POLICY "suppliers_org_select" ON suppliers
  FOR SELECT USING (org_id = auth_org_id());

CREATE POLICY "suppliers_org_insert" ON suppliers
  FOR INSERT WITH CHECK (org_id = auth_org_id());

CREATE POLICY "suppliers_org_update" ON suppliers
  FOR UPDATE USING (org_id = auth_org_id());

CREATE POLICY "suppliers_org_delete" ON suppliers
  FOR DELETE USING (org_id = auth_org_id());

-- purchase_orders
CREATE POLICY "po_org_select" ON purchase_orders
  FOR SELECT USING (
    branch_id IN (SELECT id FROM branches WHERE org_id = auth_org_id())
  );

CREATE POLICY "po_org_insert" ON purchase_orders
  FOR INSERT WITH CHECK (
    branch_id IN (SELECT id FROM branches WHERE org_id = auth_org_id())
  );

CREATE POLICY "po_org_update" ON purchase_orders
  FOR UPDATE USING (
    branch_id IN (SELECT id FROM branches WHERE org_id = auth_org_id())
  );

-- purchase_order_items
CREATE POLICY "po_items_org_select" ON purchase_order_items
  FOR SELECT USING (
    po_id IN (
      SELECT id FROM purchase_orders
      WHERE branch_id IN (SELECT id FROM branches WHERE org_id = auth_org_id())
    )
  );

CREATE POLICY "po_items_org_insert" ON purchase_order_items
  FOR INSERT WITH CHECK (
    po_id IN (
      SELECT id FROM purchase_orders
      WHERE branch_id IN (SELECT id FROM branches WHERE org_id = auth_org_id())
    )
  );

CREATE POLICY "po_items_org_update" ON purchase_order_items
  FOR UPDATE USING (
    po_id IN (
      SELECT id FROM purchase_orders
      WHERE branch_id IN (SELECT id FROM branches WHERE org_id = auth_org_id())
    )
  );

-- transactions
CREATE POLICY "txn_org_select" ON transactions
  FOR SELECT USING (
    branch_id IN (SELECT id FROM branches WHERE org_id = auth_org_id())
  );

CREATE POLICY "txn_org_insert" ON transactions
  FOR INSERT WITH CHECK (
    branch_id IN (SELECT id FROM branches WHERE org_id = auth_org_id())
  );

CREATE POLICY "txn_org_update" ON transactions
  FOR UPDATE USING (
    branch_id IN (SELECT id FROM branches WHERE org_id = auth_org_id())
  );

-- transaction_items
CREATE POLICY "txn_items_org_select" ON transaction_items
  FOR SELECT USING (
    transaction_id IN (
      SELECT id FROM transactions
      WHERE branch_id IN (SELECT id FROM branches WHERE org_id = auth_org_id())
    )
  );

CREATE POLICY "txn_items_org_insert" ON transaction_items
  FOR INSERT WITH CHECK (
    transaction_id IN (
      SELECT id FROM transactions
      WHERE branch_id IN (SELECT id FROM branches WHERE org_id = auth_org_id())
    )
  );

-- stock_transfers
CREATE POLICY "transfers_org_select" ON stock_transfers
  FOR SELECT USING (
    from_branch_id IN (SELECT id FROM branches WHERE org_id = auth_org_id())
    OR to_branch_id IN (SELECT id FROM branches WHERE org_id = auth_org_id())
  );

CREATE POLICY "transfers_org_insert" ON stock_transfers
  FOR INSERT WITH CHECK (
    from_branch_id IN (SELECT id FROM branches WHERE org_id = auth_org_id())
  );

CREATE POLICY "transfers_org_update" ON stock_transfers
  FOR UPDATE USING (
    from_branch_id IN (SELECT id FROM branches WHERE org_id = auth_org_id())
    OR to_branch_id IN (SELECT id FROM branches WHERE org_id = auth_org_id())
  );

-- stock_transfer_items
CREATE POLICY "transfer_items_org_select" ON stock_transfer_items
  FOR SELECT USING (
    transfer_id IN (
      SELECT id FROM stock_transfers
      WHERE from_branch_id IN (SELECT id FROM branches WHERE org_id = auth_org_id())
         OR to_branch_id   IN (SELECT id FROM branches WHERE org_id = auth_org_id())
    )
  );

CREATE POLICY "transfer_items_org_insert" ON stock_transfer_items
  FOR INSERT WITH CHECK (
    transfer_id IN (
      SELECT id FROM stock_transfers
      WHERE from_branch_id IN (SELECT id FROM branches WHERE org_id = auth_org_id())
    )
  );
