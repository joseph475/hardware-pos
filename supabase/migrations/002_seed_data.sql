-- ============================================================
-- SEED DATA — 3 Branches, 15 Products, 4 Suppliers
-- ============================================================

-- Organization (idempotent)
INSERT INTO organizations (id, name)
VALUES ('00000000-0000-0000-0000-000000000001', 'My Store')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- BRANCHES
-- ============================================================
INSERT INTO branches (id, org_id, name, address, phone, timezone, is_active) VALUES
  (
    '00000000-0000-0000-0000-000000000010',
    '00000000-0000-0000-0000-000000000001',
    'Main Branch',
    '123 Main Street, Downtown',
    '+1-555-0100',
    'America/New_York',
    true
  ),
  (
    '00000000-0000-0000-0000-000000000011',
    '00000000-0000-0000-0000-000000000001',
    'East Branch',
    '456 East Avenue, Eastside',
    '+1-555-0101',
    'America/New_York',
    true
  ),
  (
    '00000000-0000-0000-0000-000000000012',
    '00000000-0000-0000-0000-000000000001',
    'West Branch',
    '789 West Boulevard, Westside',
    '+1-555-0102',
    'America/Los_Angeles',
    true
  )
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- CATEGORIES
-- ============================================================
INSERT INTO categories (id, org_id, name) VALUES
  ('00000000-0000-0000-0000-000000000020', '00000000-0000-0000-0000-000000000001', 'Beverages'),
  ('00000000-0000-0000-0000-000000000021', '00000000-0000-0000-0000-000000000001', 'Snacks'),
  ('00000000-0000-0000-0000-000000000022', '00000000-0000-0000-0000-000000000001', 'Dairy'),
  ('00000000-0000-0000-0000-000000000023', '00000000-0000-0000-0000-000000000001', 'Bakery'),
  ('00000000-0000-0000-0000-000000000024', '00000000-0000-0000-0000-000000000001', 'Produce')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- SUPPLIERS
