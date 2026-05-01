-- Add 'credit' to the payment_method enum
ALTER TYPE payment_method ADD VALUE IF NOT EXISTS 'credit';

-- Accounts Receivable — one row per credit sale
CREATE TABLE IF NOT EXISTS accounts_receivable (
  id             UUID          NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id         UUID          NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id      UUID          NOT NULL REFERENCES branches(id)      ON DELETE CASCADE,
  transaction_id UUID          NOT NULL REFERENCES transactions(id)  ON DELETE CASCADE,
  customer_name  TEXT          NOT NULL,
  amount_due     NUMERIC(12,2) NOT NULL,
  amount_paid    NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes          TEXT,
  cashier_id     UUID          NOT NULL REFERENCES profiles(id),
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ar_org_id    ON accounts_receivable(org_id);
CREATE INDEX IF NOT EXISTS idx_ar_branch_id ON accounts_receivable(branch_id);
