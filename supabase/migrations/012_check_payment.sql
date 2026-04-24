-- 012_check_payment.sql
ALTER TYPE payment_method ADD VALUE IF NOT EXISTS 'check';

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS check_bank_name  TEXT,
  ADD COLUMN IF NOT EXISTS check_date       DATE,
  ADD COLUMN IF NOT EXISTS check_number     TEXT,
  ADD COLUMN IF NOT EXISTS check_name       TEXT,
  ADD COLUMN IF NOT EXISTS check_amount     NUMERIC(14, 2);
