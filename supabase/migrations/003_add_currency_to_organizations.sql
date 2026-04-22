-- Add currency settings to organizations table
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS currency_code   TEXT NOT NULL DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS currency_locale TEXT NOT NULL DEFAULT 'en-US';
