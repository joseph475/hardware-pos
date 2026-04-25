-- 014_ewallet_payment.sql
ALTER TYPE payment_method ADD VALUE IF NOT EXISTS 'e_wallet';

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS ewallet_provider  TEXT,
  ADD COLUMN IF NOT EXISTS ewallet_reference TEXT;
