Create a new Supabase SQL migration file for this project.

The argument describes the schema change, e.g. `/new-migration add tax_rates table` or `/new-migration add index on transactions created_at`.

Steps:
1. Check existing migrations in `supabase/migrations/` to understand the current schema and find the next migration number
2. Create `supabase/migrations/00N_<descriptive_name>.sql`
3. Write clean, safe SQL

Rules for this project:
- All tables need `org_id uuid REFERENCES organizations(id)` (except join/item tables)
- Use `gen_random_uuid()` for primary keys: `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
- Always include `created_at timestamptz DEFAULT now()`
- Add `updated_at timestamptz DEFAULT now()` on tables that get updated
- Foreign keys should have `ON DELETE CASCADE` or `ON DELETE SET NULL` depending on intent
- Add indexes on columns used in WHERE clauses (especially `org_id`, `branch_id`, `status`)
- Use `IF NOT EXISTS` on CREATE TABLE

Also update `types/database.ts` to add the new table's Row/Insert/Update types and export the convenience type alias at the bottom.

Show the SQL and type changes together.
