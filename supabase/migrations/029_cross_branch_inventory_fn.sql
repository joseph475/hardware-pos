-- Returns all inventory rows joined with product name/sku as a single JSON array.
-- Using json return type avoids PostgREST's max-rows limit entirely.
CREATE OR REPLACE FUNCTION get_cross_branch_inventory()
RETURNS json
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_agg(r ORDER BY r.product_name, r.branch_id)
  FROM (
    SELECT
      i.product_id,
      p.name  AS product_name,
      p.sku,
      i.branch_id,
      i.quantity
    FROM inventory i
    JOIN products p ON p.id = i.product_id
  ) r;
$$;
