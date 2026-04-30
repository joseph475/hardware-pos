ALTER TABLE purchase_orders
  ADD COLUMN IF NOT EXISTS payment_due_date DATE,
  ADD COLUMN IF NOT EXISTS shipping_fee     NUMERIC(12, 2) NOT NULL DEFAULT 0;

ALTER TABLE inventory_movements
  ADD COLUMN IF NOT EXISTS serials TEXT[] NOT NULL DEFAULT '{}';
