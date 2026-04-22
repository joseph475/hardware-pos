ALTER TABLE products
  ADD COLUMN serial_required BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE transaction_items
  ADD COLUMN serials TEXT[] NOT NULL DEFAULT '{}';
