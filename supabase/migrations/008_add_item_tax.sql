-- Add per-item add_tax_pct to quotation_items
ALTER TABLE quotation_items
  ADD COLUMN add_tax_pct NUMERIC(5,2) NOT NULL DEFAULT 0;

-- Add add_tax_amount (sum of per-item add taxes) and tax_rate (editable global rate) to quotations
ALTER TABLE quotations
  ADD COLUMN add_tax_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN tax_rate NUMERIC(5,4) NOT NULL DEFAULT 0;
