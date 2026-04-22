-- Add 'gcash' and 'maya' to the payment_method enum
ALTER TYPE payment_method ADD VALUE IF NOT EXISTS 'gcash';
ALTER TYPE payment_method ADD VALUE IF NOT EXISTS 'maya';

-- Add QR URL columns to organizations
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS gcash_qr_url TEXT,
  ADD COLUMN IF NOT EXISTS maya_qr_url  TEXT;
