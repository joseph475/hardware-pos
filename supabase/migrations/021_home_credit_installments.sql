-- Add home_credit to the payment_method enum
ALTER TYPE payment_method ADD VALUE IF NOT EXISTS 'home_credit';

-- Create installment_plans table
CREATE TABLE IF NOT EXISTS installment_plans (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  transaction_id  UUID NOT NULL UNIQUE REFERENCES transactions(id) ON DELETE CASCADE,
  downpayment     NUMERIC(14,2) NOT NULL DEFAULT 0,
  hc_amount       NUMERIC(14,2) NOT NULL,
  terms           INTEGER NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'received')),
  received_at     TIMESTAMPTZ,
  received_by     UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_installment_plans_org_id ON installment_plans(org_id);
CREATE INDEX IF NOT EXISTS idx_installment_plans_status ON installment_plans(status);
CREATE INDEX IF NOT EXISTS idx_installment_plans_transaction_id ON installment_plans(transaction_id);
