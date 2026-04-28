CREATE TABLE IF NOT EXISTS expenses (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  category    text NOT NULL,
  date        date NOT NULL,
  amount      numeric(12,2) NOT NULL,
  note        text,
  created_by  uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS expenses_org_id_idx   ON expenses (org_id);
CREATE INDEX IF NOT EXISTS expenses_date_idx     ON expenses (org_id, date DESC);
CREATE INDEX IF NOT EXISTS expenses_category_idx ON expenses (org_id, category);