-- ============================================================
INSERT INTO suppliers (id, org_id, name, contact_name, email, phone) VALUES
  (
    '00000000-0000-0000-0000-000000000030',
    '00000000-0000-0000-0000-000000000001',
    'Global Beverage Co.',
    'Mark Torres',
    'mark@globalbev.com',
    '+1-555-0200'
  ),
  (
    '00000000-0000-0000-0000-000000000031',
    '00000000-0000-0000-0000-000000000001',
    'FreshFoods Distributors',
    'Sarah Chen',
    'sarah@freshfoods.com',
    '+1-555-0201'
  ),
  (
    '00000000-0000-0000-0000-000000000032',
    '00000000-0000-0000-0000-000000000001',
    'Dairy Direct Ltd.',
    'James Miller',
    'james@dairydirect.com',
    '+1-555-0202'
  ),
  (
    '00000000-0000-0000-0000-000000000033',
    '00000000-0000-0000-0000-000000000001',
    'Metro Bakery Supplies',
    'Linda Park',
    'linda@metrobakery.com',
    '+1-555-0203'
  )
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- PRODUCTS (15)
-- ============================================================
INSERT INTO products (id, org_id, sku, name, description, category_id, unit, cost_price, selling_price, is_active) VALUES
  -- Beverages
  (
    '00000000-0000-0000-0000-000000000040',
    '00000000-0000-0000-0000-000000000001',
    'BEV-001', 'Mineral Water 500ml',
    'Natural sparkling mineral water in a 500ml bottle',
    '00000000-0000-0000-0000-000000000020',
    'each', 0.50, 1.25, true
  ),
  (
    '00000000-0000-0000-0000-000000000041',
    '00000000-0000-0000-0000-000000000001',
    'BEV-002', 'Orange Juice 1L',
    '100% freshly squeezed orange juice, 1 litre carton',
    '00000000-0000-0000-0000-000000000020',
    'each', 1.20, 2.99, true
  ),
  (
    '00000000-0000-0000-0000-000000000042',
    '00000000-0000-0000-0000-000000000001',
    'BEV-003', 'Cola 330ml Can',
    'Classic cola flavour carbonated drink',
    '00000000-0000-0000-0000-000000000020',
    'each', 0.45, 1.10, true
  ),
  (
    '00000000-0000-0000-0000-000000000043',
    '00000000-0000-0000-0000-000000000001',
    'BEV-004', 'Green Tea 500ml',
    'Unsweetened green tea, chilled',
    '00000000-0000-0000-0000-000000000020',
    'each', 0.80, 2.25, true
  ),
  -- Snacks
  (
    '00000000-0000-0000-0000-000000000044',
    '00000000-0000-0000-0000-000000000001',
    'SNK-001', 'Potato Chips 150g',
    'Salted potato chips, classic cut',
    '00000000-0000-0000-0000-000000000021',
    'each', 0.80, 1.99, true
  ),
  (
    '00000000-0000-0000-0000-000000000045',
    '00000000-0000-0000-0000-000000000001',
    'SNK-002', 'Dark Chocolate 100g',
    '70% cocoa dark chocolate bar',
    '00000000-0000-0000-0000-000000000021',
    'each', 1.10, 2.75, true
  ),
  (
    '00000000-0000-0000-0000-000000000046',
    '00000000-0000-0000-0000-000000000001',
    'SNK-003', 'Mixed Nuts 200g',
    'Roasted mixed nuts — almonds, cashews, peanuts',
    '00000000-0000-0000-0000-000000000021',
    'each', 2.50, 5.99, true
  ),
  -- Dairy
  (
    '00000000-0000-0000-0000-000000000047',
    '00000000-0000-0000-0000-000000000001',
    'DAI-001', 'Full Cream Milk 2L',
    'Fresh full cream milk, 2 litre',
    '00000000-0000-0000-0000-000000000022',
    'each', 1.50, 3.49, true
  ),
  (
    '00000000-0000-0000-0000-000000000048',
    '00000000-0000-0000-0000-000000000001',
    'DAI-002', 'Cheddar Cheese 250g',
    'Aged cheddar cheese block, 250g',
    '00000000-0000-0000-0000-000000000022',
    'each', 2.20, 4.99, true
  ),
  (
    '00000000-0000-0000-0000-000000000049',
    '00000000-0000-0000-0000-000000000001',
    'DAI-003', 'Greek Yogurt 500g',
    'Plain Greek yogurt, full fat',
    '00000000-0000-0000-0000-000000000022',
    'each', 1.80, 3.99, true
  ),
  -- Bakery
  (
    '00000000-0000-0000-0000-000000000050',
    '00000000-0000-0000-0000-000000000001',
    'BAK-001', 'White Bread Loaf',
    'Freshly baked white sandwich bread',
    '00000000-0000-0000-0000-000000000023',
    'each', 1.00, 2.49, true
  ),
  (
    '00000000-0000-0000-0000-000000000051',
    '00000000-0000-0000-0000-000000000001',
    'BAK-002', 'Whole Wheat Bread',
    'Hearty whole wheat loaf, sliced',
    '00000000-0000-0000-0000-000000000023',
    'each', 1.20, 2.99, true
  ),
  (
    '00000000-0000-0000-0000-000000000052',
    '00000000-0000-0000-0000-000000000001',
    'BAK-003', 'Croissants 4-Pack',
    'Buttery French-style croissants, pack of 4',
    '00000000-0000-0000-0000-000000000023',
    'each', 1.80, 4.50, true
  ),
  -- Produce
  (
    '00000000-0000-0000-0000-000000000053',
    '00000000-0000-0000-0000-000000000001',
    'PRD-001', 'Bananas 1kg',
    'Fresh Cavendish bananas, approximately 6-7 pieces',
    '00000000-0000-0000-0000-000000000024',
    'kg', 0.60, 1.49, true
  ),
  (
    '00000000-0000-0000-0000-000000000054',
    '00000000-0000-0000-0000-000000000001',
    'PRD-002', 'Cherry Tomatoes 500g',
    'Vine-ripened cherry tomatoes, punnet',
    '00000000-0000-0000-0000-000000000024',
    'each', 1.30, 3.25, true
  )
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- INVENTORY — stock for each product at each branch
-- ============================================================
INSERT INTO inventory (product_id, branch_id, quantity, low_stock_threshold)
SELECT p.id, b.id,
  -- Random-ish quantities per product/branch
  CASE
    WHEN p.sku LIKE 'BEV-%' THEN 80 + (random() * 60)::int
    WHEN p.sku LIKE 'SNK-%' THEN 50 + (random() * 40)::int
    WHEN p.sku LIKE 'DAI-%' THEN 30 + (random() * 20)::int
    WHEN p.sku LIKE 'BAK-%' THEN 20 + (random() * 15)::int
    ELSE 25 + (random() * 20)::int
  END,
  10
FROM products p
CROSS JOIN branches b
WHERE p.org_id = '00000000-0000-0000-0000-000000000001'
  AND b.org_id = '00000000-0000-0000-0000-000000000001'
ON CONFLICT DO NOTHING;
