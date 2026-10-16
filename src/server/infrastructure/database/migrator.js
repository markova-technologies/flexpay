const fs = require('node:fs');
const path = require('node:path');
const { getPool } = require('./client');

/**
 * Ensures the PostgreSQL database has the authoritative v2 schema.
 * Runs non-destructive incremental column synchronization for existing tables
 * and creates all required tables, enums, and indexes if missing.
 */
async function ensureSchema() {
  let pool;
  try {
    pool = getPool();
  } catch (err) {
    console.warn('[Migrator] Unable to initialize database pool for schema verification:', err.message);
    return;
  }

  try {
    // 1. Extensions & Enums
    await pool.query(`
      CREATE EXTENSION IF NOT EXISTS "pgcrypto";

      DO $$ BEGIN
        CREATE TYPE merchant_category AS ENUM (
          'FOOD', 'TRANSPORT', 'HEALTH', 'GROCERY', 'FUEL', 'EDUCATION'
        );
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;

      DO $$ BEGIN
        CREATE TYPE merchant_status AS ENUM (
          'PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED'
        );
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;

      DO $$ BEGIN
        CREATE TYPE reset_status AS ENUM (
          'PENDING', 'APPROVED', 'REJECTED', 'EXPIRED'
        );
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;

      DO $$ BEGIN
        CREATE TYPE transaction_status AS ENUM (
          'PENDING', 'CREDIT_RESERVED', 'STK_SENT', 'COMPLETED', 'FAILED', 'REFUNDED'
        );
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;

      DO $$ BEGIN
        CREATE TYPE settlement_status AS ENUM (
          'PREVIEW', 'RUNNING', 'COMPLETED', 'PARTIAL', 'FAILED'
        );
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    // 2. Incremental column synchronization for existing tables
    await pool.query(`
      DO $$ BEGIN
        -- Employees table
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'employees') THEN
          ALTER TABLE employees ADD COLUMN IF NOT EXISTS fp_employee_id TEXT;
          ALTER TABLE employees ADD COLUMN IF NOT EXISTS organization_id UUID;
          ALTER TABLE employees ADD COLUMN IF NOT EXISTS full_name TEXT;
          ALTER TABLE employees ADD COLUMN IF NOT EXISTS phone_number TEXT;
          ALTER TABLE employees ADD COLUMN IF NOT EXISTS credit_limit NUMERIC(14,2) NOT NULL DEFAULT 0;
          ALTER TABLE employees ADD COLUMN IF NOT EXISTS available_credit NUMERIC(14,2) NOT NULL DEFAULT 0;
          ALTER TABLE employees ADD COLUMN IF NOT EXISTS department TEXT;
          ALTER TABLE employees ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'ACTIVE';
          ALTER TABLE employees ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
          ALTER TABLE employees ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

          -- Data migration from legacy v1 columns if applicable
          BEGIN
            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'employees' AND column_name = 'name') THEN
              UPDATE employees SET full_name = name WHERE full_name IS NULL;
            END IF;
            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'employees' AND column_name = 'phone') THEN
              UPDATE employees SET phone_number = phone WHERE phone_number IS NULL;
            END IF;
          EXCEPTION WHEN OTHERS THEN NULL;
          END;

          CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_fp_id ON employees(fp_employee_id);
          CREATE INDEX IF NOT EXISTS idx_employees_org ON employees(organization_id);
          CREATE INDEX IF NOT EXISTS idx_employees_phone ON employees(phone_number);
          CREATE INDEX IF NOT EXISTS idx_employees_status ON employees(status);
        END IF;

        -- Password reset requests table
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'password_reset_requests') THEN
          ALTER TABLE password_reset_requests ADD COLUMN IF NOT EXISTS requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
          ALTER TABLE password_reset_requests ADD COLUMN IF NOT EXISTS reviewed_by UUID;
          ALTER TABLE password_reset_requests ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
          ALTER TABLE password_reset_requests ADD COLUMN IF NOT EXISTS delivery_method TEXT NOT NULL DEFAULT 'SMS';
          ALTER TABLE password_reset_requests ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '48 hours');
          
          BEGIN
            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'password_reset_requests' AND column_name = 'created_at') THEN
              UPDATE password_reset_requests SET requested_at = created_at WHERE requested_at IS NULL;
            END IF;
          EXCEPTION WHEN OTHERS THEN NULL;
          END;

          CREATE INDEX IF NOT EXISTS idx_pwd_reset_employee ON password_reset_requests(employee_id);
          CREATE INDEX IF NOT EXISTS idx_pwd_reset_status ON password_reset_requests(status);
        END IF;

        -- Refresh tokens table
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'refresh_tokens') THEN
          ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;
          ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS ip_address INET;
          ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS user_agent TEXT;
          BEGIN
            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'refresh_tokens' AND column_name = 'revoked') THEN
              UPDATE refresh_tokens SET revoked_at = NOW() WHERE revoked = TRUE AND revoked_at IS NULL;
            END IF;
          EXCEPTION WHEN OTHERS THEN NULL;
          END;
        END IF;

        -- Users table
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
          ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT;
          ALTER TABLE users ADD COLUMN IF NOT EXISTS organization_id UUID;
          ALTER TABLE users ADD COLUMN IF NOT EXISTS merchant_id UUID;
          ALTER TABLE users ADD COLUMN IF NOT EXISTS employee_id UUID;
          ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
          ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE;
          ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'ACTIVE';
          ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;
          ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
        END IF;

        -- Organizations table
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'organizations') THEN
          ALTER TABLE organizations ADD COLUMN IF NOT EXISTS tin_number TEXT;
          ALTER TABLE organizations ADD COLUMN IF NOT EXISTS mpesa_shortcode TEXT;
          ALTER TABLE organizations ADD COLUMN IF NOT EXISTS contact_phone TEXT;
          ALTER TABLE organizations ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'ACTIVE';
          ALTER TABLE organizations ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
          ALTER TABLE organizations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
        END IF;

        -- Merchants table
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'merchants') THEN
          ALTER TABLE merchants ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
          ALTER TABLE merchants ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
          BEGIN
            ALTER TABLE merchants ALTER COLUMN status SET DEFAULT 'ACTIVE'::merchant_status;
          EXCEPTION WHEN OTHERS THEN NULL;
          END;
        END IF;

        -- Org Credit Policies table
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'org_credit_policies') THEN
          ALTER TABLE org_credit_policies ADD COLUMN IF NOT EXISTS requires_admin_approval_above NUMERIC(14,2);
          ALTER TABLE org_credit_policies ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
        END IF;
      END $$;
    `);

    // 3. Create missing tables if they do not exist
    await pool.query(`
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

      CREATE TABLE IF NOT EXISTS merchants (
        id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        business_name     TEXT NOT NULL,
        mpesa_number      TEXT NOT NULL UNIQUE,
        category          merchant_category NOT NULL,
        contact_phone     TEXT NOT NULL,
        status            merchant_status NOT NULL DEFAULT 'ACTIVE',
        created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at        TIMESTAMPTZ
      );

      CREATE TABLE IF NOT EXISTS employees (
        id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        fp_employee_id    TEXT UNIQUE NOT NULL,
        organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
        full_name         TEXT NOT NULL,
        phone_number      TEXT NOT NULL,
        credit_limit      NUMERIC(14,2) NOT NULL DEFAULT 0,
        available_credit  NUMERIC(14,2) NOT NULL DEFAULT 0,
        department        TEXT,
        status            TEXT NOT NULL DEFAULT 'ACTIVE',
        created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at        TIMESTAMPTZ
      );

      CREATE TABLE IF NOT EXISTS users (
        id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        role                  TEXT NOT NULL,
        organization_id       UUID REFERENCES organizations(id) ON DELETE CASCADE,
        merchant_id           UUID REFERENCES merchants(id) ON DELETE CASCADE,
        employee_id           UUID REFERENCES employees(id) ON DELETE CASCADE,
        password_hash         TEXT NOT NULL,
        must_change_password  BOOLEAN NOT NULL DEFAULT FALSE,
        status                TEXT NOT NULL DEFAULT 'ACTIVE',
        last_login_at         TIMESTAMPTZ,
        created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash  TEXT NOT NULL,
        expires_at  TIMESTAMPTZ NOT NULL,
        revoked_at  TIMESTAMPTZ,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        ip_address  INET,
        user_agent  TEXT
      );

      CREATE TABLE IF NOT EXISTS org_credit_policies (
        id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id         UUID NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
        global_credit_limit     NUMERIC(14,2) NOT NULL DEFAULT 0,
        allowed_categories      TEXT[] NOT NULL DEFAULT '{}',
        max_daily_spend         NUMERIC(14,2),
        max_single_transaction  NUMERIC(14,2),
        requires_admin_approval_above NUMERIC(14,2),
        created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS password_reset_requests (
        id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        employee_id       UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
        requested_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        reviewed_by       UUID REFERENCES users(id),
        reviewed_at       TIMESTAMPTZ,
        status            reset_status NOT NULL DEFAULT 'PENDING',
        delivery_method   TEXT NOT NULL DEFAULT 'SMS',
        expires_at        TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '48 hours')
      );

      CREATE TABLE IF NOT EXISTS transactions (
        id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        fp_transaction_ref        TEXT UNIQUE NOT NULL,
        employee_id               UUID NOT NULL REFERENCES employees(id),
        merchant_id               UUID NOT NULL REFERENCES merchants(id),
        organization_id           UUID NOT NULL REFERENCES organizations(id),
        employee_fp_id_snapshot   TEXT NOT NULL,
        employee_name_snapshot    TEXT NOT NULL,
        employee_phone_snapshot   TEXT NOT NULL,
        org_name_snapshot         TEXT NOT NULL,
        merchant_name_snapshot    TEXT NOT NULL,
        merchant_mpesa_snapshot   TEXT NOT NULL,
        category_snapshot         TEXT NOT NULL,
        total_amount              NUMERIC(14,2) NOT NULL,
        credit_portion            NUMERIC(14,2) NOT NULL DEFAULT 0,
        copay_portion             NUMERIC(14,2) NOT NULL DEFAULT 0,
        stk_checkout_request_id   TEXT,
        mpesa_receipt             TEXT,
        status                    transaction_status NOT NULL DEFAULT 'PENDING',
        created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS journal_entries (
        id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        transaction_id    UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
        account_type      TEXT NOT NULL,
        debit_amount      NUMERIC(14,2) NOT NULL DEFAULT 0,
        credit_amount     NUMERIC(14,2) NOT NULL DEFAULT 0,
        description       TEXT,
        created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

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

      CREATE TABLE IF NOT EXISTS payroll_disbursement_lines (
        id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        settlement_id           UUID NOT NULL REFERENCES payroll_settlements(id) ON DELETE CASCADE,
        recipient_type          TEXT NOT NULL,
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

      CREATE TABLE IF NOT EXISTS audit_log (
        id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        actor_id          UUID,
        actor_role        TEXT,
        action            TEXT NOT NULL,
        entity_type       TEXT NOT NULL,
        entity_id         TEXT,
        payload_snapshot  JSONB,
        ip_address        INET,
        created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS idempotency_keys (
        key               TEXT PRIMARY KEY,
        request_path      TEXT NOT NULL,
        response_code     INTEGER NOT NULL,
        response_body     JSONB NOT NULL,
        created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        expires_at        TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours')
      );
    `);

    // 4. Verify critical columns across key tables
    const verification = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'tin_number') as has_tin,
        (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'employees' AND column_name = 'fp_employee_id') as has_fp_id,
        (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'password_reset_requests' AND column_name = 'requested_at') as has_requested_at,
        (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'refresh_tokens' AND column_name = 'revoked_at') as has_revoked_at
    `);

    const row = verification.rows[0];
    if (row && Number(row.has_tin) > 0 && Number(row.has_fp_id) > 0 && Number(row.has_requested_at) > 0 && Number(row.has_revoked_at) > 0) {
      console.log('[Migrator] FlexPay v2 schema is fully verified and up-to-date.');
    } else {
      console.warn('[Migrator] Partial schema verification detected:', row);
    }
  } catch (err) {
    console.error('[Migrator] Database schema verification or migration failed:', err.message);
  }
}

module.exports = { ensureSchema };
