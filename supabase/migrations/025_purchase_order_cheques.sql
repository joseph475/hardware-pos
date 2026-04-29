-- 025_purchase_order_cheques.sql
CREATE TABLE purchase_order_cheques (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  po_id        UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  check_name   TEXT NOT NULL,
  check_number TEXT NOT NULL,
  check_date   DATE NOT NULL,
  amount       NUMERIC(12, 2) NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON purchase_order_cheques (po_id);
CREATE INDEX ON purchase_order_cheques (org_id);
