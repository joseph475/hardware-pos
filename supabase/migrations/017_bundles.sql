-- 017_bundles.sql
-- Adds product bundles: a named group of products sold at a fixed price.
-- Stock is deducted from individual components at sale time (not at bundle creation).

CREATE TABLE IF NOT EXISTS bundles (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  description  TEXT,
  price        NUMERIC(12,2) NOT NULL DEFAULT 0,
  image_url    TEXT,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bundle_items (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bundle_id  UUID NOT NULL REFERENCES bundles(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity   NUMERIC(12,3) NOT NULL DEFAULT 1
);

-- Allow transaction_items to reference a bundle (product_id becomes nullable)
ALTER TABLE transaction_items ADD COLUMN IF NOT EXISTS bundle_id UUID REFERENCES bundles(id);
ALTER TABLE transaction_items ALTER COLUMN product_id DROP NOT NULL;

-- Allow quotation_items to reference a bundle (product_id becomes nullable)
ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS bundle_id UUID REFERENCES bundles(id);
ALTER TABLE quotation_items ALTER COLUMN product_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bundles_org_id ON bundles(org_id);
CREATE INDEX IF NOT EXISTS idx_bundle_items_bundle_id ON bundle_items(bundle_id);
CREATE INDEX IF NOT EXISTS idx_bundle_items_product_id ON bundle_items(product_id);
