-- ============================================================================
-- FlexPay Supabase PostgreSQL Schema & Initial Demo Data
-- ============================================================================
-- Designed for Supabase / PostgreSQL on Render backend deployment.
-- Strict ACID constraints, foreign key cascades, and double-entry ledger tables.
-- ============================================================================

-- Enable UUID extension if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ----------------------------------------------------------------------------
-- 1. Organizations (Employers)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS organizations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    benefit_pool_etb NUMERIC(15, 2) NOT NULL DEFAULT 0,
    used_pool_etb NUMERIC(15, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 2. Merchants & POS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS merchants (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    allowed_categories JSONB NOT NULL DEFAULT '["GROCERY", "MEAL"]'::jsonb,
    short_code TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 3. Employees
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS employees (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT NOT NULL UNIQUE,
    employer_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    employer_name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 4. Multi-Role System Users & Auth
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    pin_hash TEXT NOT NULL,
    role TEXT NOT NULL, -- 'EMPLOYEE' | 'EMPLOYER_ADMIN' | 'MERCHANT_CASHIER' | 'OPS_AUDITOR'
    entity_id TEXT NOT NULL,
    name TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS auth_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 5. Benefit Accounts & Wallets
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS benefit_accounts (
    employee_id TEXT PRIMARY KEY REFERENCES employees(id) ON DELETE CASCADE,
    employer_name TEXT NOT NULL,
    total_allowance_etb NUMERIC(15, 2) NOT NULL,
    used_allowance_etb NUMERIC(15, 2) NOT NULL DEFAULT 0,
    salary_link_limit_etb NUMERIC(15, 2) NOT NULL DEFAULT 0,
    used_salary_link_etb NUMERIC(15, 2) NOT NULL DEFAULT 0,
    expires_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS benefit_wallets (
    id TEXT PRIMARY KEY,
    employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    category TEXT NOT NULL, -- 'FOOD' | 'TRANSPORT' | 'HEALTH'
    monthly_limit_etb NUMERIC(15, 2) NOT NULL,
    used_etb NUMERIC(15, 2) NOT NULL DEFAULT 0,
    cycle_reset_date TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_employee_wallet_category UNIQUE (employee_id, category)
);

CREATE TABLE IF NOT EXISTS benefit_policies (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    category TEXT NOT NULL, -- 'FOOD' | 'TRANSPORT' | 'HEALTH'
    monthly_limit_etb NUMERIC(15, 2) NOT NULL,
    eligible_merchant_categories JSONB NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_org_policy_category UNIQUE (org_id, category)
);

-- ----------------------------------------------------------------------------
-- 6. Orders & Checkout Intent
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    employee_id TEXT NOT NULL REFERENCES employees(id),
    merchant_id TEXT NOT NULL REFERENCES merchants(id),
    customer_phone TEXT NOT NULL,
    total_etb NUMERIC(15, 2) NOT NULL,
    benefit_covered_etb NUMERIC(15, 2) NOT NULL,
    employee_copay_etb NUMERIC(15, 2) NOT NULL,
    is_eligible INTEGER NOT NULL DEFAULT 1,
    rejection_reason TEXT,
    items_json JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 7. Payment Records (M-PESA Orchestration)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payment_records (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL REFERENCES orders(id),
    employee_id TEXT NOT NULL REFERENCES employees(id),
    merchant_id TEXT NOT NULL REFERENCES merchants(id),
    total_etb NUMERIC(15, 2) NOT NULL,
    benefit_etb NUMERIC(15, 2) NOT NULL,
    mpesa_etb NUMERIC(15, 2) NOT NULL,
    status TEXT NOT NULL, -- 'PENDING_AUTHORIZATION' | 'PENDING_MPESA_CALLBACK' | 'COMPLETED' | 'FAILED_REJECTED' | 'FAILED_TIMEOUT' | 'REVERSED'
    merchant_request_id TEXT UNIQUE,
    checkout_request_id TEXT UNIQUE,
    mpesa_receipt_number TEXT,
    refund_reason TEXT,
    raw_callback_json JSONB,
    benefit_breakdown_json JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 8. Double-Entry Financial Ledger
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS journal_entries (
    id TEXT PRIMARY KEY,
    payment_id TEXT NOT NULL REFERENCES payment_records(id),
    account_type TEXT NOT NULL, -- 'ASSET_MPESA_CLEARING' | 'LIABILITY_EMPLOYER_BENEFIT' | 'LIABILITY_MERCHANT_PAYABLE'
    debit_etb NUMERIC(15, 2) NOT NULL DEFAULT 0,
    credit_etb NUMERIC(15, 2) NOT NULL DEFAULT 0,
    label TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 9. Idempotent Webhook Events
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS webhook_events (
    id TEXT PRIMARY KEY,
    checkout_request_id TEXT NOT NULL,
    result_code INTEGER NOT NULL,
    payload_json JSONB NOT NULL,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- Indexes for Fast Querying & Low Latency
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_employees_phone ON employees(phone);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_orders_employee ON orders(employee_id);
CREATE INDEX IF NOT EXISTS idx_orders_merchant ON orders(merchant_id);
CREATE INDEX IF NOT EXISTS idx_payments_order ON payment_records(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_checkout_req ON payment_records(checkout_request_id);
CREATE INDEX IF NOT EXISTS idx_journal_payment ON journal_entries(payment_id);
CREATE INDEX IF NOT EXISTS idx_journal_account ON journal_entries(account_type);

-- ============================================================================
-- SEED INITIAL DATA (Matches Local Demo Dataset)
-- ============================================================================

-- 1. Organizations
INSERT INTO organizations (id, name, benefit_pool_etb, used_pool_etb, created_at)
VALUES 
    ('org-001', 'Ethio Telecom', 500000.00, 145000.00, NOW()),
    ('org-002', 'Commercial Bank of Ethiopia', 750000.00, 210000.00, NOW())
ON CONFLICT (id) DO NOTHING;

-- 2. Merchants
INSERT INTO merchants (id, name, category, status, allowed_categories, short_code, created_at)
VALUES
    ('mer-001', 'Yod Abyssinia Market', 'GROCERY', 'ACTIVE', '["GROCERY", "MEAL"]'::jsonb, '2005', NOW()),
    ('mer-002', 'Electronics Paradise', 'ELECTRONICS', 'ACTIVE', '["GROCERY", "MEAL"]'::jsonb, '2006', NOW()),
    ('mer-003', 'Addis Café', 'MEAL', 'ACTIVE', '["GROCERY", "MEAL"]'::jsonb, '2007', NOW())
ON CONFLICT (id) DO NOTHING;

-- 3. Employees
INSERT INTO employees (id, name, phone, employer_id, employer_name, created_at)
VALUES
    ('emp-001', 'Abebe Kebede', '251912345678', 'org-001', 'Ethio Telecom', NOW()),
    ('emp-002', 'Sara Haile', '251911987654', 'org-002', 'Commercial Bank of Ethiopia', NOW())
ON CONFLICT (id) DO NOTHING;

-- 4. Benefit Accounts
INSERT INTO benefit_accounts (employee_id, employer_name, total_allowance_etb, used_allowance_etb, salary_link_limit_etb, used_salary_link_etb, expires_at, updated_at)
VALUES
    ('emp-001', 'Ethio Telecom', 3000.00, 1500.00, 2000.00, 0.00, NOW() + INTERVAL '30 days', NOW()),
    ('emp-002', 'Commercial Bank of Ethiopia', 4500.00, 800.00, 3000.00, 0.00, NOW() + INTERVAL '30 days', NOW())
ON CONFLICT (employee_id) DO NOTHING;

-- 5. Benefit Wallets (Category-Locked)
INSERT INTO benefit_wallets (id, employee_id, category, monthly_limit_etb, used_etb, cycle_reset_date, updated_at)
VALUES
    ('wal-001', 'emp-001', 'FOOD', 1500.00, 0.00, NOW() + INTERVAL '30 days', NOW()),
    ('wal-002', 'emp-001', 'TRANSPORT', 800.00, 0.00, NOW() + INTERVAL '30 days', NOW()),
    ('wal-003', 'emp-001', 'HEALTH', 700.00, 0.00, NOW() + INTERVAL '30 days', NOW()),
    ('wal-004', 'emp-002', 'FOOD', 2000.00, 300.00, NOW() + INTERVAL '30 days', NOW()),
    ('wal-005', 'emp-002', 'TRANSPORT', 1500.00, 500.00, NOW() + INTERVAL '30 days', NOW()),
    ('wal-006', 'emp-002', 'HEALTH', 1000.00, 0.00, NOW() + INTERVAL '30 days', NOW())
ON CONFLICT (id) DO NOTHING;

-- 6. Benefit Policies
INSERT INTO benefit_policies (id, org_id, category, monthly_limit_etb, eligible_merchant_categories, is_active, created_at)
VALUES
    ('pol-001', 'org-001', 'FOOD', 1500.00, '["GROCERY", "MEAL"]'::jsonb, 1, NOW()),
    ('pol-002', 'org-001', 'TRANSPORT', 800.00, '["TRANSPORT", "COMMUTE", "FUEL"]'::jsonb, 1, NOW()),
    ('pol-003', 'org-001', 'HEALTH', 700.00, '["PHARMACY", "CLINIC", "HOSPITAL"]'::jsonb, 1, NOW())
ON CONFLICT (id) DO NOTHING;

-- 7. Multi-Role Demo Users (All PINs are 1234 -> SHA256 hashed with salt 'flexpay_salt_2026')
-- Hash for '1234' with HMAC-SHA256 salt 'flexpay_salt_2026':
-- b08871ceb27cb09d3b10b37e8c3866cfa18ceb26707833075677aa89617300c0
INSERT INTO users (id, email, pin_hash, role, entity_id, name, is_active, created_at)
VALUES
    ('usr-001', 'employee@telecom.et', 'b08871ceb27cb09d3b10b37e8c3866cfa18ceb26707833075677aa89617300c0', 'EMPLOYEE', 'emp-001', 'Abebe Kebede (Employee)', 1, NOW()),
    ('usr-002', 'hr@telecom.et', 'b08871ceb27cb09d3b10b37e8c3866cfa18ceb26707833075677aa89617300c0', 'EMPLOYER_ADMIN', 'org-001', 'Sara Tadesse (HR Director)', 1, NOW()),
    ('usr-003', 'pos@bunaye.et', 'b08871ceb27cb09d3b10b37e8c3866cfa18ceb26707833075677aa89617300c0', 'MERCHANT_CASHIER', 'mer-001', 'Yod Abyssinia POS', 1, NOW()),
    ('usr-004', 'ops@flexpay.et', 'b08871ceb27cb09d3b10b37e8c3866cfa18ceb26707833075677aa89617300c0', 'OPS_AUDITOR', 'flexpay-core', 'Almaz Girma (Ops Auditor)', 1, NOW())
ON CONFLICT (id) DO NOTHING;
