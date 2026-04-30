-- 020_bundle_component_serials.sql
-- Adds component_serials JSONB column to transaction_items for storing per-component
-- serial numbers when the transaction item is a bundle.
-- Structure: { [product_id]: string[] }
ALTER TABLE transaction_items
  ADD COLUMN IF NOT EXISTS component_serials JSONB DEFAULT NULL;
