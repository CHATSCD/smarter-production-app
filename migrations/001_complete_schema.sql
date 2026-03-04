-- ============================================================
-- Keith's Superstores Complete Database Schema
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- COMPANIES (Multi-Tenancy Support)
-- ============================================================
CREATE TABLE IF NOT EXISTS companies (
  id              VARCHAR(50) PRIMARY KEY,
  name            VARCHAR(255) NOT NULL,
  active          BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- STORES (Locations within companies)
-- ============================================================
CREATE TABLE IF NOT EXISTS stores (
  id              VARCHAR(50) PRIMARY KEY,
  company_id      VARCHAR(50) REFERENCES companies(id),
  name            VARCHAR(255) NOT NULL,
  address         TEXT,
  active          BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- USERS (with company and store support)
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            VARCHAR(255) NOT NULL,
  email           VARCHAR(255) UNIQUE NOT NULL,
  password_hash   TEXT NOT NULL,
  role            VARCHAR(20) NOT NULL CHECK (role IN ('super_admin', 'admin', 'manager', 'employee')),
  company_id      VARCHAR(50) REFERENCES companies(id),
  store_id        VARCHAR(50),
  pin             VARCHAR(10),
  active          BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_company ON users(company_id);
CREATE INDEX IF NOT EXISTS idx_users_store ON users(store_id);

-- ============================================================
-- SCHEDULING SETTINGS (per store)
-- ============================================================
CREATE TABLE IF NOT EXISTS scheduling_settings (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id          VARCHAR(50) UNIQUE NOT NULL,
  require_approval  BOOLEAN DEFAULT TRUE,
  max_hours_week    INT DEFAULT 40,
  min_shift_gap_hrs INT DEFAULT 8,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SHIFTS
-- ============================================================
CREATE TABLE IF NOT EXISTS shifts (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id          VARCHAR(50) NOT NULL,
  date              DATE NOT NULL,
  start_time        TIME NOT NULL,
  end_time          TIME NOT NULL,
  role_required     VARCHAR(100),
  station           VARCHAR(100),
  assigned_user_id  UUID REFERENCES users(id) ON DELETE SET NULL,
  claimed_by        UUID REFERENCES users(id) ON DELETE SET NULL,
  status            VARCHAR(20) NOT NULL DEFAULT 'unassigned'
                    CHECK (status IN ('unassigned','pending','approved','completed','locked')),
  waste_total       NUMERIC(10,2) DEFAULT 0,
  production_total  NUMERIC(10,2) DEFAULT 0,
  approval_required BOOLEAN DEFAULT TRUE,
  notes             TEXT,
  event_flag        BOOLEAN DEFAULT FALSE,
  event_note        TEXT,
  created_by        UUID REFERENCES users(id),
  approved_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  clock_in          TIMESTAMPTZ,
  clock_out         TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shifts_store_date ON shifts(store_id, date);
CREATE INDEX IF NOT EXISTS idx_shifts_assigned ON shifts(assigned_user_id);
CREATE INDEX IF NOT EXISTS idx_shifts_status ON shifts(status);

-- ============================================================
-- WASTE LOGS
-- ============================================================
CREATE TABLE IF NOT EXISTS waste_logs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shift_id    UUID NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  item_name   VARCHAR(255) NOT NULL,
  quantity    NUMERIC(10,2) NOT NULL,
  reason      VARCHAR(100),
  cost        NUMERIC(10,2) DEFAULT 0,
  logged_by   UUID REFERENCES users(id),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_waste_logs_shift ON waste_logs(shift_id);
CREATE INDEX IF NOT EXISTS idx_waste_logs_created ON waste_logs(created_at);

-- ============================================================
-- PRODUCTION LOGS
-- ============================================================
CREATE TABLE IF NOT EXISTS production_logs (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shift_id          UUID NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  item_name         VARCHAR(255) NOT NULL,
  quantity_produced NUMERIC(10,2) NOT NULL,
  cost              NUMERIC(10,2) DEFAULT 0,
  logged_by         UUID REFERENCES users(id),
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prod_logs_shift ON production_logs(shift_id);
CREATE INDEX IF NOT EXISTS idx_prod_logs_created ON production_logs(created_at);

-- ============================================================
-- SWAP REQUESTS
-- ============================================================
CREATE TABLE IF NOT EXISTS swap_requests (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shift_id     UUID NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  from_user_id UUID NOT NULL REFERENCES users(id),
  to_user_id   UUID REFERENCES users(id),
  status       VARCHAR(20) DEFAULT 'pending'
               CHECK (status IN ('pending','approved','denied')),
  message      TEXT,
  reviewed_by  UUID REFERENCES users(id),
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_swap_requests_shift ON swap_requests(shift_id);
CREATE INDEX IF NOT EXISTS idx_swap_requests_from_user ON swap_requests(from_user_id);
CREATE INDEX IF NOT EXISTS idx_swap_requests_to_user ON swap_requests(to_user_id);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        VARCHAR(50) NOT NULL,
  title       VARCHAR(255) NOT NULL,
  message     TEXT,
  read        BOOLEAN DEFAULT FALSE,
  shift_id    UUID REFERENCES shifts(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at);

-- ============================================================
-- PERFORMANCE METRICS VIEW
-- ============================================================
CREATE OR REPLACE VIEW employee_metrics AS
SELECT
  u.id AS user_id,
  u.name,
  u.company_id,
  u.store_id,
  COUNT(s.id) AS total_shifts,
  COALESCE(SUM(s.waste_total), 0) AS total_waste,
  COALESCE(SUM(s.production_total), 0) AS total_production,
  CASE
    WHEN COALESCE(SUM(s.production_total), 0) = 0 THEN 0
    ELSE ROUND(
      (COALESCE(SUM(s.waste_total), 0) / COALESCE(SUM(s.production_total), 1)) * 100, 2
    )
  END AS waste_ratio,
  CASE
    WHEN COALESCE(SUM(
      EXTRACT(EPOCH FROM (s.clock_out - s.clock_in)) / 3600
    ), 0) = 0 THEN 0
    ELSE ROUND(
      (COALESCE(SUM(s.production_total), 0) - COALESCE(SUM(s.waste_total), 0))
      / NULLIF(SUM(EXTRACT(EPOCH FROM (s.clock_out - s.clock_in)) / 3600), 0), 2
    )
  END AS efficiency_score
FROM users u
LEFT JOIN shifts s ON s.assigned_user_id = u.id
  AND s.status IN ('completed', 'locked')
WHERE u.active = TRUE
GROUP BY u.id, u.name, u.company_id, u.store_id;

-- ============================================================
-- SEED DATA
-- ============================================================

-- Insert default company
INSERT INTO companies (id, name)
VALUES ('company-01', 'Keith''s Superstores')
ON CONFLICT (id) DO NOTHING;

-- Insert default store
INSERT INTO stores (id, company_id, name)
VALUES ('store-01', 'company-01', 'Main Store')
ON CONFLICT (id) DO NOTHING;

-- Insert seed users
-- Password for all: "password123"
-- Hash: $2b$10$vlyNbuenBogsO2r6gt0WHeW6pwzodRPLVN2kODMebJMZiGYG6IjHW
INSERT INTO users (name, email, password_hash, role, company_id, store_id) VALUES
  ('Admin User',   'admin@keiths.com',   '$2b$10$vlyNbuenBogsO2r6gt0WHeW6pwzodRPLVN2kODMebJMZiGYG6IjHW', 'admin',    'company-01', 'store-01'),
  ('Manager Sue',  'manager@keiths.com', '$2b$10$vlyNbuenBogsO2r6gt0WHeW6pwzodRPLVN2kODMebJMZiGYG6IjHW', 'manager',  'company-01', 'store-01'),
  ('John Smith',   'john@keiths.com',    '$2b$10$vlyNbuenBogsO2r6gt0WHeW6pwzodRPLVN2kODMebJMZiGYG6IjHW', 'employee', 'company-01', 'store-01'),
  ('Jane Doe',     'jane@keiths.com',    '$2b$10$vlyNbuenBogsO2r6gt0WHeW6pwzodRPLVN2kODMebJMZiGYG6IjHW', 'employee', 'company-01', 'store-01')
ON CONFLICT (email) DO NOTHING;

-- Insert default scheduling settings
INSERT INTO scheduling_settings (store_id, require_approval)
VALUES ('store-01', true)
ON CONFLICT (store_id) DO NOTHING;

-- ============================================================
-- COMPLETION MESSAGE
-- ============================================================
DO $$
BEGIN
  RAISE NOTICE '✅ Database schema created successfully!';
  RAISE NOTICE '📊 Tables: companies, stores, users, shifts, waste_logs, production_logs, swap_requests, notifications';
  RAISE NOTICE '👤 Default users created (password: password123):';
  RAISE NOTICE '   - admin@keiths.com (Admin)';
  RAISE NOTICE '   - manager@keiths.com (Manager)';
  RAISE NOTICE '   - john@keiths.com (Employee)';
  RAISE NOTICE '   - jane@keiths.com (Employee)';
END $$;
