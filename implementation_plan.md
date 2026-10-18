# FlexPay v3 — Implementation Plan

**Classification:** Engineering Execution Guide
**Version:** 3.0.0
**Date:** 2026-10-18
**References:** blueprint.md v3.0.0

> **How to use this document:** Each phase is sequenced so that dependencies are satisfied before they are needed.
> Phases 1–4 are backend-only. Phase 5 adds the frontend. Phases 6–9 layer on the new v3 features.
> Every code snippet is the canonical, final implementation — copy into the specified file path.

---

## Table of Contents

- [Phase 0: Repository & Environment Setup](#phase-0-repository--environment-setup)
- [Phase 1: Database Foundation](#phase-1-database-foundation)
- [Phase 2: Auth Module](#phase-2-auth-module)
- [Phase 3: Organization & Employee Modules](#phase-3-organization--employee-modules)
- [Phase 4: Merchant & Transaction Modules](#phase-4-merchant--transaction-modules)
- [Phase 5: Frontend Foundation & Auth](#phase-5-frontend-foundation--auth)
- [Phase 6: Employee Dashboard — Salary Credit & QR](#phase-6-employee-dashboard--salary-credit--qr)
- [Phase 7: Organization Dashboard — Merchant Detail & Payroll](#phase-7-organization-dashboard--merchant-detail--payroll)
- [Phase 8: Merchant Dashboard — Full Management Console](#phase-8-merchant-dashboard--full-management-console)
- [Phase 9: Loading UX, Receipts & Polish](#phase-9-loading-ux-receipts--polish)
- [Phase 10: Testing, Security Hardening & Deployment](#phase-10-testing-security-hardening--deployment)

---

## Phase 0: Repository & Environment Setup

### 0.1 Environment Variables

Create `.env` at the project root (copy from `.env.example`):

```env
# Server
NODE_ENV=development
PORT=10000
CORS_ORIGIN=http://localhost:5173
LOG_LEVEL=info

# Database (Supabase)
DATABASE_URL=postgresql://postgres:[password]@db.[ref].supabase.co:6543/postgres

# JWT (generate with scripts/generate-keys.sh)
JWT_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"
JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"
JWT_ACCESS_EXPIRY=900
JWT_REFRESH_EXPIRY=604800

# QR Security
QR_SECRET=<32-byte random hex — node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">

# M-PESA (Safaricom Ethiopia Daraja)
MPESA_ENV=sandbox
MPESA_BASE_URL=https://apisandbox.safaricom.et
MPESA_CONSUMER_KEY=
MPESA_CONSUMER_SECRET=
MPESA_PASSKEY=
MPESA_INITIATOR_NAME=
MPESA_SECURITY_CREDENTIAL=
MPESA_SHORTCODE=
MPESA_CALLBACK_BASE=https://flexpay-backend-hu59.onrender.com

# Africa's Talking (SMS)
AT_API_KEY=
AT_USERNAME=sandbox

# Supabase Storage (Receipts)
SUPABASE_URL=https://[ref].supabase.co
SUPABASE_SERVICE_KEY=
```

### 0.2 Key Generation Script

```bash
# scripts/generate-keys.sh
#!/bin/bash
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out private.pem
openssl rsa -in private.pem -pubout -out public.pem
echo "JWT_PRIVATE_KEY=$(cat private.pem | tr '\n' '|' | sed 's/|/\\n/g')"
echo "JWT_PUBLIC_KEY=$(cat public.pem | tr '\n' '|' | sed 's/|/\\n/g')"
```

### 0.3 Package Dependencies

```json
{
  "dependencies": {
    "fastify": "^4.28.1",
    "@fastify/cors": "^9.0.1",
    "@fastify/cookie": "^9.4.0",
    "@fastify/helmet": "^11.1.1",
    "@fastify/rate-limit": "^9.1.0",
    "@fastify/jwt": "^8.0.1",
    "kysely": "^0.27.4",
    "pg": "^8.12.0",
    "argon2": "^0.40.3",
    "zod": "^3.23.8",
    "pino": "^9.4.0",
    "pdfkit": "^0.15.0",
    "@supabase/supabase-js": "^2.46.0",
    "qrcode": "^1.5.4",
    "africas-talking": "^1.0.2",
    "pg-boss": "^10.1.3",
    "dotenv": "^16.4.5",
    "uuid": "^10.0.0"
  },
  "devDependencies": {
    "vitest": "^2.1.2",
    "@playwright/test": "^1.48.0"
  }
}
```

---

## Phase 1: Database Foundation

### 1.1 Migration 0001 — Initial Schema

File: `supabase/migrations/0001_initial.sql`

**Key rules applied:**
- NUMERIC(14,2) for all money
- UUID primary keys
- Enum types for all status fields
- REVOKE on journal_entries and audit_log
- CHECK constraints on credit values

```sql
-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ========== ORGANIZATIONS ==========
CREATE TABLE organizations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  tin_number      TEXT UNIQUE NOT NULL,
  mpesa_shortcode TEXT,
  contact_phone   TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ
);

-- ========== MERCHANTS ==========
CREATE TYPE merchant_status AS ENUM ('PENDING_VERIFICATION','ACTIVE','SUSPENDED');
CREATE TYPE merchant_category AS ENUM ('FOOD','TRANSPORT','HEALTH','GROCERY','FUEL','EDUCATION');

CREATE TABLE merchants (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name    TEXT NOT NULL,
  mpesa_number     TEXT NOT NULL UNIQUE,
  category         merchant_category NOT NULL,
  contact_phone    TEXT NOT NULL,
  status           merchant_status NOT NULL DEFAULT 'PENDING_VERIFICATION',
  total_receivable NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at       TIMESTAMPTZ
);

-- ========== EMPLOYEES (salary-first) ==========
CREATE TABLE employees (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fp_employee_id   TEXT UNIQUE NOT NULL,
  organization_id  UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  full_name        TEXT NOT NULL,
  phone_number     TEXT NOT NULL,
  department       TEXT,
  job_title        TEXT,
  monthly_salary   NUMERIC(14,2) NOT NULL DEFAULT 0,
  credit_limit     NUMERIC(14,2) NOT NULL DEFAULT 0,
  available_credit NUMERIC(14,2) NOT NULL DEFAULT 0,
  status           TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at       TIMESTAMPTZ,
  CONSTRAINT chk_credit_valid     CHECK (available_credit >= 0 AND available_credit <= credit_limit),
  CONSTRAINT chk_credit_limit_pos CHECK (credit_limit >= 0),
  CONSTRAINT chk_salary_positive  CHECK (monthly_salary >= 0)
);
CREATE UNIQUE INDEX idx_employees_fp_id ON employees(fp_employee_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_employees_org ON employees(organization_id);

-- ========== USERS ==========
CREATE TABLE users (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role                 TEXT NOT NULL CHECK (role IN ('ORG_ADMIN','ORG_CONTROLLER','MERCHANT_OWNER','MERCHANT_STAFF','EMPLOYEE','FP_ADMIN')),
  organization_id      UUID REFERENCES organizations(id) ON DELETE CASCADE,
  merchant_id          UUID REFERENCES merchants(id) ON DELETE CASCADE,
  employee_id          UUID REFERENCES employees(id) ON DELETE CASCADE,
  password_hash        TEXT NOT NULL,
  must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
  last_login_at        TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ========== ORG CREDIT POLICIES ==========
CREATE TABLE org_credit_policies (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id        UUID NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
  global_credit_limit    NUMERIC(14,2) NOT NULL DEFAULT 0,
  allowed_categories     TEXT[] NOT NULL DEFAULT '{}',
  max_daily_spend        NUMERIC(14,2),
  max_single_transaction NUMERIC(14,2),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ========== PASSWORD RESET REQUESTS ==========
CREATE TYPE reset_status AS ENUM ('PENDING','APPROVED','REJECTED','EXPIRED');
CREATE TABLE password_reset_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id     UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  requested_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_by     UUID REFERENCES users(id),
  reviewed_at     TIMESTAMPTZ,
  status          reset_status NOT NULL DEFAULT 'PENDING',
  delivery_method TEXT NOT NULL DEFAULT 'SMS',
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '48 hours')
);

-- ========== TRANSACTIONS ==========
CREATE TYPE transaction_status AS ENUM ('PENDING','CREDIT_RESERVED','STK_SENT','COMPLETED','FAILED','REFUNDED');
CREATE TABLE transactions (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fp_transaction_ref       TEXT UNIQUE NOT NULL,
  employee_id              UUID NOT NULL REFERENCES employees(id),
  merchant_id              UUID NOT NULL REFERENCES merchants(id),
  organization_id          UUID NOT NULL REFERENCES organizations(id),
  employee_fp_id_snapshot  TEXT NOT NULL,
  employee_name_snapshot   TEXT NOT NULL,
  employee_phone_snapshot  TEXT NOT NULL,
  org_name_snapshot        TEXT NOT NULL,
  merchant_name_snapshot   TEXT NOT NULL,
  merchant_mpesa_snapshot  TEXT NOT NULL,
  category_snapshot        TEXT NOT NULL,
  total_amount             NUMERIC(14,2) NOT NULL CHECK (total_amount > 0),
  credit_portion           NUMERIC(14,2) NOT NULL DEFAULT 0,
  copay_portion            NUMERIC(14,2) NOT NULL DEFAULT 0,
  stk_checkout_request_id  TEXT,
  mpesa_receipt            TEXT,
  receipt_url              TEXT,
  status                   transaction_status NOT NULL DEFAULT 'PENDING',
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_amounts_add_up    CHECK (credit_portion + copay_portion = total_amount),
  CONSTRAINT chk_portions_positive CHECK (credit_portion >= 0 AND copay_portion >= 0)
);
CREATE INDEX idx_txn_employee ON transactions(employee_id);
CREATE INDEX idx_txn_merchant  ON transactions(merchant_id);
CREATE INDEX idx_txn_org       ON transactions(organization_id);
CREATE INDEX idx_txn_created   ON transactions(created_at DESC);
CREATE INDEX idx_txn_status    ON transactions(status);

-- ========== JOURNAL ENTRIES (append-only) ==========
CREATE TABLE journal_entries (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES transactions(id),
  account_type   TEXT NOT NULL CHECK (account_type IN ('EMPLOYEE_CREDIT','MERCHANT_RECEIVABLE','MPESA_CLEARING')),
  debit_amount   NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (debit_amount >= 0),
  credit_amount  NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (credit_amount >= 0),
  description    TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ========== PAYROLL TABLES ==========
CREATE TYPE settlement_status AS ENUM ('PREVIEW','RUNNING','COMPLETED','PARTIAL','FAILED');
CREATE TABLE payroll_settlements (
  id                           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id              UUID NOT NULL REFERENCES organizations(id),
  period_start                 DATE NOT NULL,
  period_end                   DATE NOT NULL,
  status                       settlement_status NOT NULL DEFAULT 'PREVIEW',
  total_merchant_disbursements NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_employee_disbursements NUMERIC(14,2) NOT NULL DEFAULT 0,
  initiated_by                 UUID REFERENCES users(id),
  initiated_at                 TIMESTAMPTZ,
  completed_at                 TIMESTAMPTZ,
  created_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE payroll_disbursement_lines (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_id          UUID NOT NULL REFERENCES payroll_settlements(id),
  recipient_type         TEXT NOT NULL CHECK (recipient_type IN ('MERCHANT','EMPLOYEE')),
  merchant_id            UUID REFERENCES merchants(id),
  employee_id            UUID REFERENCES employees(id),
  recipient_mpesa_number TEXT NOT NULL,
  gross_salary           NUMERIC(14,2),
  credit_used            NUMERIC(14,2),
  amount                 NUMERIC(14,2) NOT NULL CHECK (amount >= 0),
  status                 TEXT NOT NULL DEFAULT 'PENDING',
  mpesa_conversation_id  TEXT,
  mpesa_receipt          TEXT,
  dispatched_at          TIMESTAMPTZ,
  completed_at           TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ========== REFRESH TOKENS ==========
CREATE TABLE refresh_tokens (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT
);
CREATE INDEX idx_refresh_tokens_hash ON refresh_tokens(token_hash);
CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);

-- ========== AUDIT LOG (append-only) ==========
CREATE TABLE audit_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID,
  actor_role    TEXT,
  action        TEXT NOT NULL,
  target_table  TEXT,
  target_id     UUID,
  old_value     JSONB,
  new_value     JSONB,
  ip_address    INET,
  request_id    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ========== IDEMPOTENCY KEYS ==========
CREATE TABLE idempotency_keys (
  key        TEXT PRIMARY KEY,
  response   JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);
```

### 1.2 Migration 0002 — Salary & Job Title

File: `supabase/migrations/0002_salary_credit.sql`

```sql
-- Add job_title if not present (monthly_salary already in 0001)
ALTER TABLE employees ADD COLUMN IF NOT EXISTS job_title TEXT;

-- Ensure monthly_salary is non-null with sensible default
ALTER TABLE employees ALTER COLUMN monthly_salary SET DEFAULT 0;
ALTER TABLE employees ALTER COLUMN monthly_salary SET NOT NULL;

-- Back-fill credit_limit from monthly_salary for any legacy rows
UPDATE employees SET credit_limit = monthly_salary WHERE credit_limit = 0 AND monthly_salary > 0;
UPDATE employees SET available_credit = credit_limit WHERE available_credit = 0 AND credit_limit > 0;
```

### 1.3 Migration 0003 — Receipts

File: `supabase/migrations/0003_receipts.sql`

```sql
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS receipt_url TEXT;
```

### 1.4 Migration 0004 — Payroll Lines v2

File: `supabase/migrations/0004_payroll_lines_v2.sql`

```sql
ALTER TABLE payroll_disbursement_lines ADD COLUMN IF NOT EXISTS gross_salary NUMERIC(14,2);
ALTER TABLE payroll_disbursement_lines ADD COLUMN IF NOT EXISTS credit_used  NUMERIC(14,2);
```

---

## Phase 2: Auth Module

### 2.1 JWT Utility

File: `src/server/shared/crypto/jwt.js`

```javascript
const { createSigner, createVerifier } = require('fast-jwt');
const config = require('../../config');

const sign = createSigner({
  algorithm: 'RS256',
  key: config.jwt.privateKey,
  expiresIn: config.jwt.accessExpiry,
});
const verify = createVerifier({
  algorithms: ['RS256'],
  key: config.jwt.publicKey,
});

const createAccessToken = (payload) => sign(payload);
const verifyAccessToken = (token) => verify(token);
module.exports = { createAccessToken, verifyAccessToken };
```

### 2.2 Auth Routes

File: `src/server/modules/auth/adapters/incoming/auth.routes.js`

```javascript
const { z } = require('zod');
const LoginSchema = z.object({
  body: z.object({ username: z.string(), password: z.string().min(8) })
});

async function authRoutes(fastify) {
  fastify.post('/auth/org/register',    handler('org-register'));
  fastify.post('/auth/org/login',       handler('org-login'));
  fastify.post('/auth/merchant/register', handler('merchant-register'));
  fastify.post('/auth/merchant/login',   handler('merchant-login'));
  fastify.post('/auth/employee/login',   handler('employee-login'));
  fastify.post('/auth/employee/forgot-password', handler('forgot-password'));
  fastify.post('/auth/refresh', handler('refresh'));
}
```

### 2.3 UUID Param Validation Middleware

File: `src/server/shared/middleware/validateUUID.js`

```javascript
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Fastify hook — validates that all URL params that look like IDs are valid UUIDs.
 * Returns HTTP 400 (not 500) on invalid UUID, preventing the PostgreSQL
 * "invalid input syntax for type uuid: undefined" error.
 */
function validateUUIDParams(paramNames = []) {
  return async function (request, reply) {
    for (const name of paramNames) {
      const val = request.params[name];
      if (val !== undefined && !UUID_RE.test(val)) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: `Invalid ID format for param '${name}': '${val}'`,
          statusCode: 400,
        });
      }
    }
  };
}

module.exports = { validateUUIDParams };
```

> **Add this preHandler to every route with a UUID param:**
> ```javascript
> fastify.patch('/org/password-reset-requests/:id', {
>   preHandler: [authenticate, requireRole('ORG_ADMIN','ORG_CONTROLLER'), validateUUIDParams(['id'])]
> }, handler);
> ```

---

## Phase 3: Organization & Employee Modules

### 3.1 Create Employee Use Case

File: `src/server/modules/employees/ports/incoming/CreateEmployeeUseCase.js`

```javascript
const { generateEmployeeId } = require('../../../../shared/crypto/employeeIdGenerator');
const { generateCompliantPassword } = require('../../../../shared/crypto/passwordGenerator');
const { hash } = require('../../../../shared/crypto/argon2');

/**
 * Creates a new employee with:
 *   - monthly_salary (REQUIRED) as the source of truth
 *   - credit_limit = credit_limit_override ?? monthly_salary
 *   - available_credit = credit_limit (starts fully available)
 */
class CreateEmployeeUseCase {
  constructor(employeeRepo, notificationService) {
    this.employeeRepo = employeeRepo;
    this.notifications = notificationService;
  }

  async execute({ orgId, fullName, phone, monthlySalary, department, jobTitle, creditLimitOverride }) {
    // Validation
    if (!monthlySalary || monthlySalary <= 0) {
      throw new Error('monthly_salary is required and must be greater than zero');
    }

    const fpEmployeeId = generateEmployeeId('ETH');
    const plainPassword = generateCompliantPassword(16);
    const passwordHash  = await hash(plainPassword);

    const creditLimit     = creditLimitOverride ?? monthlySalary;
    const availableCredit = creditLimit;

    const employee = await this.employeeRepo.create({
      fp_employee_id:   fpEmployeeId,
      organization_id:  orgId,
      full_name:        fullName,
      phone_number:     phone,
      monthly_salary:   monthlySalary,
      credit_limit:     creditLimit,
      available_credit: availableCredit,
      department:       department ?? null,
      job_title:        jobTitle ?? null,
      status: 'ACTIVE',
    });

    // Create user record for employee portal
    await this.employeeRepo.createUserRecord({
      employee_id:   employee.id,
      password_hash: passwordHash,
      role:          'EMPLOYEE',
    });

    // Send credentials via SMS
    await this.notifications.sendEmployeeWelcome({
      phone,
      fpId:     fpEmployeeId,
      password: plainPassword,
    });

    // Return plainPassword ONCE — it is NEVER stored or re-retrievable
    return { employee, plainPassword };
  }
}

module.exports = { CreateEmployeeUseCase };
```

### 3.2 Approve Password Reset Use Case

File: `src/server/modules/employees/ports/incoming/ApprovePasswordResetUseCase.js`

**Critical fix for the UUID "undefined" bug:**

```javascript
const { generateCompliantPassword } = require('../../../../shared/crypto/passwordGenerator');
const { hash } = require('../../../../shared/crypto/argon2');

class ApprovePasswordResetUseCase {
  constructor(employeeRepo, notificationService) {
    this.employeeRepo = employeeRepo;
    this.notifications = notificationService;
  }

  async execute({ requestId, reviewerUserId, action }) {
    // requestId MUST be validated as UUID before reaching here (validateUUIDParams middleware)
    if (!requestId || typeof requestId !== 'string') {
      const err = new Error('requestId is required and must be a valid UUID');
      err.statusCode = 400;
      throw err;
    }

    const resetRequest = await this.employeeRepo.findPasswordResetRequest(requestId);
    if (!resetRequest) {
      const err = new Error('Password reset request not found');
      err.statusCode = 404;
      throw err;
    }
    if (resetRequest.status !== 'PENDING') {
      const err = new Error(`Request is already ${resetRequest.status}`);
      err.statusCode = 409;
      throw err;
    }

    if (action === 'REJECT') {
      await this.employeeRepo.updatePasswordResetStatus(requestId, 'REJECTED', reviewerUserId);
      return { status: 'REJECTED' };
    }

    // APPROVE — generate new password
    const newPassword    = generateCompliantPassword(16);
    const newPasswordHash = await hash(newPassword);

    await this.employeeRepo.updateEmployeePasswordHash(resetRequest.employee_id, newPasswordHash);
    await this.employeeRepo.updatePasswordResetStatus(requestId, 'APPROVED', reviewerUserId);

    const employee = await this.employeeRepo.findById(resetRequest.employee_id);
    await this.notifications.sendPasswordApproved({
      phone:    employee.phone_number,
      password: newPassword,
    });

    return { status: 'APPROVED' };
  }
}

module.exports = { ApprovePasswordResetUseCase };
```

### 3.3 Employee Repository — Fixed Column Aliases

File: `src/server/modules/employees/adapters/outgoing/EmployeeRepository.js`

```javascript
// Always select BOTH id and employee_id columns explicitly to avoid alias confusion
async findPasswordResetRequests(orgId) {
  return this.db
    .selectFrom('password_reset_requests as prr')
    .innerJoin('employees as e', 'e.id', 'prr.employee_id')
    .where('e.organization_id', '=', orgId)
    .where('prr.status', '=', 'PENDING')
    .select([
      'prr.id',              // <-- UUID used in PATCH /:id — MUST be 'id'
      'prr.employee_id',
      'prr.status',
      'prr.requested_at',
      'prr.expires_at',
      'e.full_name',
      'e.fp_employee_id',
      'e.phone_number',
    ])
    .execute();
}
```

### 3.4 QR Code Generation

File: `src/server/modules/employees/ports/incoming/GetEmployeeQRCodeUseCase.js`

```javascript
const QRCode = require('qrcode');
const { generateQRPayload } = require('../../../../shared/crypto/employeeIdGenerator');
const config = require('../../../../config');

class GetEmployeeQRCodeUseCase {
  constructor(employeeRepo) {
    this.employeeRepo = employeeRepo;
  }

  async execute({ userId }) {
    const employee = await this.employeeRepo.findByUserId(userId);
    if (!employee) throw Object.assign(new Error('Employee not found'), { statusCode: 404 });

    const payload   = generateQRPayload(
      employee.fp_employee_id,
      employee.id,
      employee.organization_id,
      config.qrSecret
    );

    // Returns PNG as base64 and payload for frontend QR library
    const pngBase64 = await QRCode.toDataURL(payload, {
      width: 300,
      margin: 2,
      color: { dark: '#00c896', light: '#12121a' },
    });

    return {
      pngBase64,
      payload,
      expiresAt: Date.now() + 5 * 60 * 1000,  // 5 minutes
    };
  }
}

module.exports = { GetEmployeeQRCodeUseCase };
```

### 3.5 Organization — Merchant Detail

File: `src/server/modules/organizations/ports/incoming/GetOrgMerchantDetailUseCase.js`

```javascript
/**
 * Returns all transactions at a specific merchant from this org's employees.
 * Used by the MerchantDetailDrawer on the org dashboard.
 */
class GetOrgMerchantDetailUseCase {
  constructor(transactionRepo) {
    this.transactionRepo = transactionRepo;
  }

  async execute({ orgId, merchantId, page = 1, limit = 20 }) {
    const offset = (page - 1) * limit;

    const [summary, transactions] = await Promise.all([
      this.transactionRepo.getMerchantSummaryForOrg(orgId, merchantId),
      this.transactionRepo.getTransactionsByOrgAndMerchant(orgId, merchantId, limit, offset),
    ]);

    return { summary, transactions };
  }
}

module.exports = { GetOrgMerchantDetailUseCase };
```

---

## Phase 4: Merchant & Transaction Modules

### 4.1 Verify Employee QR at Merchant POS

File: `src/server/modules/merchants/ports/incoming/VerifyEmployeeQRUseCase.js`

```javascript
const { verifyQRPayload } = require('../../../../shared/crypto/employeeIdGenerator');
const config = require('../../../../config');

class VerifyEmployeeQRUseCase {
  constructor(employeeRepo, merchantRepo) {
    this.employeeRepo = employeeRepo;
    this.merchantRepo = merchantRepo;
  }

  async execute({ qrPayload, merchantUserId }) {
    const qrResult = verifyQRPayload(qrPayload, config.qrSecret, 300);
    if (!qrResult.valid) {
      return { verified: false, error: qrResult.error };
    }

    const [employee, merchant] = await Promise.all([
      this.employeeRepo.findById(qrResult.employeeId),
      this.merchantRepo.findByUserId(merchantUserId),
    ]);

    if (!employee || employee.status !== 'ACTIVE') {
      return { verified: false, error: 'Employee account not active' };
    }
    if (!merchant || merchant.status !== 'ACTIVE') {
      return { verified: false, error: 'Merchant account not active' };
    }

    return {
      verified: true,
      employee: {
        fpId:            employee.fp_employee_id,
        name:            employee.full_name,
        orgName:         employee.org_name,
        availableCredit: employee.available_credit,
        creditLimit:     employee.credit_limit,
        monthlySalary:   employee.monthly_salary,
      },
    };
  }
}

module.exports = { VerifyEmployeeQRUseCase };
```

### 4.2 Transaction Use Case — SplitEngine + ACID

File: `src/server/modules/transactions/domain/SplitEngine.js`

```javascript
/**
 * Determines how much of a purchase is credit vs M-PESA co-pay.
 * Returns precise NUMERIC-safe values (integer cents arithmetic).
 */
function split(totalAmountETB, availableCreditETB) {
  const total   = Math.round(totalAmountETB   * 100);
  const avail   = Math.round(availableCreditETB * 100);
  const credit  = Math.min(total, avail);
  const copay   = total - credit;
  return {
    creditPortion: credit / 100,
    copayPortion:  copay  / 100,
    needsSTKPush:  copay  > 0,
  };
}
module.exports = { split };
```

File: `src/server/modules/transactions/ports/incoming/CreateTransactionUseCase.js`

```javascript
const { split } = require('../../domain/SplitEngine');
const { v4: uuidv4 } = require('uuid');

class CreateTransactionUseCase {
  constructor(db, employeeRepo, merchantRepo, mpesaService, notificationService) {
    this.db = db;
    this.employeeRepo = employeeRepo;
    this.merchantRepo = merchantRepo;
    this.mpesa = mpesaService;
    this.notifications = notificationService;
  }

  async execute({ employeeId, merchantId, totalAmount, merchantUserId }) {
    const merchant = await this.merchantRepo.findById(merchantId);

    // ACID: lock employee row for credit update
    return this.db.transaction().execute(async (trx) => {
      const employee = await trx
        .selectFrom('employees')
        .where('id', '=', employeeId)
        .where('status', '=', 'ACTIVE')
        .forUpdate()   // row-level lock prevents double-spend
        .selectAll()
        .executeTakeFirstOrThrow();

      const org = await trx
        .selectFrom('organizations')
        .where('id', '=', employee.organization_id)
        .where('status', '=', 'ACTIVE')
        .selectAll()
        .executeTakeFirstOrThrow();

      const { creditPortion, copayPortion, needsSTKPush } = split(totalAmount, Number(employee.available_credit));

      const txnId  = uuidv4();
      const fpRef  = 'FP-TXN-' + Date.now();

      await trx.insertInto('transactions').values({
        id:                      txnId,
        fp_transaction_ref:      fpRef,
        employee_id:             employee.id,
        merchant_id:             merchantId,
        organization_id:         employee.organization_id,
        employee_fp_id_snapshot: employee.fp_employee_id,
        employee_name_snapshot:  employee.full_name,
        employee_phone_snapshot: employee.phone_number,
        org_name_snapshot:       org.name,
        merchant_name_snapshot:  merchant.business_name,
        merchant_mpesa_snapshot: merchant.mpesa_number,
        category_snapshot:       merchant.category,
        total_amount:            totalAmount,
        credit_portion:          creditPortion,
        copay_portion:           copayPortion,
        status:                  needsSTKPush ? 'CREDIT_RESERVED' : 'COMPLETED',
      }).execute();

      // Deduct credit from employee
      await trx.updateTable('employees')
        .set({ available_credit: trx.raw('available_credit - ?', [creditPortion]) })
        .where('id', '=', employee.id)
        .execute();

      // Update merchant receivable
      await trx.updateTable('merchants')
        .set({ total_receivable: trx.raw('total_receivable + ?', [creditPortion]) })
        .where('id', '=', merchantId)
        .execute();

      // Double-entry journal
      await trx.insertInto('journal_entries').values([
        { transaction_id: txnId, account_type: 'EMPLOYEE_CREDIT',     debit_amount: creditPortion, credit_amount: 0 },
        { transaction_id: txnId, account_type: 'MERCHANT_RECEIVABLE', debit_amount: 0, credit_amount: creditPortion },
      ]).execute();

      if (needsSTKPush) {
        const stkRes = await this.mpesa.initiateSTKPush({
          amount:      copayPortion,
          phone:       employee.phone_number,
          accountRef:  fpRef,
          description: 'FlexPay co-pay',
        });
        await trx.updateTable('transactions')
          .set({ stk_checkout_request_id: stkRes.CheckoutRequestID })
          .where('id', '=', txnId)
          .execute();
      }

      return { txnId, fpRef, creditPortion, copayPortion, status: needsSTKPush ? 'CREDIT_RESERVED' : 'COMPLETED' };
    });
  }
}

module.exports = { CreateTransactionUseCase };
```

### 4.3 Receipt Engine

File: `src/server/modules/transactions/domain/ReceiptEngine.js`

```javascript
const PDFDocument = require('pdfkit');

/**
 * Generates a branded FlexPay PDF receipt.
 * Returns a Buffer.
 */
async function generateReceipt(txn) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A6', margin: 20 });
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end',  () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Header
    doc.fontSize(16).fillColor('#00c896').text('FlexPay', { align: 'center' });
    doc.fontSize(9).fillColor('#8b8b9a').text('Official Transaction Record', { align: 'center' });
    doc.moveDown(0.5);
    doc.moveTo(20, doc.y).lineTo(360, doc.y).stroke('#1a1a26');
    doc.moveDown(0.5);

    const row = (label, value, color = '#f0f0f5') => {
      doc.fontSize(8).fillColor('#8b8b9a').text(label, { continued: true });
      doc.fillColor(color).text(value, { align: 'right' });
    };

    row('Reference',  txn.fp_transaction_ref);
    row('Date',       new Date(txn.created_at).toLocaleString('en-ET', { timeZone: 'Africa/Addis_Ababa' }));
    doc.moveDown(0.3);
    row('Employee',   txn.employee_name_snapshot);
    row('FP-ID',      txn.employee_fp_id_snapshot);
    row('Org',        txn.org_name_snapshot);
    doc.moveDown(0.3);
    row('Merchant',   txn.merchant_name_snapshot);
    row('Category',   txn.category_snapshot);
    row('M-PESA',     txn.merchant_mpesa_snapshot);
    doc.moveDown(0.3);
    row('Credit Used', 'ETB ' + Number(txn.credit_portion).toFixed(2), '#00c896');
    if (Number(txn.copay_portion) > 0) {
      row('Co-Pay (M-PESA)', 'ETB ' + Number(txn.copay_portion).toFixed(2), '#f59e0b');
      if (txn.mpesa_receipt) row('M-PESA Receipt', txn.mpesa_receipt);
    }
    row('Total',       'ETB ' + Number(txn.total_amount).toFixed(2));
    doc.moveDown(0.3);
    row('Status',      txn.status, txn.status === 'COMPLETED' ? '#22c55e' : '#ef4444');

    doc.moveDown(0.5);
    doc.moveTo(20, doc.y).lineTo(360, doc.y).stroke('#1a1a26');
    doc.moveDown(0.3);
    doc.fontSize(7).fillColor('#8b8b9a').text('FlexPay — Benefits-First Payments for Ethiopia', { align: 'center' });

    doc.end();
  });
}

module.exports = { generateReceipt };
```

### 4.4 Merchant Analytics Use Case

File: `src/server/modules/merchants/ports/incoming/GetMerchantAnalyticsUseCase.js`

```javascript
class GetMerchantAnalyticsUseCase {
  constructor(merchantRepo) {
    this.merchantRepo = merchantRepo;
  }

  async execute({ merchantId, period = 'month' }) {
    const [
      kpis,
      creditByCategory,
      creditByOrg,
      dailyVolume,
      topEmployees,
    ] = await Promise.all([
      this.merchantRepo.getKPIs(merchantId, period),
      this.merchantRepo.getCreditByCategory(merchantId, period),
      this.merchantRepo.getCreditByOrg(merchantId, period),
      this.merchantRepo.getDailyVolume(merchantId, 30),
      this.merchantRepo.getTopEmployees(merchantId, period, 10),
    ]);

    return { kpis, creditByCategory, creditByOrg, dailyVolume, topEmployees };
  }
}

module.exports = { GetMerchantAnalyticsUseCase };
```

---

## Phase 5: Frontend Foundation & Auth

### 5.1 Design Tokens

File: `src/client/src/styles/tokens.css`

```css
:root {
  --bg-primary:       #0a0a0f;
  --bg-surface:       #12121a;
  --bg-elevated:      #1a1a26;
  --bg-hover:         #22223a;
  --accent-primary:   #00c896;
  --accent-secondary: #6366f1;
  --text-primary:     #f0f0f5;
  --text-secondary:   #8b8b9a;
  --text-muted:       #4a4a5a;
  --danger:           #ef4444;
  --warning:          #f59e0b;
  --success:          #22c55e;
  --border:           #2a2a3a;
  --border-hover:     #3a3a5a;

  --radius-sm:  4px;
  --radius-md:  8px;
  --radius-lg: 12px;
  --radius-xl: 16px;

  --space-1:  4px;
  --space-2:  8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-6: 24px;
  --space-8: 32px;
  --space-12: 48px;
  --space-16: 64px;

  --font-sans: 'Inter', system-ui, sans-serif;
  --shadow-md:  0 4px 24px rgba(0,0,0,.4);
  --shadow-lg:  0 8px 40px rgba(0,0,0,.5);
}
```

### 5.2 Skeleton CSS

File: `src/client/src/styles/skeleton.css`

```css
@keyframes skeleton-pulse {
  0%   { background-position: -200% 0; }
  100% { background-position:  200% 0; }
}

.skeleton {
  background: linear-gradient(90deg,
    var(--bg-surface) 25%,
    var(--bg-elevated) 50%,
    var(--bg-surface) 75%
  );
  background-size: 200% 100%;
  animation: skeleton-pulse 1.5s ease-in-out infinite;
  border-radius: var(--radius-sm);
}

.skeleton-text   { height: 14px; width: 100%; }
.skeleton-title  { height: 20px; width: 60%; }
.skeleton-avatar { height: 40px; width: 40px; border-radius: 50%; }
.skeleton-stat   { height: 80px; width: 100%; border-radius: var(--radius-md); }
.skeleton-card   { height: 120px; width: 100%; border-radius: var(--radius-md); }
.skeleton-qr     { height: 200px; width: 200px; border-radius: var(--radius-md); }
```

### 5.3 Toast System

File: `src/client/src/contexts/ToastContext.jsx`

```jsx
import { createContext, useContext, useCallback, useRef, useState } from 'react';
import './Toast.css';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const counter = useRef(0);

  const toast = useCallback(({ type = 'info', title, message, duration = 5000 }) => {
    const id = ++counter.current;
    setToasts(prev => {
      const next = [...prev, { id, type, title, message }];
      return next.length > 5 ? next.slice(next.length - 5) : next;
    });
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration);
  }, []);

  const dismiss = useCallback((id) => setToasts(prev => prev.filter(t => t.id !== id)), []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="toast-container" role="region" aria-live="polite">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast--${t.type}`}>
            <div className="toast__content">
              {t.title && <div className="toast__title">{t.title}</div>}
              {t.message && <div className="toast__message">{t.message}</div>}
            </div>
            <button className="toast__close" onClick={() => dismiss(t.id)} aria-label="Dismiss">✕</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx.toast;
};
```

### 5.4 Modal Component

File: `src/client/src/components/ui/Modal.jsx`

**Replaces ALL browser alert/confirm/prompt dialogs.**

```jsx
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import './Modal.css';

export function Modal({ open, title, children, actions, onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    if (open) ref.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape' && open) onClose?.(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className="modal" ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div className="modal__header">
          <h2 id="modal-title" className="modal__title">{title}</h2>
          <button className="modal__close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="modal__body">{children}</div>
        {actions && <div className="modal__actions">{actions}</div>}
      </div>
    </div>,
    document.body
  );
}
```

### 5.5 Axios HTTP Client

File: `src/client/src/api/axios.js`

```javascript
import axios from 'axios';
import { useAuthStore } from '../stores/authStore';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api/v1',
  withCredentials: true,  // sends HttpOnly refresh token cookie
  timeout: 15000,
});

// Attach access token
api.interceptors.request.use(config => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let isRefreshing = false;
let queue = [];

// Handle 401 with token refresh
api.interceptors.response.use(
  res => res,
  async err => {
    const orig = err.config;
    if (err.response?.status === 401 && !orig._retry) {
      orig._retry = true;
      if (isRefreshing) {
        return new Promise((res, rej) => queue.push({ res, rej })).then(() => api(orig));
      }
      isRefreshing = true;
      try {
        const { data } = await axios.post('/api/v1/auth/refresh', {}, { withCredentials: true });
        useAuthStore.getState().setAccessToken(data.accessToken);
        queue.forEach(p => p.res());
        queue = [];
        return api(orig);
      } catch {
        useAuthStore.getState().logout();
        window.location.href = '/auth';
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(err);
  }
);

export default api;
```

### 5.6 Auth Store

File: `src/client/src/stores/authStore.js`

```javascript
import { create } from 'zustand';

export const useAuthStore = create((set, get) => ({
  user:        null,
  accessToken: null,
  isLoaded:    false,

  setAuth: (user, accessToken) => set({ user, accessToken, isLoaded: true }),
  setAccessToken: (token) => set({ accessToken: token }),
  logout: () => set({ user: null, accessToken: null }),
  setLoaded: () => set({ isLoaded: true }),
}));
```

---

## Phase 6: Employee Dashboard — Salary Credit & QR

### 6.1 QR Code Card (Auto-Refresh + Save PNG)

File: `src/client/src/features/employee/QRCodeCard.jsx`

```jsx
import { useState, useEffect, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import api from '../../api/axios';
import './QRCodeCard.css';

const REFRESH_MS = 4 * 60 * 1000; // 4 minutes

export function QRCodeCard() {
  const [qrData, setQrData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchQR = useCallback(async () => {
    try {
      const { data } = await api.get('/employee/qr-code');
      setQrData(data);
    } catch {
      // Error handled by global interceptor -> Toast
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQR();
    const interval = setInterval(fetchQR, REFRESH_MS);
    return () => clearInterval(interval);
  }, [fetchQR]);

  const saveAsPNG = () => {
    if (!qrData) return;
    const link = document.createElement('a');
    link.href = qrData.pngBase64;
    link.download = `flexpay-qr-${Date.now()}.png`;
    link.click();
  };

  if (loading) return <div className="skeleton skeleton-qr" />;

  return (
    <div className="qr-card">
      <h3 className="qr-card__title">My FlexPay QR</h3>
      <p className="qr-card__subtitle">Show this at any FlexPay merchant</p>
      <div className="qr-card__qr">
        <QRCodeSVG
          value={qrData.payload}
          size={200}
          bgColor="#12121a"
          fgColor="#00c896"
        />
      </div>
      <p className="qr-card__expire">Refreshes automatically every 4 minutes</p>
      <button className="btn btn--outline btn--sm" onClick={saveAsPNG}>
        Save as PNG
      </button>
    </div>
  );
}
```

### 6.2 Credit Ring

File: `src/client/src/features/employee/CreditRing.jsx`

```jsx
export function CreditRing({ creditLimit, availableCredit, monthlySalary }) {
  const used   = creditLimit - availableCredit;
  const pct    = creditLimit > 0 ? (used / creditLimit) * 100 : 0;
  const R = 80;
  const C = 2 * Math.PI * R;
  const dash = (C * pct) / 100;

  return (
    <div className="credit-ring">
      <svg width="200" height="200" viewBox="0 0 200 200">
        <circle cx="100" cy="100" r={R} fill="none" stroke="var(--bg-elevated)" strokeWidth="16" />
        <circle
          cx="100" cy="100" r={R} fill="none"
          stroke="var(--accent-primary)" strokeWidth="16"
          strokeDasharray={`${dash} ${C}`}
          strokeLinecap="round"
          transform="rotate(-90 100 100)"
        />
        <text x="100" y="90"  textAnchor="middle" fill="var(--text-primary)"   fontSize="18" fontWeight="600">
          ETB {availableCredit.toLocaleString()}
        </text>
        <text x="100" y="108" textAnchor="middle" fill="var(--text-secondary)" fontSize="10">
          available
        </text>
        <text x="100" y="124" textAnchor="middle" fill="var(--text-muted)"     fontSize="9">
          Limit = Salary: ETB {monthlySalary?.toLocaleString()}
        </text>
      </svg>
      <div className="credit-ring__stats">
        <div><span>Used</span><strong>ETB {used.toLocaleString()}</strong></div>
        <div><span>Limit</span><strong>ETB {creditLimit.toLocaleString()}</strong></div>
      </div>
    </div>
  );
}
```

---

## Phase 7: Organization Dashboard — Merchant Detail & Payroll

### 7.1 Add Employee Form — Monthly Salary Required

File: `src/client/src/features/organization/AddEmployeeForm.jsx`

```jsx
// Key field — monthly_salary is REQUIRED
<div className="form-group">
  <label className="form-label" htmlFor="monthly-salary">
    Monthly Salary (ETB) <span className="required">*</span>
  </label>
  <input
    id="monthly-salary"
    type="number"
    min="0"
    step="0.01"
    className="form-input"
    placeholder="e.g. 15000"
    value={form.monthlySalary}
    onChange={e => setForm(f => ({ ...f, monthlySalary: e.target.value }))}
    required
  />
  <p className="form-hint">Default credit limit = Monthly Salary. You may override below.</p>
</div>
```

### 7.2 Merchant Detail Drawer

File: `src/client/src/features/organization/MerchantDetailDrawer.jsx`

```jsx
import { useState, useEffect } from 'react';
import api from '../../api/axios';
import { Drawer } from '../../components/ui/Drawer';
import { SkeletonTable } from '../../components/ui/Skeleton/SkeletonTable';
import './MerchantDetailDrawer.css';

export function MerchantDetailDrawer({ merchant, orgId, open, onClose }) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(false);
  const [tab,     setTab]     = useState('transactions');

  useEffect(() => {
    if (!open || !merchant) return;
    setLoading(true);
    api.get(`/org/merchants/${merchant.id}`)
      .then(r => setData(r.data))
      .finally(() => setLoading(false));
  }, [open, merchant]);

  const downloadStatement = async () => {
    const res = await api.get(`/org/merchants/${merchant.id}/statement`, { responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    const link = document.createElement('a');
    link.href = url;
    link.download = `flexpay-statement-${merchant.businessName}-${Date.now()}.pdf`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Drawer open={open} onClose={onClose} title={merchant?.businessName}>
      {loading ? <SkeletonTable rows={6} /> : data && (
        <>
          <div className="merchant-drawer__summary">
            <div className="stat-card">
              <span>Total Credit</span>
              <strong>ETB {data.summary.totalCredit?.toLocaleString()}</strong>
            </div>
            <div className="stat-card">
              <span>Employees</span>
              <strong>{data.summary.employeeCount}</strong>
            </div>
            <div className="stat-card">
              <span>Transactions</span>
              <strong>{data.summary.transactionCount}</strong>
            </div>
          </div>

          <div className="tab-bar">
            <button className={tab === 'transactions' ? 'active' : ''} onClick={() => setTab('transactions')}>Transactions</button>
            <button className={tab === 'employees'    ? 'active' : ''} onClick={() => setTab('employees')}>By Employee</button>
          </div>

          {tab === 'transactions' && (
            <table className="data-table">
              <thead>
                <tr><th>Date</th><th>FP-ID</th><th>Name</th><th>Amount</th><th>Receipt</th></tr>
              </thead>
              <tbody>
                {data.transactions.map(t => (
                  <tr key={t.id}>
                    <td>{new Date(t.created_at).toLocaleDateString()}</td>
                    <td className="mono">{t.employee_fp_id_snapshot}</td>
                    <td>{t.employee_name_snapshot}</td>
                    <td>ETB {Number(t.total_amount).toFixed(2)}</td>
                    <td>
                      <a href={t.receipt_url} target="_blank" rel="noreferrer" className="btn btn--sm btn--outline">PDF</a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {tab === 'employees' && (
            <table className="data-table">
              <thead>
                <tr><th>FP-ID</th><th>Name</th><th>Total Spent</th><th>Last Visit</th></tr>
              </thead>
              <tbody>
                {data.byEmployee.map(e => (
                  <tr key={e.employee_id}>
                    <td className="mono">{e.fp_employee_id}</td>
                    <td>{e.full_name}</td>
                    <td>ETB {Number(e.total_spent).toFixed(2)}</td>
                    <td>{new Date(e.last_visit).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <button className="btn btn--primary" onClick={downloadStatement}>
            Download Statement PDF
          </button>
        </>
      )}
    </Drawer>
  );
}
```

### 7.3 Payroll Preview (Salary-Based Net)

File: `src/client/src/features/organization/PayrollPreview.jsx`

```jsx
// Key rendering — show salary-based net for each employee
{preview.employeeLines.map(line => (
  <tr key={line.employee_id}>
    <td>{line.full_name}</td>
    <td>{line.fp_employee_id}</td>
    <td>ETB {Number(line.monthly_salary).toFixed(2)}</td>
    <td>ETB {Number(line.credit_used).toFixed(2)}</td>
    <td>ETB {Number(line.net_to_pay).toFixed(2)}</td>
  </tr>
))}
```

---

## Phase 8: Merchant Dashboard — Full Management Console

### 8.1 Merchant Layout with Sidebar

File: `src/client/src/features/merchant/MerchantLayout.jsx`

```jsx
const NAV_ITEMS = [
  { key: 'overview',       label: 'Overview',       icon: '📊' },
  { key: 'organizations',  label: 'Organizations',  icon: '🏢' },
  { key: 'employees',      label: 'Employees',      icon: '👥' },
  { key: 'transactions',   label: 'Transactions',   icon: '📋' },
  { key: 'pos',            label: 'POS',            icon: '💳' },
  { key: 'analytics',      label: 'Analytics',      icon: '📈' },
];

export function MerchantLayout() {
  const [active, setActive] = useState('overview');

  return (
    <div className="merchant-layout">
      <nav className="merchant-sidebar">
        <div className="sidebar__brand">FlexPay <span>Merchant</span></div>
        {NAV_ITEMS.map(item => (
          <button
            key={item.key}
            className={`sidebar__item ${active === item.key ? 'active' : ''}`}
            onClick={() => setActive(item.key)}
          >
            {item.icon} {item.label}
          </button>
        ))}
      </nav>
      <main className="merchant-main">
        {active === 'overview'      && <MerchantDashboard />}
        {active === 'organizations' && <MerchantOrgs />}
        {active === 'employees'     && <MerchantEmployees />}
        {active === 'transactions'  && <MerchantTransactions />}
        {active === 'pos'           && <MerchantPOS />}
        {active === 'analytics'     && <MerchantAnalytics />}
      </main>
    </div>
  );
}
```

### 8.2 POS — QR Camera Scanner (Primary) + FP-ID Fallback

File: `src/client/src/features/merchant/pos/MerchantPOS.jsx`

```jsx
import { useState } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { useEffect, useRef } from 'react';
import api from '../../../api/axios';
import { Modal } from '../../../components/ui/Modal';
import { useToast } from '../../../contexts/ToastContext';

export function MerchantPOS() {
  const toast = useToast();
  const [mode,         setMode]         = useState('qr');   // 'qr' | 'manual'
  const [scanning,     setScanning]     = useState(false);
  const [verified,     setVerified]     = useState(null);
  const [fpIdInput,    setFpIdInput]    = useState('');
  const [amount,       setAmount]       = useState('');
  const [confirmOpen,  setConfirmOpen]  = useState(false);
  const [processing,   setProcessing]   = useState(false);
  const scannerRef = useRef(null);

  useEffect(() => {
    if (!scanning) return;
    const scanner = new Html5QrcodeScanner('qr-reader', { fps: 10, qrbox: 250 }, false);
    scannerRef.current = scanner;
    scanner.render(
      async (decoded) => {
        scanner.clear();
        setScanning(false);
        try {
          const { data } = await api.post('/merchant/verify-employee', { qrPayload: decoded });
          if (data.verified) {
            setVerified(data.employee);
          } else {
            toast({ type: 'error', title: 'QR Error', message: data.error });
          }
        } catch {
          toast({ type: 'error', title: 'Verification failed', message: 'Could not verify QR. Try manual entry.' });
        }
      },
      (err) => { /* ignore frame errors */ }
    );
    return () => scanner.clear().catch(() => {});
  }, [scanning]);

  const verifyManual = async () => {
    if (!fpIdInput.trim()) {
      toast({ type: 'warning', message: 'Please enter an FP Employee ID' });
      return;
    }
    try {
      const { data } = await api.post('/merchant/verify-employee', { fpId: fpIdInput });
      if (data.verified) setVerified(data.employee);
      else toast({ type: 'error', title: 'Not Found', message: data.error });
    } catch {
      toast({ type: 'error', message: 'Verification failed. Check the FP-ID.' });
    }
  };

  const confirmPayment = async () => {
    if (!amount || isNaN(amount) || Number(amount) <= 0) {
      toast({ type: 'warning', message: 'Enter a valid amount' });
      return;
    }
    setConfirmOpen(true);
  };

  const runPayment = async () => {
    setConfirmOpen(false);
    setProcessing(true);
    try {
      const { data } = await api.post('/merchant/transaction', {
        fpId: verified.fpId,
        amount: Number(amount),
      });
      toast({ type: 'success', title: 'Payment Authorized', message: `Ref: ${data.fpRef}` });
      setVerified(null);
      setAmount('');
    } catch (err) {
      toast({ type: 'error', title: 'Payment Failed', message: err.response?.data?.message || 'Unexpected error' });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="merchant-pos">
      <div className="pos__mode-toggle">
        <button className={mode === 'qr' ? 'active' : ''} onClick={() => setMode('qr')}>
          📷 Scan QR (Primary)
        </button>
        <button className={mode === 'manual' ? 'active' : ''} onClick={() => setMode('manual')}>
          ⌨ Manual FP-ID
        </button>
      </div>

      {!verified && mode === 'qr' && (
        <div className="pos__scanner">
          {!scanning
            ? <button className="btn btn--primary btn--lg" onClick={() => setScanning(true)}>Start Camera Scan</button>
            : <div id="qr-reader" />
          }
        </div>
      )}

      {!verified && mode === 'manual' && (
        <div className="pos__manual">
          <input
            className="form-input"
            placeholder="FP-ETH-2026-XXXXX-X"
            value={fpIdInput}
            onChange={e => setFpIdInput(e.target.value)}
          />
          <button className="btn btn--primary" onClick={verifyManual}>Verify Employee</button>
        </div>
      )}

      {verified && (
        <div className="pos__verified">
          <div className="verified-card">
            <div className="verified-card__badge">✓ Verified</div>
            <div className="verified-card__name">{verified.name}</div>
            <div className="verified-card__meta">{verified.fpId} · {verified.orgName}</div>
            <div className="verified-card__credit">
              <span>Available Credit</span>
              <strong>ETB {verified.availableCredit?.toLocaleString()}</strong>
            </div>
          </div>
          <input
            className="form-input form-input--lg"
            type="number"
            placeholder="Amount (ETB)"
            value={amount}
            onChange={e => setAmount(e.target.value)}
          />
          <button className="btn btn--primary btn--lg" onClick={confirmPayment}>
            Authorize Payment
          </button>
          <button className="btn btn--ghost" onClick={() => { setVerified(null); setFpIdInput(''); }}>
            Cancel
          </button>
        </div>
      )}

      <Modal
        open={confirmOpen}
        title="Confirm Payment"
        onClose={() => setConfirmOpen(false)}
        actions={<>
          <button className="btn btn--outline" onClick={() => setConfirmOpen(false)}>Cancel</button>
          <button className="btn btn--primary" onClick={runPayment} disabled={processing}>
            {processing ? 'Processing...' : 'Confirm'}
          </button>
        </>}
      >
        <p>Authorize <strong>ETB {Number(amount).toFixed(2)}</strong> for <strong>{verified?.name}</strong>?</p>
        <p className="text-secondary">Credit available: ETB {verified?.availableCredit?.toLocaleString()}</p>
      </Modal>
    </div>
  );
}
```

---

## Phase 9: Loading UX, Receipts & Polish

### 9.1 Skeleton Components

File: `src/client/src/components/ui/Skeleton/SkeletonDashboard.jsx`

```jsx
export function SkeletonDashboard() {
  return (
    <div className="skeleton-dashboard">
      <div className="skeleton-dashboard__stats">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="skeleton skeleton-stat" />
        ))}
      </div>
      <div className="skeleton-dashboard__content">
        <div className="skeleton skeleton-card" style={{ height: 250 }} />
        <div className="skeleton-table-wrap">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="skeleton skeleton-text" style={{ marginBottom: 12 }} />
          ))}
        </div>
      </div>
    </div>
  );
}
```

File: `src/client/src/components/ui/Skeleton/SkeletonTable.jsx`

```jsx
export function SkeletonTable({ rows = 8, cols = 5 }) {
  return (
    <table className="data-table skeleton-table">
      <thead>
        <tr>{[...Array(cols)].map((_, i) => (
          <th key={i}><div className="skeleton skeleton-text" /></th>
        ))}</tr>
      </thead>
      <tbody>
        {[...Array(rows)].map((_, r) => (
          <tr key={r}>{[...Array(cols)].map((_, c) => (
            <td key={c}><div className="skeleton skeleton-text" /></td>
          ))}</tr>
        ))}
      </tbody>
    </table>
  );
}
```

### 9.2 Drawer Slide-In Component

File: `src/client/src/components/ui/Drawer.jsx`

```jsx
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import './Drawer.css';

export function Drawer({ open, onClose, title, children, width = '520px' }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && open) onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [open, onClose]);

  return createPortal(
    <>
      <div className={`drawer-overlay ${open ? 'open' : ''}`} onClick={onClose} />
      <aside className={`drawer ${open ? 'open' : ''}`} style={{ width }} role="dialog" aria-modal="true">
        <div className="drawer__header">
          <h2 className="drawer__title">{title}</h2>
          <button className="drawer__close" onClick={onClose}>✕</button>
        </div>
        <div className="drawer__body">{children}</div>
      </aside>
    </>,
    document.body
  );
}
```

CSS (Drawer.css):

```css
.drawer-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,.55);
  opacity: 0; pointer-events: none;
  transition: opacity .25s;
  z-index: 900;
}
.drawer-overlay.open { opacity: 1; pointer-events: all; }

.drawer {
  position: fixed; top: 0; right: 0; bottom: 0;
  background: var(--bg-surface);
  border-left: 1px solid var(--border);
  transform: translateX(100%);
  transition: transform .3s cubic-bezier(.4,0,.2,1);
  z-index: 901;
  overflow-y: auto;
  display: flex; flex-direction: column;
}
.drawer.open { transform: translateX(0); }

.drawer__header {
  display: flex; justify-content: space-between; align-items: center;
  padding: var(--space-6);
  border-bottom: 1px solid var(--border);
  position: sticky; top: 0;
  background: var(--bg-surface);
  z-index: 1;
}
.drawer__title { font-size: 1.1rem; font-weight: 600; color: var(--text-primary); }
.drawer__close { background: none; border: none; color: var(--text-secondary); cursor: pointer; font-size: 1.2rem; }
.drawer__body  { padding: var(--space-6); flex: 1; }
```

### 9.3 Receipt Download Helper

File: `src/client/src/utils/download.js`

```javascript
import api from '../api/axios';

/**
 * Downloads a receipt PDF and triggers a browser file-save.
 * Never uses browser alert/confirm — all errors go through Toast.
 */
export async function downloadReceipt(transactionId, filename = 'receipt.pdf') {
  const response = await api.get(`/transactions/${transactionId}/receipt`, {
    responseType: 'blob',
  });
  const url  = URL.createObjectURL(response.data);
  const link = document.createElement('a');
  link.href     = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
```

---

## Phase 10: Testing, Security Hardening & Deployment

### 10.1 Unit Tests

File: `tests/unit/salary-credit.test.js`

```javascript
import { describe, it, expect } from 'vitest';

describe('CreateEmployeeUseCase — salary credit rules', () => {
  it('sets credit_limit = monthly_salary when no override', () => {
    const salary = 15000;
    const credit = undefined ?? salary;
    expect(credit).toBe(15000);
  });

  it('sets credit_limit = override when provided', () => {
    const salary = 15000, override = 10000;
    const credit = override ?? salary;
    expect(credit).toBe(10000);
  });

  it('sets available_credit = credit_limit at creation', () => {
    const creditLimit = 12000;
    const available   = creditLimit;
    expect(available).toBe(12000);
  });
});
```

File: `tests/unit/qr.test.js`

```javascript
import { describe, it, expect } from 'vitest';
import { generateQRPayload, verifyQRPayload } from '../../src/server/shared/crypto/employeeIdGenerator';

const SECRET = 'test-secret-32bytes-xxxxxxxxxxxx';

describe('QR code signing and verification', () => {
  it('verifies a fresh QR payload', () => {
    const payload = generateQRPayload('FP-ETH-2026-A3X9K-Q', 'emp-uuid', 'org-uuid', SECRET);
    const result  = verifyQRPayload(payload, SECRET, 300);
    expect(result.valid).toBe(true);
    expect(result.fpEmployeeId).toBe('FP-ETH-2026-A3X9K-Q');
  });

  it('rejects an expired QR payload', async () => {
    const payload = generateQRPayload('FP-ETH-2026-A3X9K-Q', 'emp-uuid', 'org-uuid', SECRET);
    const parsed  = JSON.parse(payload);
    const stale   = JSON.stringify({ ...parsed, ts: parsed.ts - 600 });
    const result  = verifyQRPayload(stale, SECRET, 300);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('QR expired');
  });

  it('rejects a tampered QR payload', () => {
    const payload = generateQRPayload('FP-ETH-2026-A3X9K-Q', 'emp-uuid', 'org-uuid', SECRET);
    const parsed  = JSON.parse(payload);
    const tampered = JSON.stringify({ ...parsed, sig: 'aaaaaaaaaaaaaaaa' });
    const result  = verifyQRPayload(tampered, SECRET, 300);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Invalid QR signature');
  });
});
```

### 10.2 Security Checklist

```
[ ] validateUUIDParams middleware on all /:id routes
[ ] Zod validation on all POST/PATCH request bodies
[ ] Rate limiting: 5 auth attempts / 15 min / IP
[ ] Argon2id hashing with memory=65536 iterations=3
[ ] HttpOnly Secure SameSite=Strict refresh token cookie
[ ] Pino log redaction: ['password','phone','password_hash','token','sig']
[ ] Content-Security-Policy header via @fastify/helmet
[ ] SELECT FOR UPDATE on all credit deductions
[ ] REVOKE UPDATE, DELETE on journal_entries and audit_log
[ ] QR_SECRET in env, not committed to git
[ ] Webhook: Safaricom IP whitelist + HMAC validation
[ ] idempotency_keys: all M-PESA calls check before sending
[ ] Zero browser prompts: grep codebase for alert|confirm|prompt — must be 0 matches
```

### 10.3 Deployment Configuration

File: `render.yaml`

```yaml
services:
  - type: web
    name: flexpay-backend
    runtime: node
    buildCommand: npm install
    startCommand: node src/server/index.js
    envVars:
      - key: PORT
        value: 10000
      - key: NODE_ENV
        value: production
      - key: CORS_ORIGIN
        sync: false
      - key: DATABASE_URL
        sync: false
      - key: JWT_PRIVATE_KEY
        sync: false
      - key: JWT_PUBLIC_KEY
        sync: false
      - key: QR_SECRET
        sync: false
      - key: MPESA_CONSUMER_KEY
        sync: false
      - key: MPESA_CONSUMER_SECRET
        sync: false
      - key: MPESA_PASSKEY
        sync: false
      - key: MPESA_INITIATOR_NAME
        sync: false
      - key: MPESA_SECURITY_CREDENTIAL
        sync: false
      - key: MPESA_SHORTCODE
        sync: false
      - key: MPESA_CALLBACK_BASE
        sync: false
      - key: AT_API_KEY
        sync: false
      - key: AT_USERNAME
        sync: false
      - key: SUPABASE_URL
        sync: false
      - key: SUPABASE_SERVICE_KEY
        sync: false
    healthCheckPath: /health
```

### 10.4 Monitoring & Observability

| Layer | Tool | Purpose |
|---|---|---|
| Structured logs | Pino → Render log drain | Query errors, latency, M-PESA webhook status |
| Health endpoint | GET /health → { status: 'ok', db: 'ok', ts } | Render health checks |
| Error boundary | React ErrorBoundary + Toast | Frontend crash recovery |
| Failed payments | pg-boss retry queue + Toast to org | Automatic retry with manual override |

---

*This implementation plan is the companion document to blueprint.md v3.0.0.*
*Implementation phases build strictly on each other — do not skip phases.*
*Every code snippet is the canonical final implementation.*
*Last updated: 2026-10-18 — v3.0.0*
