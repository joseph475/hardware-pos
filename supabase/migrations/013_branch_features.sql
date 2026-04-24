-- 013_branch_features.sql

-- 1. Main branch flag
ALTER TABLE branches ADD COLUMN IF NOT EXISTS is_main BOOLEAN NOT NULL DEFAULT false;
UPDATE branches SET is_main = true WHERE id = '00000000-0000-0000-0000-000000000010';

-- 2. Branch stock request status enum
CREATE TYPE branch_request_status AS ENUM ('pending', 'in_progress', 'fulfilled', 'cancelled');

-- 3. Branch stock requests table (sub-branch → main branch requests)
CREATE TABLE IF NOT EXISTS branch_stock_requests (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  requesting_branch_id    UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  status                  branch_request_status NOT NULL DEFAULT 'pending',
  notes                   TEXT,
  created_by              UUID NOT NULL REFERENCES profiles(id),
  fulfillment_transfer_id UUID REFERENCES stock_transfers(id) ON DELETE SET NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS branch_stock_request_items (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id  UUID NOT NULL REFERENCES branch_stock_requests(id) ON DELETE CASCADE,
  product_id  UUID NOT NULL REFERENCES products(id),
  quantity    NUMERIC(12, 3) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_branch_stock_requests_branch ON branch_stock_requests(requesting_branch_id);
CREATE INDEX IF NOT EXISTS idx_branch_stock_requests_status ON branch_stock_requests(status);
