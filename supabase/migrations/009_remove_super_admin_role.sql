-- Migrate existing super_admin users to owner role
UPDATE profiles SET role = 'owner' WHERE role = 'super_admin';

-- Recreate the user_role enum without super_admin.
-- Postgres doesn't support removing enum values directly, so we rename the
-- old type, create a new one, migrate the column, then drop the old type.

-- Drop the column default first (it references the old enum type)
ALTER TABLE profiles ALTER COLUMN role DROP DEFAULT;

ALTER TYPE user_role RENAME TO user_role_old;

CREATE TYPE user_role AS ENUM ('owner', 'manager', 'cashier');

ALTER TABLE profiles
  ALTER COLUMN role TYPE user_role
  USING role::text::user_role;

-- Restore the default
ALTER TABLE profiles ALTER COLUMN role SET DEFAULT 'cashier';

DROP TYPE user_role_old;
