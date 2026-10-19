const fs = require('node:fs');
const path = require('node:path');
const { getPool } = require('./client');

/**
 * Ensures the PostgreSQL database has the authoritative v2 schema.
 * Permanently removes legacy NOT NULL constraints on deprecated columns,
 * synchronizes all required v2 columns, and installs legacy compatibility triggers.
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
        ALTER TYPE merchant_category ADD VALUE IF NOT EXISTS 'FOOD';
        ALTER TYPE merchant_category ADD VALUE IF NOT EXISTS 'TRANSPORT';
        ALTER TYPE merchant_category ADD VALUE IF NOT EXISTS 'HEALTH';
        ALTER TYPE merchant_category ADD VALUE IF NOT EXISTS 'GROCERY';
        ALTER TYPE merchant_category ADD VALUE IF NOT EXISTS 'FUEL';
        ALTER TYPE merchant_category ADD VALUE IF NOT EXISTS 'EDUCATION';
      EXCEPTION WHEN OTHERS THEN NULL;
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
        ALTER TYPE transaction_status ADD VALUE IF NOT EXISTS 'PENDING';
        ALTER TYPE transaction_status ADD VALUE IF NOT EXISTS 'CREDIT_RESERVED';
        ALTER TYPE transaction_status ADD VALUE IF NOT EXISTS 'STK_SENT';
        ALTER TYPE transaction_status ADD VALUE IF NOT EXISTS 'COMPLETED';
        ALTER TYPE transaction_status ADD VALUE IF NOT EXISTS 'FAILED';
        ALTER TYPE transaction_status ADD VALUE IF NOT EXISTS 'REFUNDED';
      EXCEPTION WHEN OTHERS THEN NULL;
      END $$;

      DO $$ BEGIN
        CREATE TYPE settlement_status AS ENUM (
          'PREVIEW', 'RUNNING', 'COMPLETED', 'PARTIAL', 'FAILED'
        );
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    // 2. Incremental column synchronization & legacy NOT NULL removal
    await pool.query(`
      DO $$ 
      DECLARE
        col text;
        allowed_cols text[];
      BEGIN
        -- --------------------------------------------------------------------
        -- A. Employees Table
        -- --------------------------------------------------------------------
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'employees') THEN
          -- Add required v2 columns
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

          -- Permanently drop NOT NULL from any legacy non-v2 column (e.g. fp_id, employer_id, employer_name, name, phone)
          allowed_cols := ARRAY['id', 'fp_employee_id', 'organization_id', 'full_name', 'phone_number', 'credit_limit', 'available_credit', 'department', 'status', 'created_at', 'updated_at', 'deleted_at'];
          FOR col IN (
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'employees' 
              AND is_nullable = 'NO'
              AND column_name != ALL(allowed_cols)
          ) LOOP
            BEGIN
              EXECUTE 'ALTER TABLE employees ALTER COLUMN ' || quote_ident(col) || ' DROP NOT NULL';
              EXECUTE 'ALTER TABLE employees ALTER COLUMN ' || quote_ident(col) || ' SET DEFAULT NULL';
            EXCEPTION WHEN OTHERS THEN NULL;
            END;
          END LOOP;

          -- Specific fp_id legacy synchronization
          IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'employees' AND column_name = 'fp_id') THEN
            BEGIN
              ALTER TABLE employees ALTER COLUMN fp_id DROP NOT NULL;
              ALTER TABLE employees ALTER COLUMN fp_id SET DEFAULT NULL;
              UPDATE employees SET fp_employee_id = fp_id WHERE fp_employee_id IS NULL AND fp_id IS NOT NULL;
              UPDATE employees SET fp_id = fp_employee_id WHERE fp_id IS NULL AND fp_employee_id IS NOT NULL;
            EXCEPTION WHEN OTHERS THEN NULL;
            END;
          END IF;

          -- Data migration from legacy v1 columns
          BEGIN
            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'employees' AND column_name = 'name') THEN
              UPDATE employees SET full_name = name WHERE full_name IS NULL;
            END IF;
            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'employees' AND column_name = 'phone') THEN
              UPDATE employees SET phone_number = phone WHERE phone_number IS NULL;
            END IF;
            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'employees' AND column_name = 'employer_id') THEN
              UPDATE employees SET organization_id = employer_id::uuid WHERE organization_id IS NULL AND employer_id IS NOT NULL;
            END IF;
          EXCEPTION WHEN OTHERS THEN NULL;
          END;

          -- Ensure all active employees are associated with an organization if organizations exist
          BEGIN
            UPDATE employees 
            SET organization_id = (SELECT id FROM organizations ORDER BY created_at ASC LIMIT 1)
            WHERE organization_id IS NULL AND EXISTS (SELECT 1 FROM organizations);
          EXCEPTION WHEN OTHERS THEN NULL;
          END;

          CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_fp_id ON employees(fp_employee_id);
          CREATE INDEX IF NOT EXISTS idx_employees_org ON employees(organization_id);
          CREATE INDEX IF NOT EXISTS idx_employees_phone ON employees(phone_number);
          CREATE INDEX IF NOT EXISTS idx_employees_status ON employees(status);
        END IF;

        -- --------------------------------------------------------------------
        -- B. Users Table
        -- --------------------------------------------------------------------
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

          -- Permanently drop NOT NULL from any legacy non-v2 column on users (e.g. email, pin)
          allowed_cols := ARRAY['id', 'role', 'organization_id', 'merchant_id', 'employee_id', 'password_hash', 'must_change_password', 'status', 'last_login_at', 'created_at', 'updated_at'];
          FOR col IN (
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'users' 
              AND is_nullable = 'NO'
              AND column_name != ALL(allowed_cols)
          ) LOOP
            BEGIN
              EXECUTE 'ALTER TABLE users ALTER COLUMN ' || quote_ident(col) || ' DROP NOT NULL';
              EXECUTE 'ALTER TABLE users ALTER COLUMN ' || quote_ident(col) || ' SET DEFAULT NULL';
            EXCEPTION WHEN OTHERS THEN NULL;
            END;
          END LOOP;
        END IF;

        -- --------------------------------------------------------------------
        -- C. Password Reset Requests Table
        -- --------------------------------------------------------------------
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

          -- Drop NOT NULL from any legacy non-v2 column
          allowed_cols := ARRAY['id', 'employee_id', 'requested_at', 'reviewed_by', 'reviewed_at', 'status', 'delivery_method', 'expires_at'];
          FOR col IN (
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'password_reset_requests' 
              AND is_nullable = 'NO'
              AND column_name != ALL(allowed_cols)
          ) LOOP
            BEGIN
              EXECUTE 'ALTER TABLE password_reset_requests ALTER COLUMN ' || quote_ident(col) || ' DROP NOT NULL';
              EXECUTE 'ALTER TABLE password_reset_requests ALTER COLUMN ' || quote_ident(col) || ' SET DEFAULT NULL';
            EXCEPTION WHEN OTHERS THEN NULL;
            END;
          END LOOP;

          CREATE INDEX IF NOT EXISTS idx_pwd_reset_employee ON password_reset_requests(employee_id);
          CREATE INDEX IF NOT EXISTS idx_pwd_reset_status ON password_reset_requests(status);
        END IF;

        -- --------------------------------------------------------------------
        -- D. Refresh Tokens Table
        -- --------------------------------------------------------------------
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

          allowed_cols := ARRAY['id', 'user_id', 'token_hash', 'expires_at', 'revoked_at', 'created_at', 'ip_address', 'user_agent'];
          FOR col IN (
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'refresh_tokens' 
              AND is_nullable = 'NO'
              AND column_name != ALL(allowed_cols)
          ) LOOP
            BEGIN
              EXECUTE 'ALTER TABLE refresh_tokens ALTER COLUMN ' || quote_ident(col) || ' DROP NOT NULL';
              EXECUTE 'ALTER TABLE refresh_tokens ALTER COLUMN ' || quote_ident(col) || ' SET DEFAULT NULL';
            EXCEPTION WHEN OTHERS THEN NULL;
            END;
          END LOOP;
        END IF;

        -- --------------------------------------------------------------------
        -- E. Organizations Table
        -- --------------------------------------------------------------------
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'organizations') THEN
          ALTER TABLE organizations ADD COLUMN IF NOT EXISTS tin_number TEXT;
          ALTER TABLE organizations ADD COLUMN IF NOT EXISTS mpesa_shortcode TEXT;
          ALTER TABLE organizations ADD COLUMN IF NOT EXISTS contact_phone TEXT;
          ALTER TABLE organizations ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'ACTIVE';
          ALTER TABLE organizations ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
          ALTER TABLE organizations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

          allowed_cols := ARRAY['id', 'name', 'tin_number', 'mpesa_shortcode', 'contact_phone', 'status', 'created_at', 'updated_at', 'deleted_at'];
          FOR col IN (
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'organizations' 
              AND is_nullable = 'NO'
              AND column_name != ALL(allowed_cols)
          ) LOOP
            BEGIN
              EXECUTE 'ALTER TABLE organizations ALTER COLUMN ' || quote_ident(col) || ' DROP NOT NULL';
              EXECUTE 'ALTER TABLE organizations ALTER COLUMN ' || quote_ident(col) || ' SET DEFAULT NULL';
            EXCEPTION WHEN OTHERS THEN NULL;
            END;
          END LOOP;
        END IF;

        -- --------------------------------------------------------------------
        -- F. Merchants Table
        -- --------------------------------------------------------------------
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'merchants') THEN
          ALTER TABLE merchants ADD COLUMN IF NOT EXISTS business_name TEXT;
          ALTER TABLE merchants ADD COLUMN IF NOT EXISTS mpesa_number TEXT;
          ALTER TABLE merchants ADD COLUMN IF NOT EXISTS category merchant_category DEFAULT 'RETAIL';
          ALTER TABLE merchants ADD COLUMN IF NOT EXISTS contact_phone TEXT;
          ALTER TABLE merchants ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
          ALTER TABLE merchants ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

          -- Data migration from legacy v1 columns
          BEGIN
            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'merchants' AND column_name = 'name') THEN
              UPDATE merchants SET business_name = name WHERE business_name IS NULL AND name IS NOT NULL;
            END IF;
            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'merchants' AND column_name = 'short_code') THEN
              UPDATE merchants SET mpesa_number = short_code WHERE mpesa_number IS NULL AND short_code IS NOT NULL;
            END IF;
            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'merchants' AND column_name = 'phone') THEN
              UPDATE merchants SET contact_phone = phone WHERE contact_phone IS NULL AND phone IS NOT NULL;
            END IF;
          EXCEPTION WHEN OTHERS THEN NULL;
          END;

          BEGIN
            ALTER TABLE merchants ALTER COLUMN status SET DEFAULT 'ACTIVE'::merchant_status;
          EXCEPTION WHEN OTHERS THEN NULL;
          END;

          allowed_cols := ARRAY['id', 'business_name', 'mpesa_number', 'category', 'contact_phone', 'status', 'created_at', 'updated_at', 'deleted_at'];
          FOR col IN (
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'merchants' 
              AND is_nullable = 'NO'
              AND column_name != ALL(allowed_cols)
          ) LOOP
            BEGIN
              EXECUTE 'ALTER TABLE merchants ALTER COLUMN ' || quote_ident(col) || ' DROP NOT NULL';
              EXECUTE 'ALTER TABLE merchants ALTER COLUMN ' || quote_ident(col) || ' SET DEFAULT NULL';
            EXCEPTION WHEN OTHERS THEN NULL;
            END;
          END LOOP;
        END IF;

        -- --------------------------------------------------------------------
        -- G. Org Credit Policies Table
        -- --------------------------------------------------------------------
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'org_credit_policies') THEN
          ALTER TABLE org_credit_policies ADD COLUMN IF NOT EXISTS requires_admin_approval_above NUMERIC(14,2);
          ALTER TABLE org_credit_policies ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
        END IF;

        -- --------------------------------------------------------------------
        -- H. Payroll Settlements & Disbursement Lines
        -- --------------------------------------------------------------------
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payroll_settlements') THEN
          ALTER TABLE payroll_settlements ADD COLUMN IF NOT EXISTS total_merchant_disbursements NUMERIC(14,2) NOT NULL DEFAULT 0;
          ALTER TABLE payroll_settlements ADD COLUMN IF NOT EXISTS total_employee_disbursements NUMERIC(14,2) NOT NULL DEFAULT 0;
          ALTER TABLE payroll_settlements ADD COLUMN IF NOT EXISTS initiated_by UUID;
          ALTER TABLE payroll_settlements ADD COLUMN IF NOT EXISTS initiated_at TIMESTAMPTZ;
          ALTER TABLE payroll_settlements ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
          ALTER TABLE payroll_settlements ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
          BEGIN
            ALTER TABLE payroll_settlements ALTER COLUMN id SET DEFAULT gen_random_uuid();
          EXCEPTION WHEN OTHERS THEN NULL;
          END;
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payroll_disbursement_lines') THEN
          ALTER TABLE payroll_disbursement_lines ADD COLUMN IF NOT EXISTS mpesa_conversation_id TEXT;
          ALTER TABLE payroll_disbursement_lines ADD COLUMN IF NOT EXISTS mpesa_receipt TEXT;
          ALTER TABLE payroll_disbursement_lines ADD COLUMN IF NOT EXISTS dispatched_at TIMESTAMPTZ;
          ALTER TABLE payroll_disbursement_lines ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
          ALTER TABLE payroll_disbursement_lines ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
          BEGIN
            ALTER TABLE payroll_disbursement_lines ALTER COLUMN id SET DEFAULT gen_random_uuid();
          EXCEPTION WHEN OTHERS THEN NULL;
          END;
        END IF;

        -- --------------------------------------------------------------------
        -- I. Transactions Table
        -- --------------------------------------------------------------------
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'transactions') THEN
          ALTER TABLE transactions ADD COLUMN IF NOT EXISTS fp_transaction_ref TEXT;
          ALTER TABLE transactions ADD COLUMN IF NOT EXISTS employee_id UUID;
          ALTER TABLE transactions ADD COLUMN IF NOT EXISTS merchant_id UUID;
          ALTER TABLE transactions ADD COLUMN IF NOT EXISTS organization_id UUID;
          ALTER TABLE transactions ADD COLUMN IF NOT EXISTS employee_fp_id_snapshot TEXT;
          ALTER TABLE transactions ADD COLUMN IF NOT EXISTS employee_name_snapshot TEXT;
          ALTER TABLE transactions ADD COLUMN IF NOT EXISTS employee_phone_snapshot TEXT;
          ALTER TABLE transactions ADD COLUMN IF NOT EXISTS org_name_snapshot TEXT;
          ALTER TABLE transactions ADD COLUMN IF NOT EXISTS merchant_name_snapshot TEXT;
          ALTER TABLE transactions ADD COLUMN IF NOT EXISTS merchant_mpesa_snapshot TEXT;
          ALTER TABLE transactions ADD COLUMN IF NOT EXISTS category_snapshot TEXT;
          ALTER TABLE transactions ADD COLUMN IF NOT EXISTS total_amount NUMERIC(14,2);
          ALTER TABLE transactions ADD COLUMN IF NOT EXISTS credit_portion NUMERIC(14,2) NOT NULL DEFAULT 0;
          ALTER TABLE transactions ADD COLUMN IF NOT EXISTS copay_portion NUMERIC(14,2) NOT NULL DEFAULT 0;
          ALTER TABLE transactions ADD COLUMN IF NOT EXISTS stk_checkout_request_id TEXT;
          ALTER TABLE transactions ADD COLUMN IF NOT EXISTS mpesa_receipt TEXT;
          ALTER TABLE transactions ADD COLUMN IF NOT EXISTS status transaction_status NOT NULL DEFAULT 'PENDING';
          ALTER TABLE transactions ADD COLUMN IF NOT EXISTS settlement_id UUID;
          ALTER TABLE transactions ADD COLUMN IF NOT EXISTS settled_at TIMESTAMPTZ;
          ALTER TABLE transactions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
          ALTER TABLE transactions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

          -- Sync from legacy column aliases if present
          BEGIN
            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'credit_amount') THEN
              UPDATE transactions SET credit_portion = credit_amount WHERE credit_portion = 0 AND credit_amount > 0;
            END IF;
            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'copay_amount') THEN
              UPDATE transactions SET copay_portion = copay_amount WHERE copay_portion = 0 AND copay_amount > 0;
            END IF;
            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'mpesa_checkout_request_id') THEN
              UPDATE transactions SET stk_checkout_request_id = mpesa_checkout_request_id WHERE stk_checkout_request_id IS NULL AND mpesa_checkout_request_id IS NOT NULL;
            END IF;
            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'mpesa_receipt_number') THEN
              UPDATE transactions SET mpesa_receipt = mpesa_receipt_number WHERE mpesa_receipt IS NULL AND mpesa_receipt_number IS NOT NULL;
            END IF;
          EXCEPTION WHEN OTHERS THEN NULL;
          END;

          BEGIN
            ALTER TABLE transactions ALTER COLUMN id SET DEFAULT gen_random_uuid();
          EXCEPTION WHEN OTHERS THEN NULL;
          END;

          -- Drop NOT NULL on any legacy columns that are not part of v2 schema
          allowed_cols := ARRAY[
            'id', 'fp_transaction_ref', 'employee_id', 'merchant_id', 'organization_id',
            'employee_fp_id_snapshot', 'employee_name_snapshot', 'employee_phone_snapshot',
            'org_name_snapshot', 'merchant_name_snapshot', 'merchant_mpesa_snapshot',
            'category_snapshot', 'total_amount', 'credit_portion', 'copay_portion',
            'stk_checkout_request_id', 'mpesa_receipt', 'status', 'settlement_id', 'settled_at',
            'created_at', 'updated_at'
          ];
          FOR col IN (
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'transactions' 
              AND is_nullable = 'NO'
              AND column_name != ALL(allowed_cols)
          ) LOOP
            BEGIN
              EXECUTE 'ALTER TABLE transactions ALTER COLUMN ' || quote_ident(col) || ' DROP NOT NULL';
              EXECUTE 'ALTER TABLE transactions ALTER COLUMN ' || quote_ident(col) || ' SET DEFAULT NULL';
            EXCEPTION WHEN OTHERS THEN NULL;
            END;
          END LOOP;
        END IF;

        -- --------------------------------------------------------------------
        -- J. Journal Entries Table
        -- --------------------------------------------------------------------
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'journal_entries') THEN
          ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS transaction_id UUID;
          ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS account_type TEXT;
          ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS debit_amount NUMERIC(14,2) NOT NULL DEFAULT 0;
          ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS credit_amount NUMERIC(14,2) NOT NULL DEFAULT 0;
          ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS description TEXT;
          ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

          -- Data migration from legacy v1 columns
          BEGIN
            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'journal_entries' AND column_name = 'debit_etb') THEN
              UPDATE journal_entries SET debit_amount = debit_etb::numeric WHERE debit_amount = 0 AND debit_etb > 0;
            END IF;
            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'journal_entries' AND column_name = 'credit_etb') THEN
              UPDATE journal_entries SET credit_amount = credit_etb::numeric WHERE credit_amount = 0 AND credit_etb > 0;
            END IF;
            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'journal_entries' AND column_name = 'label') THEN
              UPDATE journal_entries SET description = label WHERE description IS NULL AND label IS NOT NULL;
            END IF;
          EXCEPTION WHEN OTHERS THEN NULL;
          END;

          BEGIN
            ALTER TABLE journal_entries ALTER COLUMN id SET DEFAULT gen_random_uuid();
          EXCEPTION WHEN OTHERS THEN NULL;
          END;

          -- Drop NOT NULL and defaults from legacy columns like payment_id and label
          BEGIN
            ALTER TABLE journal_entries ALTER COLUMN payment_id DROP NOT NULL;
            ALTER TABLE journal_entries ALTER COLUMN payment_id SET DEFAULT NULL;
          EXCEPTION WHEN OTHERS THEN NULL;
          END;

          BEGIN
            ALTER TABLE journal_entries ALTER COLUMN label DROP NOT NULL;
            ALTER TABLE journal_entries ALTER COLUMN label SET DEFAULT NULL;
          EXCEPTION WHEN OTHERS THEN NULL;
          END;

          allowed_cols := ARRAY['id', 'transaction_id', 'account_type', 'debit_amount', 'credit_amount', 'description', 'created_at'];
          FOR col IN (
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'journal_entries' 
              AND is_nullable = 'NO'
              AND column_name != ALL(allowed_cols)
          ) LOOP
            BEGIN
              EXECUTE 'ALTER TABLE journal_entries ALTER COLUMN ' || quote_ident(col) || ' DROP NOT NULL';
              EXECUTE 'ALTER TABLE journal_entries ALTER COLUMN ' || quote_ident(col) || ' SET DEFAULT NULL';
            EXCEPTION WHEN OTHERS THEN NULL;
            END;
          END LOOP;
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
        settlement_id             UUID REFERENCES payroll_settlements(id) ON DELETE SET NULL,
        settled_at                TIMESTAMPTZ,
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

    // 4. Install backward compatibility trigger for employees table
    await pool.query(`
      CREATE OR REPLACE FUNCTION trg_sync_employees_legacy()
      RETURNS TRIGGER AS $$
      BEGIN
        -- Sync fp_id and fp_employee_id bidirectionally
        BEGIN
          IF NEW.fp_employee_id IS NOT NULL THEN
            NEW.fp_id := NEW.fp_employee_id;
          ELSIF NEW.fp_id IS NOT NULL THEN
            NEW.fp_employee_id := NEW.fp_id;
          END IF;
        EXCEPTION WHEN OTHERS THEN NULL;
        END;

        -- Sync full_name and name bidirectionally
        BEGIN
          IF NEW.full_name IS NOT NULL THEN
            NEW.name := NEW.full_name;
          ELSIF NEW.name IS NOT NULL THEN
            NEW.full_name := NEW.name;
          END IF;
        EXCEPTION WHEN OTHERS THEN NULL;
        END;

        -- Sync phone_number and phone bidirectionally
        BEGIN
          IF NEW.phone_number IS NOT NULL THEN
            NEW.phone := NEW.phone_number;
          ELSIF NEW.phone IS NOT NULL THEN
            NEW.phone_number := NEW.phone;
          END IF;
        EXCEPTION WHEN OTHERS THEN NULL;
        END;

        -- Sync organization_id and employer_id bidirectionally
        BEGIN
          IF NEW.organization_id IS NOT NULL THEN
            NEW.employer_id := NEW.organization_id;
          ELSIF NEW.employer_id IS NOT NULL THEN
            NEW.organization_id := NEW.employer_id;
          END IF;
        EXCEPTION WHEN OTHERS THEN NULL;
        END;

        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'employees') THEN
          DROP TRIGGER IF EXISTS trg_sync_employees_legacy ON employees;
          CREATE TRIGGER trg_sync_employees_legacy
          BEFORE INSERT OR UPDATE ON employees
          FOR EACH ROW EXECUTE FUNCTION trg_sync_employees_legacy();
        END IF;
      EXCEPTION WHEN OTHERS THEN NULL;
      END $$;
    `);

    // 5. Verify critical columns across key tables
    const verification = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'tin_number') as has_tin,
        (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'employees' AND column_name = 'fp_employee_id') as has_fp_id,
        (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'password_reset_requests' AND column_name = 'requested_at') as has_requested_at,
        (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'refresh_tokens' AND column_name = 'revoked_at') as has_revoked_at
    `);

    const row = verification.rows[0];
    if (row && Number(row.has_tin) > 0 && Number(row.has_fp_id) > 0 && Number(row.has_requested_at) > 0 && Number(row.has_revoked_at) > 0) {
      console.log('[Migrator] FlexPay v2 schema is fully verified, synchronized, and resilient.');
    } else {
      console.warn('[Migrator] Partial schema verification detected:', row);
    }
  } catch (err) {
    console.error('[Migrator] Database schema verification or migration failed:', err.message);
  }
}

module.exports = { ensureSchema };
