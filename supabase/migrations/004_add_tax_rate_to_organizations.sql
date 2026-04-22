-- Add tax_rate to organizations (stored as a decimal, e.g. 0.12 = 12%)
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(5, 4) NOT NULL DEFAULT 0.12;
