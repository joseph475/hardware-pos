-- Add 'owner' value to the user_role enum.
-- Note: ALTER TYPE ... ADD VALUE is non-transactional in Postgres and cannot
-- be executed inside a BEGIN/COMMIT block.
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'owner';
