-- ============================================================================
-- FlexPay v2 Authoritative Schema Migration 0001_initial.sql
-- ============================================================================
-- Architecture Reference: blueprint.md v2.0.0 Section 7 & implementation_plan.md Phase 1
-- PostgreSQL 15+ compatible (Supabase)
-- Strict ACID guarantees, NUMERIC(14,2) monetary fields, and double-entry ledger
-- ============================================================================

-- Enable pgcrypto / uuid-ossp for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. ENUMS (Status & Category Types)
-- ----------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE merchant_category AS ENUM (
    'FOOD',
    'TRANSPORT',
    'HEALTH',
    'GROCERY',
    'FUEL',
    'EDUCATION'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE merchant_status AS ENUM (
    'PENDING_VERIFICATION',
    'ACTIVE',
    'SUSPENDED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE reset_status AS ENUM (
    'PENDING',
    'APPROVED',
    'REJECTED',
    'EXPIRED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE transaction_status AS ENUM (
    'PENDING',
    'CREDIT_RESERVED',
    'STK_SENT',
    'COMPLETED',
    'FAILED',
    'REFUNDED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE settlement_status AS ENUM (
    'PREVIEW',
    'RUNNING',
    'COMPLETED',
    'PARTIAL',
    'FAILED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ----------------------------------------------------------------------------
-- 2. Organizations
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS organizations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT NOT NULL,
  tin_number        TEXT UNIQUE NOT NULL,
  mpesa_shortcode   TEXT,
  contact_phone     TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_organizations_tin ON organizations(tin_number);
CREATE INDEX IF NOT EXISTS idx_organizations_status ON organizations(status);

-- ----------------------------------------------------------------------------
-- 3. Merchants
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS merchants (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name     TEXT NOT NULL,
  mpesa_number      TEXT NOT NULL UNIQUE,  -- The Safaricom Till/Paybill number
  category          merchant_category NOT NULL,
  contact_phone     TEXT NOT NULL,
  status            merchant_status NOT NULL DEFAULT 'PENDING_VERIFICATION',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_merchants_mpesa ON merchants(mpesa_number);
CREATE INDEX IF NOT EXISTS idx_merchants_category ON merchants(category);
CREATE INDEX IF NOT EXISTS idx_merchants_status ON merchants(status);

-- ----------------------------------------------------------------------------
-- 4. Employees
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS employees (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fp_employee_id    TEXT UNIQUE NOT NULL,  -- FP-ETH-YYYY-XXXXX-C
  organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  full_name         TEXT NOT NULL,
  phone_number      TEXT NOT NULL,          -- 251XXXXXXXXX (Safaricom)
  credit_limit      NUMERIC(14,2) NOT NULL DEFAULT 0,
  available_credit  NUMERIC(14,2) NOT NULL DEFAULT 0,
  department        TEXT,
  status            TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at        TIMESTAMPTZ,
  CONSTRAINT chk_credit_valid CHECK (
    available_credit >= 0 AND available_credit <= credit_limit
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_fp_id ON employees(fp_employee_id);
CREATE INDEX IF NOT EXISTS idx_employees_org ON employees(organization_id);
CREATE INDEX IF NOT EXISTS idx_employees_phone ON employees(phone_number);
CREATE INDEX IF NOT EXISTS idx_employees_status ON employees(status);

-- ----------------------------------------------------------------------------
-- 5. Users (Unified Authentication & RBAC)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role                  TEXT NOT NULL, -- ORG_ADMIN, ORG_CONTROLLER, MERCHANT_OWNER, MERCHANT_STAFF, EMPLOYEE, FLEXPAY_ADMIN
  organization_id       UUID REFERENCES organizations(id) ON DELETE CASCADE,
  merchant_id           UUID REFERENCES merchants(id) ON DELETE CASCADE,
  employee_id           UUID REFERENCES employees(id) ON DELETE CASCADE,
  password_hash         TEXT NOT NULL, -- Argon2id hash
  must_change_password  BOOLEAN NOT NULL DEFAULT FALSE,
  status                TEXT NOT NULL DEFAULT 'ACTIVE',
  last_login_at         TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_org ON users(organization_id);
CREATE INDEX IF NOT EXISTS idx_users_merchant ON users(merchant_id);
CREATE INDEX IF NOT EXISTS idx_users_employee ON users(employee_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- ----------------------------------------------------------------------------
-- 6. Refresh Tokens (Opaque SHA-256 Hashed Session Rotation)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL, -- SHA256 of the opaque token
  expires_at  TIMESTAMPTZ NOT NULL,
  revoked_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address  INET,
  user_agent  TEXT
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens(token_hash);

-- ----------------------------------------------------------------------------
-- 7. Organization Credit Policies
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS org_credit_policies (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id         UUID NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
  global_credit_limit     NUMERIC(14,2) NOT NULL DEFAULT 0,
  allowed_categories      TEXT[] NOT NULL DEFAULT '{}', -- e.g. '{FOOD,TRANSPORT}'
  max_daily_spend         NUMERIC(14,2),
  max_single_transaction  NUMERIC(14,2),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_credit_policies_org ON org_credit_policies(organization_id);

-- ----------------------------------------------------------------------------
-- 8. Password Reset Requests (Approval Workflow)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS password_reset_requests (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id       UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  requested_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_by       UUID REFERENCES users(id),
  reviewed_at       TIMESTAMPTZ,
  status            reset_status NOT NULL DEFAULT 'PENDING',
  delivery_method   TEXT NOT NULL DEFAULT 'SMS', -- SMS or MANUAL
  expires_at        TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '48 hours')
);

CREATE INDEX IF NOT EXISTS idx_pwd_reset_employee ON password_reset_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_pwd_reset_status ON password_reset_requests(status);

-- ----------------------------------------------------------------------------
-- 9. Transactions
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS transactions (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fp_transaction_ref        TEXT UNIQUE NOT NULL, -- FP-TXN-XXXXXXXXXX
  employee_id               UUID NOT NULL REFERENCES employees(id),
  merchant_id               UUID NOT NULL REFERENCES merchants(id),
  organization_id           UUID NOT NULL REFERENCES organizations(id),
  -- Snapshots at transaction time (denormalized for audit integrity)
  employee_fp_id_snapshot   TEXT NOT NULL,
  employee_name_snapshot    TEXT NOT NULL,
  employee_phone_snapshot   TEXT NOT NULL,
  org_name_snapshot         TEXT NOT NULL,
  merchant_name_snapshot    TEXT NOT NULL,
  merchant_mpesa_snapshot   TEXT NOT NULL,
  category_snapshot         TEXT NOT NULL,
  -- Financial fields
  total_amount              NUMERIC(14,2) NOT NULL,
  credit_portion            NUMERIC(14,2) NOT NULL DEFAULT 0,
  copay_portion             NUMERIC(14,2) NOT NULL DEFAULT 0,
  -- M-PESA tracking
  stk_checkout_request_id   TEXT,
  mpesa_receipt             TEXT,
  -- Status
  status                    transaction_status NOT NULL DEFAULT 'PENDING',
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_amounts_add_up CHECK (credit_portion + copay_portion = total_amount)
);

CREATE INDEX IF NOT EXISTS idx_txn_employee ON transactions(employee_id);
CREATE INDEX IF NOT EXISTS idx_txn_merchant ON transactions(merchant_id);
CREATE INDEX IF NOT EXISTS idx_txn_org ON transactions(organization_id);
CREATE INDEX IF NOT EXISTS idx_txn_created ON transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_txn_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_txn_ref ON transactions(fp_transaction_ref);
CREATE INDEX IF NOT EXISTS idx_txn_stk_id ON transactions(stk_checkout_request_id);

-- ----------------------------------------------------------------------------
-- 10. Journal Entries (Double-Entry Financial Ledger - Append Only)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS journal_entries (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id    UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  account_type      TEXT NOT NULL, -- EMPLOYEE_CREDIT, MERCHANT_RECEIVABLE, MPESA_CLEARING
  debit_amount      NUMERIC(14,2) NOT NULL DEFAULT 0,
  credit_amount     NUMERIC(14,2) NOT NULL DEFAULT 0,
  description       TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
  -- NOTE: No updated_at column. This table is strictly append-only.
);

CREATE INDEX IF NOT EXISTS idx_journal_txn ON journal_entries(transaction_id);
CREATE INDEX IF NOT EXISTS idx_journal_account ON journal_entries(account_type);

-- ----------------------------------------------------------------------------
-- 11. Payroll Settlements
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payroll_settlements (
  id                                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id                   UUID NOT NULL REFERENCES organizations(id),
  period_start                      DATE NOT NULL,
  period_end                        DATE NOT NULL,
  status                            settlement_status NOT NULL DEFAULT 'PREVIEW',
  total_merchant_disbursements      NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_employee_disbursements      NUMERIC(14,2) NOT NULL DEFAULT 0,
  initiated_by                      UUID REFERENCES users(id),
  initiated_at                      TIMESTAMPTZ,
  completed_at                      TIMESTAMPTZ,
  created_at                        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_settlements_org ON payroll_settlements(organization_id);
CREATE INDEX IF NOT EXISTS idx_settlements_status ON payroll_settlements(status);

-- ----------------------------------------------------------------------------
-- 12. Payroll Disbursement Lines (Individual Wire Transfers)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payroll_disbursement_lines (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_id           UUID NOT NULL REFERENCES payroll_settlements(id) ON DELETE CASCADE,
  recipient_type          TEXT NOT NULL, -- 'MERCHANT' or 'EMPLOYEE'
  merchant_id             UUID REFERENCES merchants(id),
  employee_id             UUID REFERENCES employees(id),
  recipient_mpesa_number  TEXT NOT NULL,
  amount                  NUMERIC(14,2) NOT NULL,
  status                  TEXT NOT NULL DEFAULT 'PENDING',
  mpesa_conversation_id   TEXT,
  mpesa_receipt           TEXT,
  dispatched_at           TIMESTAMPTZ,
  completed_at            TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_disbursement_settlement ON payroll_disbursement_lines(settlement_id);
CREATE INDEX IF NOT EXISTS idx_disbursement_recipient ON payroll_disbursement_lines(recipient_type);

-- ----------------------------------------------------------------------------
-- 13. Audit Log (Append-Only Event Ledger)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id   UUID,
  actor_role      TEXT,
  action          TEXT NOT NULL, -- e.g. 'employee.create', 'credit.update'
  target_table    TEXT,
  target_id       UUID,
  old_value       JSONB,
  new_value       JSONB,
  ip_address      INET,
  user_agent      TEXT,
  request_id      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
  -- Strictly append-only
);

CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_log(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at DESC);

-- ----------------------------------------------------------------------------
-- 14. Idempotency Keys
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS idempotency_keys (
  key         TEXT PRIMARY KEY,
  response    JSONB NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at  TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_idempotency_expires ON idempotency_keys(expires_at);

-- ----------------------------------------------------------------------------
-- 15. Triggers for Automatic updated_at timestamps
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_organizations_updated_at ON organizations;
CREATE TRIGGER trg_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_merchants_updated_at ON merchants;
CREATE TRIGGER trg_merchants_updated_at
  BEFORE UPDATE ON merchants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_employees_updated_at ON employees;
CREATE TRIGGER trg_employees_updated_at
  BEFORE UPDATE ON employees
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_org_credit_policies_updated_at ON org_credit_policies;
CREATE TRIGGER trg_org_credit_policies_updated_at
  BEFORE UPDATE ON org_credit_policies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_transactions_updated_at ON transactions;
CREATE TRIGGER trg_transactions_updated_at
  BEFORE UPDATE ON transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
