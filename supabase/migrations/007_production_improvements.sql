-- Transaction void tracking
ALTER TABLE transactions ADD COLUMN void_reason TEXT;
ALTER TABLE transactions ADD COLUMN voided_by UUID REFERENCES profiles(id);
ALTER TABLE transactions ADD COLUMN voided_at TIMESTAMPTZ;

-- Organization receipt + discount settings
ALTER TABLE organizations ADD COLUMN receipt_header TEXT;
ALTER TABLE organizations ADD COLUMN receipt_footer TEXT;
ALTER TABLE organizations ADD COLUMN max_cashier_discount_pct NUMERIC(5,2) NOT NULL DEFAULT 20;
