-- ============================================================
-- Migration 002: Add Company Multi-Tenancy Support
-- ============================================================

-- Add company_id column to users
ALTER TABLE users
ADD COLUMN IF NOT EXISTS company_id VARCHAR(50);

-- Update role constraint to include super_admin
ALTER TABLE users
DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE users
ADD CONSTRAINT users_role_check
CHECK (role IN ('super_admin', 'admin', 'manager', 'employee'));

-- Create companies table (optional, for future expansion)
CREATE TABLE IF NOT EXISTS companies (
  id              VARCHAR(50) PRIMARY KEY,
  name            VARCHAR(255) NOT NULL,
  active          BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Create stores table to link stores to companies
CREATE TABLE IF NOT EXISTS stores (
  id              VARCHAR(50) PRIMARY KEY,
  company_id      VARCHAR(50) REFERENCES companies(id),
  name            VARCHAR(255) NOT NULL,
  address         TEXT,
  active          BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default company and store
INSERT INTO companies (id, name)
VALUES ('company-01', 'Keith''s Superstores')
ON CONFLICT (id) DO NOTHING;

INSERT INTO stores (id, company_id, name)
VALUES ('store-01', 'company-01', 'Main Store')
ON CONFLICT (id) DO NOTHING;

-- Update existing users to have company_id
UPDATE users
SET company_id = 'company-01'
WHERE company_id IS NULL AND role != 'super_admin';

-- Leave super_admin users with NULL company_id (they can access all companies)
