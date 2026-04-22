-- Add manager override PIN to organizations table
-- Stored as SHA-256 hash (salted with org_id). NULL means no PIN configured.
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS manager_override_pin TEXT;
