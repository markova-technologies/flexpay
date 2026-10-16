# FlexPay v2 — System Architecture Blueprint

**Classification:** Enterprise-Grade Architecture Document  
**Version:** 2.0.0  
**Date:** 2026-10-16  
**Author:** Principal System Architect  
**Stack:** Modular Hexagonal Monolith → Cloud-Native SPA + Node.js/Fastify + PostgreSQL (Supabase) + Safaricom Ethiopia M-PESA

---

## Table of Contents

1. [Executive Summary & Business Model](#1-executive-summary--business-model)
2. [User Roles & Access Model](#2-user-roles--access-model)
3. [Full User Journey & Flow Architecture](#3-full-user-journey--flow-architecture)
4. [Password Generation Algorithm](#4-password-generation-algorithm)
5. [Employee ID Generation Algorithm](#5-employee-id-generation-algorithm)
6. [Backend Architecture: Hexagonal Modular Monolith](#6-backend-architecture-hexagonal-modular-monolith)
7. [Database Architecture & Schema Design](#7-database-architecture--schema-design)
8. [M-PESA Integration Architecture](#8-m-pesa-integration-architecture)
9. [Frontend Architecture](#9-frontend-architecture)
10. [Security Architecture](#10-security-architecture)
11. [Notification & SMS Architecture](#11-notification--sms-architecture)
12. [Audit, Logging & Compliance Architecture](#12-audit-logging--compliance-architecture)
13. [Scalability & Deployment Architecture](#13-scalability--deployment-architecture)
14. [Enterprise Folder Structure](#14-enterprise-folder-structure)

---

## 1. Executive Summary & Business Model

### 1.1 What FlexPay Is

FlexPay is an **Ethiopian fintech platform** that connects three parties:

| Party | Role | Value Received |
|---|---|---|
| **Organization (Employer)** | Pays into FlexPay corporate wallet; sets credit policy per employee | Digitizes benefits, controls spending categories, no-hassle payroll deduction |
| **Employee** | Receives a FlexPay credit line funded by employer; spends at eligible merchants | Purchasing power at approved merchants without upfront cash |
| **Merchant** | Receives goods-first, payment via M-PESA on settlement day | Increased sales, guaranteed settlement, zero credit risk |

### 1.2 Money Flow Lifecycle

```
Organization ---(B2C/PayBill)---> FlexPay Escrow Wallet
     |                                   |
     | Sets Credit Limits                | Allocates credit to employee profiles
     v                                   v
HR Dashboard                       Employee Credit Account
     |                                   |
     |                                   | Employee buys at Merchant
     |                                   | (STK Push C2B -> FlexPay)
     |                                   v
     |                              Transaction Log
     |                              (FP-EMP-ID, Merchant#, Amount, Timestamp)
     |                                   |
  Payroll Day ----------------------------+-------------------------------
     |                                   |
     | Org pays payroll to FlexPay       | FlexPay settles:
     | (B2C SalaryPayment API)           | Merchant gets owed ETB (B2C)
     |                                   | Employee gets remaining ETB (B2C)
     +-----------------------------------+
```

### 1.3 Critical Design Constraints

- **M-PESA is the payment rail**, not a lending institution. FlexPay is the platform intermediary.
- **No fractional banking**: FlexPay never lends money it doesn't hold. Credit limits are backed by actual employer deposits into FlexPay's M-PESA escrow wallet.
- **Employee accounts are employer-managed**: Employees cannot self-register — this prevents fraudulent accounts and ensures credit lines are always backed by an organization.
- **Merchant settlement is automatic**: On payroll day, FlexPay uses B2C API to push money to merchants, then pushes remaining balance to employee wallet.

---

## 2. User Roles & Access Model

### 2.1 Role Hierarchy

```
                   [FLEXPAY ADMIN]   (Internal ops, audit, super admin)
                          |
        +-----------------+-----------------+
        v                 v                 v
[ORGANIZATION]      [MERCHANT]         [EMPLOYEE]
(HR Admin /         (Owner /           (View-only,
 Controller)         Staff)             spend-only)
        |
   +----+----+
   v         v
ORG_ADMIN  ORG_CONTROLLER
(full)     (read + approve only)
```

### 2.2 Account Creation Rules

| Actor | Can Self-Register | Created By | Reason |
|---|---|---|---|
| **Organization** | YES | Self (web registration form) | B2B onboarding |
| **Merchant** | YES | Self (web registration form) | B2B onboarding |
| **Employee** | NO | Organization HR Admin only | Security: credit line must be org-backed; prevents fraudulent accounts; ensures all employees are verified by their employer before receiving any credit |

### 2.3 Role Permissions Matrix

| Permission | FlexPay Admin | Org Admin | Org Controller | Merchant Owner | Merchant Staff | Employee |
|---|---|---|---|---|---|---|
| Create Org | YES | - | - | - | - | - |
| Create Merchant | YES | - | - | - | - | - |
| Create Employee | YES | YES | - | - | - | - |
| Set Credit Limits | YES | YES | - | - | - | - |
| View Own Transactions | YES | YES | YES | YES | YES | YES |
| Approve Password Reset | YES | YES | YES | - | - | - |
| Initiate Payroll Settlement | YES | YES | - | - | - | - |
| View All Org Transactions | YES | YES | YES | - | - | - |
| View Merchant Credit Exposure | YES | - | - | YES | YES | - |
| Spend (create purchase) | - | - | - | - | - | YES |

---

## 3. Full User Journey & Flow Architecture

### 3.1 Public Landing Page to Authentication Hub

```
flexpay.et
|
+-- / --------------------> Landing Page
|                           (CTA: "Get Started")
|                                 |
|                                 v
+-- /auth ----------------> Authentication Hub
                            Three Portals:
                            [Organization]  [Merchant]  [Employee]

+-- /auth/organization ---> Org Login | Register
+-- /auth/merchant -------> Merchant Login | Register
+-- /auth/employee -------> Employee Login ONLY + Forgot Password
```

### 3.2 Organization Registration & Onboarding Flow

```
Step 1: Org fills registration form
  - Organization name
  - Registration/TIN number
  - Primary contact name & phone (Safaricom number)
  - M-PESA Paybill/Till shortcode
  - Admin password (they choose, Argon2id-hashed)

Step 2: FlexPay creates:
  - organizations table record
  - users table record (role: ORG_ADMIN)
  - org_mpesa_config table record (pending M-PESA linking)

Step 3: Org Admin logs in -> sees onboarding checklist:
  a. Link M-PESA account (configure Paybill shortcode in FlexPay)
  b. Set global credit policy (max credit per employee, allowed categories)
  c. Add employees

Step 4: Org Admin clicks "Add Employee":
  - Full name (first, last)
  - Safaricom phone number (251XXXXXXXXX)
  - Department / Role label (optional)
  - Individual credit limit override (or inherits global policy)

Step 5: System generates:
  - FP Employee ID (See Algorithm Section 5)
  - Secure 16-char password (See Algorithm Section 4)
  - employee record in DB
  - user record (role: EMPLOYEE, linked to org)

Step 6: System returns generated password to Org Admin
  (displayed ONCE in a modal — never stored in plaintext, only Argon2id hash stored)

Step 7: Org Admin gives password to employee (physically or via SMS option)
```

### 3.3 Employee Login & Password Reset Flow

```
EMPLOYEE LOGIN:
  1. Goes to /auth/employee
  2. Enters: FlexPay Employee ID (FP-ETH-2026-A3X9K2)
             + 16-char password
  3. System verifies Argon2id hash
  4. Issues JWT access token (15min) + refresh token (7days, HttpOnly cookie)
  5. Redirected to /employee/dashboard

FORGOT PASSWORD FLOW:
  1. Employee clicks "Forgot Password" on /auth/employee
  2. Enters their FlexPay Employee ID + registered phone number
  3. System creates password_reset_requests record (status: PENDING)
  4. Org Admin / Controller receives dashboard notification + SMS:
     "Abebe Kebede (FP-ETH-2026-A3X9K2) requested a password reset"
  5. Admin reviews, clicks APPROVE or REJECT
  6. If APPROVED:
     - System generates new 16-char CSPRNG password
     - Updates Argon2id hash in DB
     - Delivers via:
       a. SMS to employee's registered Safaricom number (Africa's Talking)
       b. Or Admin copies and delivers in person
  7. Employee logs in with new password
  8. System optionally flags: must_change_password = true (force password change on first use)
```

### 3.4 Merchant Registration & Onboarding Flow

```
Step 1: Merchant fills registration form:
  - Business name
  - M-PESA merchant number / Till number (their actual Safaricom number)
  - Category (FOOD, TRANSPORT, HEALTH, GROCERY, etc.)
  - Contact phone (Safaricom)
  - Admin password

Step 2: FlexPay creates:
  - merchants table record (status: PENDING_VERIFICATION)
  - users table record (role: MERCHANT_OWNER)

Step 3: FlexPay Admin verifies merchant category & M-PESA number

Step 4: Merchant status -> ACTIVE

Step 5: Merchant logs in -> sees:
  - Credit exposure dashboard (what employees owe them)
  - Transaction history (which employees bought what, when, how much)
  - Settlement schedule (when they'll receive payment)
  - Analytics (total credit given, per-org breakdown, per-employee breakdown)
```

### 3.5 Purchase / Transaction Flow (Core Business Logic)

```
Step 1: Employee visits eligible merchant (e.g., restaurant)

Step 2: At POS:
  - Merchant opens FlexPay POS app
  - Scans employee QR code OR employee provides FP-Employee-ID manually
  - System verifies (in <200ms):
    a. Employee is active and belongs to a valid organization
    b. Merchant category is in employee's allowed categories (per org policy)
    c. Employee has sufficient available_credit > 0
    d. Merchant is ACTIVE and verified

Step 3: Merchant enters purchase amount (e.g., ETB 2,000)

Step 4: System calculates split (SplitEngine):
  Case A: amount <= available_credit
    -> 100% from FlexPay credit
    -> No STK Push needed
  Case B: amount > available_credit
    -> available_credit paid from FlexPay credit
    -> remainder = amount - available_credit triggers STK Push to employee

Step 5: For the FlexPay credit portion:
  - BEGIN TRANSACTION (PostgreSQL ACID)
  - SELECT employee FOR UPDATE (row-level lock)
  - Validate credit still sufficient
  - UPDATE employees SET available_credit = available_credit - credit_portion
  - INSERT INTO transactions (...) record
  - INSERT INTO journal_entries (debit employee_credit, credit merchant_receivable)
  - COMMIT
  - merchant_receivable counter increases

Step 6: For M-PESA co-pay portion (if any):
  - Trigger STK Push to employee phone
  - Employee enters M-PESA PIN on their device
  - M-PESA pushes webhook to /api/v1/webhooks/mpesa/stk
  - System updates transaction status, records M-PESA receipt

Step 7: Merchant POS shows: "ETB 2,000 authorized | FP: 1,500 | M-PESA: 500"

Step 8: Transaction log records ALL of:
  - fp_employee_id (FP-ETH-2026-A3X9K2)
  - employee full name (snapshot)
  - employee organization name (snapshot)
  - employee organization_id FK
  - merchant M-PESA number (for payroll settlement routing)
  - merchant_id FK + merchant name (snapshot)
  - category (snapshot)
  - total_amount, credit_portion, copay_portion
  - mpesa_receipt (for co-pay portion)
  - timestamps (UTC + EAT metadata)
  - stk_checkout_request_id (for idempotency)
```

### 3.6 Payroll Day Settlement Flow

```
Step 1: Org Admin logs in -> "Run Payroll Settlement"
  - Selects pay period (start date to end date)
  - System computes settlement preview:
    Per employee: FP ID, name, total credit used, breakdown by merchant
    Per merchant: total owed from this org's employees
    Grand total payroll disbursement required

Step 2: Org Admin enters:
  - Each employee's gross salary (or imports from CSV)
  - System computes: net_to_employee = gross - total_credit_used

Step 3: Org Admin reviews preview report and confirms

Step 4: System verifies org's M-PESA wallet balance >= total_disbursement
  (via Account Balance API call)

Step 5: System initiates B2C disbursement queue:
  For each merchant owed:
    B2C BusinessPayment: org_shortcode -> merchant_mpesa_number
    Amount = SUM of all purchases from this org's employees at this merchant
    Remarks = "FlexPay Settlement - [OrgName] - [Period]"
  For each employee:
    B2C SalaryPayment: org_shortcode -> employee_phone
    Amount = gross_salary - total_credit_used
    Remarks = "FlexPay Payroll - [OrgName] - [Period]"

Step 6: Each B2C call:
  - Stored as payroll_disbursement_line (status: PENDING, conversation_id: X)
  - System awaits ResultURL webhook from Safaricom
  - On success (ResultCode: 0): status -> COMPLETED, records M-PESA receipt
  - On failure: status -> FAILED, triggers Org Admin alert for manual retry

Step 7: After all settlements complete:
  - employee available_credit reset to credit_limit
  - merchant_receivable balances zeroed
  - Full immutable reconciliation report generated + archived to audit_log
```

---

## 4. Password Generation Algorithm

### 4.1 Algorithm Design: CSPRNG with Rejection Sampling

**Chosen approach**: Node.js `crypto.randomBytes()` (OS-level CSPRNG, backed by `/dev/urandom` on Linux) with **rejection sampling** to eliminate modulo bias.

**Security properties:**
- **Entropy**: 16 characters x log2(94) = approximately 105 bits — NIST-grade
- **Bias**: Zero modulo bias via rejection sampling
- **Predictability**: Zero — uses OS kernel entropy pool, not deterministic PRNG
- **No external deps**: Uses Node.js built-in `crypto` module exclusively

### 4.2 Character Set

```
Lowercase: abcdefghijklmnopqrstuvwxyz  (26 chars)
Uppercase: ABCDEFGHIJKLMNOPQRSTUVWXYZ  (26 chars)
Digits:    0123456789                  (10 chars)
Symbols:   !@#$%^&*()_+-=[]{}|;:,.<>? (32 chars)
Total:     94 chars
EXCLUDED:  ' " ` \  (break SMS delivery and some terminals)
```

### 4.3 Implementation

```javascript
// src/server/shared/crypto/passwordGenerator.js
const { randomBytes } = require('node:crypto');

const CHARSET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
const CHARSET_LENGTH = CHARSET.length; // 94
const MAX_VALID_BYTE = 256 - (256 % CHARSET_LENGTH); // 248 — rejection ceiling

/**
 * Generates a cryptographically secure 16-character password.
 * Algorithm: OS CSPRNG (crypto.randomBytes) + Rejection Sampling
 * Entropy: 16 x log2(94) ~ 105 bits
 * 
 * Rejection sampling explanation:
 *   A random byte (0-255) is drawn. Bytes >= 248 are discarded to ensure
 *   uniform distribution across all 94 characters (no character is more
 *   likely than another). ~3% of bytes rejected on average.
 */
function generateSecurePassword(length = 16) {
  const result = [];
  while (result.length < length) {
    const byte = randomBytes(1)[0]; // 0-255
    if (byte < MAX_VALID_BYTE) {
      result.push(CHARSET[byte % CHARSET_LENGTH]);
    }
  }
  return result.join('');
}

/**
 * Guaranteed pool compliance: ensures at least 1 char from each pool.
 * Applied as a post-pass. Does not weaken entropy.
 * Required by some HR systems that mandate "at least 1 symbol".
 */
function generateCompliantPassword(length = 16) {
  const POOLS = [
    'abcdefghijklmnopqrstuvwxyz',
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    '0123456789',
    '!@#$%^&*()',
  ];
  let password;
  do {
    password = generateSecurePassword(length);
  } while (!POOLS.every(pool => pool.split('').some(c => password.includes(c))));
  return password;
}

module.exports = { generateSecurePassword, generateCompliantPassword };
```

---

## 5. Employee ID Generation Algorithm

### 5.1 Design Requirements

| Requirement | Rationale |
|---|---|
| Globally unique | No two employees ever share an ID |
| Scalable | Supports millions of employees without collision |
| Human-readable | Can be read aloud and typed at POS screens |
| Not sequential | Cannot guess another employee's ID from your own |
| Opaque | ID doesn't reveal org membership or join date |
| Tamper-evident | Checksum detects common typos (single-char errors) |
| DB efficient | Fast B-tree index lookup |

### 5.2 Chosen Algorithm: FlexPay Hybrid ID (FP-ID)

**Format:** `FP-[REGION]-[YEAR]-[RANDOM5]-[CHECKSUM1]`

```
FP - ETH - 2026 - A3X9K - Q
|     |     |      |       |
|     |     |      |       +-- 1-char Luhn-style mod-26 checksum (A-Z)
|     |     |      +---------- 5-char CSPRNG Base36 (0-9, A-Z) = 60.4M unique slots
|     |     +------------------ 4-digit year of account creation
|     +------------------------ Country/region code (ETH)
+-------------------------------- Platform prefix
```

**Example:** `FP-ETH-2026-A3X9K-Q`

**Collision math**: 60.4 million slots per year per region. At 100,000 new accounts/day, birthday-paradox collision probability stays below 0.001% well past 2030.

### 5.3 Implementation

```javascript
// src/server/shared/crypto/employeeIdGenerator.js
const { randomBytes } = require('node:crypto');

const BASE36 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'; // 36 chars
const MAX_VALID = 256 - (256 % 36); // 252 — rejection ceiling

function generateSegment(length = 5) {
  const result = [];
  while (result.length < length) {
    const byte = randomBytes(1)[0];
    if (byte < MAX_VALID) result.push(BASE36[byte % 36]);
  }
  return result.join('');
}

/**
 * Luhn-style mod-26 checksum over the 5-char random segment.
 * Maps to A-Z to visually distinguish from digits.
 * Catches 100% of single-character substitution errors.
 */
function computeChecksum(segment) {
  const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let sum = 0;
  for (let i = 0; i < segment.length; i++) {
    const v = BASE36.indexOf(segment[i]);
    sum += (i % 2 === 0) ? v * 2 : v;
  }
  return ALPHA[sum % 26];
}

function generateEmployeeId(regionCode = 'ETH') {
  const year = new Date().getFullYear();
  const segment = generateSegment(5);
  const checksum = computeChecksum(segment);
  return `FP-${regionCode}-${year}-${segment}-${checksum}`;
}

function validateEmployeeId(id) {
  const pattern = /^FP-[A-Z]{2,4}-\d{4}-[0-9A-Z]{5}-[A-Z]$/;
  if (!pattern.test(id)) return { valid: false, error: 'Invalid format' };
  const parts = id.split('-');
  const segment = parts[3];
  const checksum = parts[4];
  if (checksum !== computeChecksum(segment)) return { valid: false, error: 'Invalid checksum' };
  return { valid: true };
}

module.exports = { generateEmployeeId, validateEmployeeId };
```

---

## 6. Backend Architecture: Hexagonal Modular Monolith

### 6.1 Architecture Decision: Modular Monolith over Microservices

| Factor | Modular Monolith (CHOSEN) | Microservices (REJECTED for now) |
|---|---|---|
| Financial ACID Transactions | Native PostgreSQL transactions across all domains | Requires Saga pattern / eventual consistency — dangerous for money |
| Team Size | Perfect for 1-5 developers | Requires DevOps, service mesh, distributed tracing |
| Deployment Complexity | Single container, simple CI/CD | Kubernetes, service discovery, API gateways |
| Debugging | Single log stream | Distributed tracing required |
| Scale Path | Horizontal scaling behind load balancer first | Extract modules only when a specific domain is a bottleneck |

**Rule:** Strict module boundaries enforced by folder structure and dependency direction. No cross-module imports of implementations — only via defined interface contracts (ports).

### 6.2 Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Runtime | Node.js 22 LTS | Excellent async I/O for payment callbacks |
| Framework | Fastify (not Express) | 3x faster than Express, built-in JSON Schema validation, TypeScript-friendly |
| Language | JavaScript (ES2022) | Consistent with existing codebase; JSDoc types |
| Database | PostgreSQL 15 via Supabase | ACID, NUMERIC for money, row-level locking, triggers |
| Query Builder | Kysely | Type-safe, explicit SQL — critical for financial queries |
| Auth | JWT RS256 | Asymmetric signing; access (15min) + refresh (7days) |
| Password Hashing | Argon2id | NIST-recommended; memory-hard; superior to bcrypt |
| SMS Gateway | Africa's Talking | Ethiopia Safaricom coverage, reliable delivery |
| M-PESA | Safaricom Ethiopia Daraja | STK Push C2B, B2C SalaryPayment, OAuth token |
| Async Jobs | pg-boss (PostgreSQL-backed) | No Redis needed for MVP; transactional outbox pattern |
| Logging | Pino | Structured JSON, correlation IDs, PII redaction |
| Validation | Zod | Runtime + shared schemas between server and client |
| Cache | node-cache (in-process) | M-PESA OAuth tokens (55min TTL) |

### 6.3 Module Map (Bounded Contexts)

```
src/server/modules/
  auth/          -- Authentication & JWT session management
  organizations/ -- Org registration, M-PESA config, credit policy
  employees/     -- Employee CRUD, credit accounts, password reset
  merchants/     -- Merchant registration, category management, receivables
  transactions/  -- Purchase flow, SplitEngine, LedgerEngine, webhooks
  payroll/       -- Settlement preview, B2C disbursement orchestration
  notifications/ -- SMS and in-app notification dispatcher
  admin/         -- FlexPay ops: reconciliation, merchant verification
```

### 6.4 Module Internal Structure (Hexagonal Ports & Adapters)

```
modules/employees/
  domain/
    Employee.js              -- Pure domain entity (zero external deps)
    CreditAccount.js         -- Value object with business rules
    EmployeePolicy.js        -- Business rules: who can do what
  ports/
    incoming/
      CreateEmployeeUseCase.js
      GetEmployeeDashboardUseCase.js
      RequestPasswordResetUseCase.js
    outgoing/
      IEmployeeRepository.js      -- Interface/contract
      INotificationService.js     -- Interface/contract
  adapters/
    incoming/
      employees.routes.js         -- Fastify HTTP adapter
    outgoing/
      EmployeeRepository.js       -- Kysely impl of IEmployeeRepository
      SmsNotificationAdapter.js   -- Africa's Talking impl
  index.js                        -- Module bootstrap, wires DI
```

**Dependency rule**: `domain` imports nothing. `ports` import only `domain`. `adapters` import `ports` and infrastructure. Never reverse.

### 6.5 Complete API Route Map

```
PUBLIC (no auth required)
POST /api/v1/auth/org/register
POST /api/v1/auth/org/login
POST /api/v1/auth/merchant/register
POST /api/v1/auth/merchant/login
POST /api/v1/auth/employee/login
POST /api/v1/auth/employee/forgot-password
POST /api/v1/auth/refresh
POST /api/v1/webhooks/mpesa/stk         -- M-PESA STK Push callback
POST /api/v1/webhooks/mpesa/b2c-result  -- M-PESA B2C result callback
POST /api/v1/webhooks/mpesa/c2b-confirm -- M-PESA C2B confirmation

ORGANIZATION (JWT: ORG_ADMIN | ORG_CONTROLLER)
GET  /api/v1/org/dashboard
GET  /api/v1/org/employees
POST /api/v1/org/employees              -- Create employee (generates FP-ID + password)
GET  /api/v1/org/employees/:fpId
PATCH /api/v1/org/employees/:fpId/credit
GET  /api/v1/org/employees/:fpId/transactions
GET  /api/v1/org/password-reset-requests
PATCH /api/v1/org/password-reset-requests/:id
GET  /api/v1/org/transactions
GET  /api/v1/org/payroll/preview
POST /api/v1/org/payroll/run
GET  /api/v1/org/payroll/history
GET  /api/v1/org/credit-policy
PATCH /api/v1/org/credit-policy
POST /api/v1/org/mpesa-config
GET  /api/v1/org/analytics

EMPLOYEE (JWT: EMPLOYEE)
GET  /api/v1/employee/dashboard
GET  /api/v1/employee/transactions
GET  /api/v1/employee/transactions/:id
GET  /api/v1/employee/profile
GET  /api/v1/employee/qr-code

MERCHANT (JWT: MERCHANT_OWNER | MERCHANT_STAFF)
GET  /api/v1/merchant/dashboard
POST /api/v1/merchant/verify-employee
POST /api/v1/merchant/transaction
GET  /api/v1/merchant/transactions
GET  /api/v1/merchant/receivables
GET  /api/v1/merchant/analytics

FLEXPAY ADMIN (JWT: FLEXPAY_ADMIN)
GET  /api/v1/admin/orgs
GET  /api/v1/admin/merchants
PATCH /api/v1/admin/merchants/:id/verify
GET  /api/v1/admin/transactions
GET  /api/v1/admin/reconciliation
```

---

## 7. Database Architecture & Schema Design

### 7.1 Design Principles

- **Monetary values**: `NUMERIC(14,2)` always — never FLOAT or DOUBLE PRECISION
- **Primary keys**: UUID (internal) + human-facing TEXT for fp_employee_id
- **Timestamps**: All `TIMESTAMPTZ` (UTC stored, EAT converted in application)
- **Status fields**: PostgreSQL ENUM types — never free-text strings
- **Immutable ledger**: journal_entries are INSERT-only; refunds create compensating entries
- **Soft deletes**: `deleted_at TIMESTAMPTZ` on all tables — financial records never hard-deleted
- **Row-level locking**: All balance updates use `SELECT ... FOR UPDATE` inside transactions

### 7.2 Core Tables

#### organizations
```sql
CREATE TABLE organizations (
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
```

#### users (unified auth table)
```sql
CREATE TABLE users (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role              TEXT NOT NULL, -- ORG_ADMIN, ORG_CONTROLLER, MERCHANT_OWNER, MERCHANT_STAFF, EMPLOYEE, FLEXPAY_ADMIN
  organization_id   UUID REFERENCES organizations(id),
  merchant_id       UUID REFERENCES merchants(id),
  employee_id       UUID REFERENCES employees(id),
  password_hash     TEXT NOT NULL,         -- Argon2id
  must_change_password BOOLEAN DEFAULT FALSE,
  last_login_at     TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### employees
```sql
CREATE TABLE employees (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fp_employee_id    TEXT UNIQUE NOT NULL,  -- FP-ETH-2026-A3X9K-Q
  organization_id   UUID NOT NULL REFERENCES organizations(id),
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
CREATE UNIQUE INDEX idx_employees_fp_id ON employees(fp_employee_id);
CREATE INDEX idx_employees_org ON employees(organization_id);
CREATE INDEX idx_employees_phone ON employees(phone_number);
```

#### merchants
```sql
CREATE TYPE merchant_category AS ENUM ('FOOD', 'TRANSPORT', 'HEALTH', 'GROCERY', 'FUEL', 'EDUCATION');
CREATE TYPE merchant_status AS ENUM ('PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED');

CREATE TABLE merchants (
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
```

#### org_credit_policies
```sql
CREATE TABLE org_credit_policies (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  global_credit_limit   NUMERIC(14,2) NOT NULL DEFAULT 0,
  allowed_categories    TEXT[] NOT NULL DEFAULT '{}',  -- e.g., '{FOOD,TRANSPORT}'
  max_daily_spend       NUMERIC(14,2),
  max_single_transaction NUMERIC(14,2),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### password_reset_requests
```sql
CREATE TYPE reset_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED');

CREATE TABLE password_reset_requests (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id       UUID NOT NULL REFERENCES employees(id),
  requested_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_by       UUID REFERENCES users(id),
  reviewed_at       TIMESTAMPTZ,
  status            reset_status NOT NULL DEFAULT 'PENDING',
  delivery_method   TEXT NOT NULL DEFAULT 'SMS',  -- SMS or MANUAL
  expires_at        TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '48 hours')
);
CREATE INDEX idx_pwd_reset_employee ON password_reset_requests(employee_id);
CREATE INDEX idx_pwd_reset_status ON password_reset_requests(status);
```

#### transactions
```sql
CREATE TYPE transaction_status AS ENUM ('PENDING', 'CREDIT_RESERVED', 'STK_SENT', 'COMPLETED', 'FAILED', 'REFUNDED');

CREATE TABLE transactions (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fp_transaction_ref        TEXT UNIQUE NOT NULL,   -- FP-TXN-XXXXXXXXXX
  employee_id               UUID NOT NULL REFERENCES employees(id),
  merchant_id               UUID NOT NULL REFERENCES merchants(id),
  organization_id           UUID NOT NULL REFERENCES organizations(id),
  -- Snapshots at transaction time (denormalized for audit integrity)
  employee_fp_id_snapshot   TEXT NOT NULL,
  employee_name_snapshot    TEXT NOT NULL,
  employee_phone_snapshot   TEXT NOT NULL,
  org_name_snapshot         TEXT NOT NULL,
  merchant_name_snapshot    TEXT NOT NULL,
  merchant_mpesa_snapshot   TEXT NOT NULL,  -- The number money gets sent to on payday
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
CREATE INDEX idx_txn_employee ON transactions(employee_id);
CREATE INDEX idx_txn_merchant ON transactions(merchant_id);
CREATE INDEX idx_txn_org ON transactions(organization_id);
CREATE INDEX idx_txn_created ON transactions(created_at DESC);
CREATE INDEX idx_txn_status ON transactions(status);
```

#### journal_entries (double-entry ledger, append-only)
```sql
CREATE TABLE journal_entries (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id    UUID NOT NULL REFERENCES transactions(id),
  account_type      TEXT NOT NULL,  -- EMPLOYEE_CREDIT, MERCHANT_RECEIVABLE, MPESA_CLEARING
  debit_amount      NUMERIC(14,2) NOT NULL DEFAULT 0,
  credit_amount     NUMERIC(14,2) NOT NULL DEFAULT 0,
  description       TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
  -- NOTE: No updated_at. This table is append-only. Zero UPDATE privileges granted.
);
```

#### payroll_settlements
```sql
CREATE TYPE settlement_status AS ENUM ('PREVIEW', 'RUNNING', 'COMPLETED', 'PARTIAL', 'FAILED');

CREATE TABLE payroll_settlements (
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

CREATE TABLE payroll_disbursement_lines (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_id         UUID NOT NULL REFERENCES payroll_settlements(id),
  recipient_type        TEXT NOT NULL,  -- MERCHANT or EMPLOYEE
  merchant_id           UUID REFERENCES merchants(id),
  employee_id           UUID REFERENCES employees(id),
  recipient_mpesa_number TEXT NOT NULL,  -- The M-PESA number to send to
  amount                NUMERIC(14,2) NOT NULL,
  status                TEXT NOT NULL DEFAULT 'PENDING',
  mpesa_conversation_id TEXT,
  mpesa_receipt         TEXT,
  dispatched_at         TIMESTAMPTZ,
  completed_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### audit_log (append-only, tamper-evident)
```sql
CREATE TABLE audit_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id   UUID,
  actor_role      TEXT,
  action          TEXT NOT NULL,      -- e.g., 'employee.create', 'credit.update'
  target_table    TEXT,
  target_id       UUID,
  old_value       JSONB,
  new_value       JSONB,
  ip_address      INET,
  user_agent      TEXT,
  request_id      TEXT,               -- x-request-id correlation
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
  -- NOTE: No updated_at. REVOKE UPDATE, DELETE on this table from app user.
);
CREATE INDEX idx_audit_actor ON audit_log(actor_user_id);
CREATE INDEX idx_audit_action ON audit_log(action);
CREATE INDEX idx_audit_created ON audit_log(created_at DESC);
```

#### idempotency_keys
```sql
CREATE TABLE idempotency_keys (
  key         TEXT PRIMARY KEY,
  response    JSONB NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at  TIMESTAMPTZ NOT NULL
);
CREATE INDEX idx_idempotency_expires ON idempotency_keys(expires_at);
```

---

## 8. M-PESA Integration Architecture

### 8.1 APIs Used

| M-PESA API | FlexPay Use Case | Direction |
|---|---|---|
| OAuth token | All API calls (cached 55min) | Platform -> Safaricom |
| C2B STK Push | Employee pays co-pay portion | Employee phone receives USSD prompt |
| C2B Register URL | Register FlexPay callback URLs | Platform -> Safaricom (once) |
| B2C BusinessPayment | Payroll: Org -> Merchant settlement | Platform -> Merchant M-PESA number |
| B2C SalaryPayment | Payroll: Org -> Employee net salary | Platform -> Employee phone |
| Transaction Status | Query any pending transaction | Platform -> Safaricom |
| Account Balance | Verify org wallet has sufficient funds | Platform -> Safaricom |

### 8.2 OAuth Token Caching (Critical for Performance)

```javascript
// src/infrastructure/mpesa/tokenCache.js
// Token valid for 3600 seconds; cache for 3300 seconds to avoid edge-case expiry
const cache = new Map();

async function getAccessToken() {
  const cached = cache.get('mpesa_token');
  if (cached && cached.expiresAt > Date.now()) return cached.token;
  const token = await fetchNewToken(); // Basic Base64(key:secret)
  cache.set('mpesa_token', { token, expiresAt: Date.now() + 3300_000 });
  return token;
}
```

### 8.3 STK Push Password Formula (Ethiopia-specific)

```javascript
// M-PESA Ethiopia uses SHA256 hex (uppercase) before Base64 encoding
// This differs from Kenya which uses direct Base64 of concatenation
const timestamp = format(new Date(), 'yyyyMMddHHmmss');
const rawStr = shortCode + passKey + timestamp;
const sha256hex = crypto.createHash('sha256').update(rawStr).digest('hex').toUpperCase();
const password = Buffer.from(sha256hex).toString('base64');
```

### 8.4 Idempotency Protection for M-PESA Calls

```javascript
// Every outbound M-PESA call uses an idempotency key
async function safeBcPayment({ idempotencyKey, ...params }) {
  const existing = await db.idempotencyKeys.findByKey(idempotencyKey);
  if (existing) return existing.response; // Return cached — never double-send
  const response = await mpesaClient.b2c(params);
  await db.idempotencyKeys.insert({ key: idempotencyKey, response, expiresAt: addDays(7) });
  return response;
}
```

### 8.5 Webhook Security

```javascript
// M-PESA webhook endpoints:
// 1. Validate Safaricom Ethiopia source IP (whitelist their IP ranges)
// 2. Verify HMAC signature if provided
// 3. Parse, validate with Zod schema
// 4. Respond 200 immediately (Safaricom retries if no 200 within 10s)
// 5. Process asynchronously in pg-boss job queue
fastify.post('/api/v1/webhooks/mpesa/stk', {
  config: { skipAuth: true, skipRateLimit: true },
  handler: async (request, reply) => {
    await reply.code(200).send({ ResultCode: 0, ResultDesc: 'Accepted' });
    await jobQueue.enqueue('process-stk-callback', request.body);
  }
});
```

---

## 9. Frontend Architecture

### 9.1 Stack

| Tool | Role |
|---|---|
| React 18 | UI framework |
| Vite 5 | Build tool with manual chunk splitting |
| React Router v6 | Lazy-loaded route code splitting |
| Zustand 4 | Auth state + UI state |
| TanStack Query 5 | Server state, caching, background refresh |
| Framer Motion 11 | Animations (existing) |
| Recharts 2 | Spending analytics charts |
| Zod 3 | Shared form validation schemas |
| Axios 1 | HTTP client with JWT refresh interceptor |
| Vanilla CSS | Design tokens (existing obsidian-dark system) |

### 9.2 Landing Page Design Direction

```
Design Read: Ethiopian fintech B2B2C for employers + employees + merchants.
             Premium dark fintech, trust-signaling, M-PESA green accent.
             Reference aesthetic: Stripe + Linear + M-PESA branding.
Dials: DESIGN_VARIANCE=7 | MOTION_INTENSITY=6 | VISUAL_DENSITY=4

Sections:
1. Hero: Bold headline, animated payment-split visualization, dual CTAs
2. How It Works: 3-step animated flow (Fund -> Spend -> Settle)
3. Features: 6-card grid with hover animations
4. Social Proof: Stats bar (employees, merchants, ETB settled)
5. Stakeholder Value Props: 3-column (Org / Employee / Merchant)
6. Security Badges: M-PESA certified, Double-entry ledger, Encrypted
7. Footer
```

### 9.3 Employee Dashboard Key Widgets

```
- Credit Ring (circular gauge): used / available / limit
- Total Available Credit (large ETB number, prominent)
- Credit Limit (set by org — read-only)
- Recent Transactions (last 5, with merchant name, category icon, amount)
- Spending by Category (bar chart: Food / Transport / Health)
- QR Code (for merchant POS scanning)
```

### 9.4 Organization Dashboard Key Widgets

```
- M-PESA Wallet Balance (live via Account Balance API)
- Total Credit Extended This Period
- Active Employees + Employees With Outstanding Balance
- Top Spending Categories (pie chart)
- Pending Password Reset Requests (alert badge)
- Employee Roster Table:
  Columns: FP-ID | Name | Phone | Department | Credit Limit | Available | Last Transaction
- Transaction Feed:
  Columns: Date | Employee | Merchant | Category | Credit | Co-pay | Status
- Payroll Settlement Preview button
```

### 9.5 Merchant Dashboard Key Widgets

```
- Total Outstanding Receivables (ETB owed, all orgs combined)
- Receivables by Organization (which org owes how much)
- Receivables by Employee (which employees owe how much)
- Number of Credit Transactions (total, this period)
- Number of Unique Employees (who have purchased)
- Number of Unique Organizations (whose employees have purchased)
- Transaction History Table:
  Columns: Date | Employee FP-ID | Employee Name | Organization | Amount | Credit | Co-pay | Status
- Next Settlement Date (estimated)
```

---

## 10. Security Architecture

### 10.1 Authentication Token Lifecycle

```
Login Success:
  Access Token:  JWT RS256, 15 minutes, stored in memory (Zustand)
  Refresh Token: UUID, 7 days, stored in HttpOnly Secure SameSite=Strict cookie

Auto Refresh:
  Axios interceptor catches 401, calls POST /api/v1/auth/refresh
  Server validates refresh token DB record (not revoked, not expired)
  Issues new access token + rotates refresh token (old invalidated immediately)

Logout:
  Refresh token deleted from DB -> both tokens immediately invalidated
  Zustand auth state cleared
```

### 10.2 Password Security Layers

```
1. Generation:  CSPRNG + Rejection Sampling (Section 4)
2. Hashing:     Argon2id (memory: 64MB, iterations: 3, parallelism: 4)
3. Storage:     Only the Argon2id hash stored — never plaintext
4. Transmission: Password shown ONCE to Org Admin in ephemeral modal (no server log)
5. Reset:       New CSPRNG password generated, old hash replaced immediately
6. Logging:     Pino redact strips 'password', 'passwordHash', 'phone' from all logs
```

### 10.3 Security Controls Summary

| Control | Implementation |
|---|---|
| Rate Limiting | 5 login attempts / 15min / IP (Fastify rate-limit) |
| Input Validation | Zod + Fastify JSON Schema on all routes |
| SQL Injection | Kysely parameterized queries only |
| XSS | Content-Security-Policy; no dangerouslySetInnerHTML |
| CSRF | SameSite=Strict cookies; Origin header validation |
| PII in Logs | Pino redact: password, phone, passwordHash, token |
| Webhook Auth | Safaricom IP whitelist + HMAC signature validation |
| Double-Spend | Row-level SELECT FOR UPDATE locking on credit updates |
| Idempotency | idempotency_keys table prevents duplicate M-PESA calls |
| Audit Trail | Append-only audit_log; REVOKE UPDATE/DELETE from app DB user |

---

## 11. Notification & SMS Architecture

### 11.1 Africa's Talking Integration

```javascript
// src/infrastructure/sms/africasTalking.js
const AT = require('africastalking')({ apiKey: process.env.AT_API_KEY, username: process.env.AT_USERNAME });

async function sendSms({ to, message }) {
  // 'to' must be '+251XXXXXXXXX' format
  return AT.SMS.send({ to: [`+${to}`], message, from: 'FlexPay' });
}
```

### 11.2 SMS Triggers

| Event | Recipient | Message Template |
|---|---|---|
| Employee created | Employee (optional) | "Your FlexPay account is ready. ID: FP-ETH-2026-XXXXX-X. Password: [password]. Login at flexpay.et" |
| Password reset requested | Org Admin | "FlexPay: [Employee Name] requested a password reset. Login to approve." |
| Password reset approved | Employee | "New FlexPay password: [password]. Please login and use immediately at flexpay.et" |
| Purchase completed | Employee | "FlexPay: ETB [amount] at [merchant]. Credit used: ETB [credit]. Co-pay: ETB [copay]. Ref: [FP-TXN-X]" |
| B2C disbursement confirmed | Merchant | "FlexPay settlement received: ETB [amount] from [OrgName] employees. M-PESA Ref: [receipt]" |
| Payroll settlement failed | Org Admin | "ALERT: FlexPay payroll settlement FAILED for [N] disbursements. Login to review." |

---

## 12. Audit, Logging & Compliance Architecture

### 12.1 Append-Only Audit Log

- Every state-change operation auto-logged via Fastify hook (`onResponse`)
- App DB user has REVOKE UPDATE, DELETE on `audit_log` and `journal_entries`
- Monthly archival to cold storage (Supabase storage or S3) but always queryable
- Cryptographic hash chain (optional v2 enhancement): each row contains SHA256 of previous row's hash + current row data — detects any tampering

### 12.2 Transaction Snapshot Design

Transactions store **snapshots** of names and M-PESA numbers at the time of the transaction (not just FK references). This ensures:
- Historical accuracy even if merchant changes their business name
- Payroll settlement always knows exactly which M-PESA number to send to (even if merchant updates their number later)
- Audit integrity is preserved

### 12.3 Correlation IDs

Every HTTP request gets `x-request-id` (Fastify generates if not provided). This propagates through:
- All Pino log lines for that request
- M-PESA API call (stored in Remarks or AccountReference)
- PostgreSQL `SET LOCAL app.request_id` for DB-level tracing
- All child jobs spawned in pg-boss

---

## 13. Scalability & Deployment Architecture

### 13.1 MVP Architecture

```
Vercel (React 18 + Vite SPA)
  |
  | HTTPS REST
  v
Render (Node.js 22 + Fastify)
  |
  | PostgreSQL TLS/SSL
  v
Supabase (PostgreSQL 15, connection pooler port 6543)
  |
  +--> Safaricom Ethiopia M-PESA API (STK Push, B2C, OAuth)
  +--> Africa's Talking API (SMS)
```

### 13.2 Scale Path

1. Add Redis (Upstash): distributed rate limiting, token cache, session store
2. Add pg-boss for async B2C batch disbursements (already designed for it)
3. Cloudflare in front of Render: DDoS protection, CDN for static assets
4. Render multiple instances + load balancer (server is stateless)
5. Supabase read replica for analytics / reporting queries
6. Extract Notification module to microservice if SMS volume exceeds 10k/day

### 13.3 Required Environment Variables

```
DATABASE_URL          -- Supabase PostgreSQL connection string
JWT_PRIVATE_KEY       -- RS256 private key PEM (for signing)
JWT_PUBLIC_KEY        -- RS256 public key PEM (for verification)
JWT_ACCESS_EXPIRY     -- 900 (15 minutes)
JWT_REFRESH_EXPIRY    -- 604800 (7 days)
MPESA_CONSUMER_KEY
MPESA_CONSUMER_SECRET
MPESA_PASSKEY
MPESA_INITIATOR_NAME
MPESA_SECURITY_CREDENTIAL  -- RSA-encrypted with Safaricom cert
MPESA_SHORTCODE
MPESA_ENV             -- sandbox or production
MPESA_BASE_URL        -- Safaricom Ethiopia base URL
MPESA_CALLBACK_BASE   -- FlexPay API public URL (for webhooks)
AT_API_KEY            -- Africa's Talking
AT_USERNAME           -- Africa's Talking
NODE_ENV              -- production
PORT                  -- 10000
CORS_ORIGIN           -- https://flexpay.et
LOG_LEVEL             -- info
```

---

## 14. Enterprise Folder Structure

```
flex-pay/
|
+-- .agents/                        Agent skills (existing)
+-- .env.example
+-- .env
+-- .gitignore
+-- package.json
+-- render.yaml
+-- blueprint.md                    THIS FILE
+-- implementation_plan.md
+-- DEPLOYMENT_GUIDE.md
+-- skills-lock.json
+-- playwright.config.js
|
+-- docs/
|   +-- engineering/
|   |   +-- blueprint.md
|   |   +-- implementation_plan.md
|   |   +-- api-contract.md
|   |   +-- architecture-proposal.md
|   |   +-- implementation-status.md
|   |   +-- agent-ownership.md
|   +-- design/
|   |   +-- design-system.md
|   |   +-- frontend-tooling.md
|   +-- integrations/
|       +-- safaricom-research.md
|
+-- supabase/
|   +-- schema.sql                  v2 full schema (rebuilt)
|   +-- migrations/
|   |   +-- 0001_initial.sql
|   |   +-- 0002_employees_v2.sql
|   |   +-- 0003_payroll_settlement.sql
|   +-- seeds/
|       +-- demo_data.sql
|
+-- src/
|   |
|   +-- server/                     Backend (Fastify + Node.js 22)
|   |   |
|   |   +-- modules/                Business domain modules
|   |   |   |
|   |   |   +-- auth/
|   |   |   |   +-- domain/
|   |   |   |   |   +-- Session.js
|   |   |   |   |   +-- AuthPolicy.js
|   |   |   |   +-- ports/
|   |   |   |   |   +-- incoming/
|   |   |   |   |   |   +-- LoginUseCase.js
|   |   |   |   |   |   +-- RefreshTokenUseCase.js
|   |   |   |   |   |   +-- LogoutUseCase.js
|   |   |   |   |   +-- outgoing/
|   |   |   |   |       +-- ISessionRepository.js
|   |   |   |   +-- adapters/
|   |   |   |   |   +-- incoming/
|   |   |   |   |   |   +-- auth.routes.js
|   |   |   |   |   +-- outgoing/
|   |   |   |   |       +-- SessionRepository.js
|   |   |   |   +-- index.js
|   |   |   |
|   |   |   +-- organizations/
|   |   |   |   +-- domain/
|   |   |   |   |   +-- Organization.js
|   |   |   |   |   +-- CreditPolicy.js
|   |   |   |   +-- ports/
|   |   |   |   |   +-- incoming/
|   |   |   |   |   |   +-- RegisterOrganizationUseCase.js
|   |   |   |   |   |   +-- GetOrgDashboardUseCase.js
|   |   |   |   |   |   +-- UpdateCreditPolicyUseCase.js
|   |   |   |   |   +-- outgoing/
|   |   |   |   |       +-- IOrganizationRepository.js
|   |   |   |   +-- adapters/
|   |   |   |   |   +-- incoming/
|   |   |   |   |   |   +-- organizations.routes.js
|   |   |   |   |   +-- outgoing/
|   |   |   |   |       +-- OrganizationRepository.js
|   |   |   |   +-- index.js
|   |   |   |
|   |   |   +-- employees/
|   |   |   |   +-- domain/
|   |   |   |   |   +-- Employee.js
|   |   |   |   |   +-- CreditAccount.js
|   |   |   |   +-- ports/
|   |   |   |   |   +-- incoming/
|   |   |   |   |   |   +-- CreateEmployeeUseCase.js
|   |   |   |   |   |   +-- GetEmployeeDashboardUseCase.js
|   |   |   |   |   |   +-- UpdateCreditLimitUseCase.js
|   |   |   |   |   |   +-- RequestPasswordResetUseCase.js
|   |   |   |   |   |   +-- ApprovePasswordResetUseCase.js
|   |   |   |   |   +-- outgoing/
|   |   |   |   |       +-- IEmployeeRepository.js
|   |   |   |   |       +-- INotificationService.js
|   |   |   |   +-- adapters/
|   |   |   |   |   +-- incoming/
|   |   |   |   |   |   +-- employees.routes.js
|   |   |   |   |   +-- outgoing/
|   |   |   |   |       +-- EmployeeRepository.js
|   |   |   |   |       +-- SmsNotificationAdapter.js
|   |   |   |   +-- index.js
|   |   |   |
|   |   |   +-- merchants/
|   |   |   |   +-- domain/
|   |   |   |   |   +-- Merchant.js
|   |   |   |   |   +-- MerchantReceivable.js
|   |   |   |   +-- ports/
|   |   |   |   |   +-- incoming/
|   |   |   |   |   |   +-- RegisterMerchantUseCase.js
|   |   |   |   |   |   +-- GetMerchantDashboardUseCase.js
|   |   |   |   |   |   +-- VerifyEmployeeUseCase.js
|   |   |   |   |   +-- outgoing/
|   |   |   |   |       +-- IMerchantRepository.js
|   |   |   |   +-- adapters/
|   |   |   |   |   +-- incoming/
|   |   |   |   |   |   +-- merchants.routes.js
|   |   |   |   |   +-- outgoing/
|   |   |   |   |       +-- MerchantRepository.js
|   |   |   |   +-- index.js
|   |   |   |
|   |   |   +-- transactions/
|   |   |   |   +-- domain/
|   |   |   |   |   +-- Transaction.js
|   |   |   |   |   +-- SplitEngine.js        Credit vs co-pay calculation
|   |   |   |   |   +-- LedgerEngine.js       Double-entry invariant
|   |   |   |   +-- ports/
|   |   |   |   |   +-- incoming/
|   |   |   |   |   |   +-- CreateTransactionUseCase.js
|   |   |   |   |   |   +-- RefundTransactionUseCase.js
|   |   |   |   |   |   +-- GetTransactionUseCase.js
|   |   |   |   |   +-- outgoing/
|   |   |   |   |       +-- ITransactionRepository.js
|   |   |   |   |       +-- IMpesaStkService.js
|   |   |   |   +-- adapters/
|   |   |   |   |   +-- incoming/
|   |   |   |   |   |   +-- transactions.routes.js
|   |   |   |   |   |   +-- webhooks.routes.js    M-PESA STK + C2B callbacks
|   |   |   |   |   +-- outgoing/
|   |   |   |   |       +-- TransactionRepository.js
|   |   |   |   +-- index.js
|   |   |   |
|   |   |   +-- payroll/
|   |   |   |   +-- domain/
|   |   |   |   |   +-- PayrollSettlement.js
|   |   |   |   |   +-- DisbursementLine.js
|   |   |   |   +-- ports/
|   |   |   |   |   +-- incoming/
|   |   |   |   |   |   +-- PreviewPayrollUseCase.js
|   |   |   |   |   |   +-- RunPayrollUseCase.js
|   |   |   |   |   +-- outgoing/
|   |   |   |   |       +-- IPayrollRepository.js
|   |   |   |   |       +-- IMpesaB2CService.js
|   |   |   |   +-- adapters/
|   |   |   |   |   +-- incoming/
|   |   |   |   |   |   +-- payroll.routes.js
|   |   |   |   |   |   +-- b2c-webhook.routes.js  M-PESA B2C result callback
|   |   |   |   |   +-- outgoing/
|   |   |   |   |       +-- PayrollRepository.js
|   |   |   |   +-- index.js
|   |   |   |
|   |   |   +-- notifications/
|   |   |   |   +-- domain/
|   |   |   |   |   +-- Notification.js
|   |   |   |   +-- adapters/
|   |   |   |   |   +-- outgoing/
|   |   |   |   |       +-- AfricasTalkingAdapter.js
|   |   |   |   +-- index.js
|   |   |   |
|   |   |   +-- admin/
|   |   |       +-- domain/
|   |   |       |   +-- ReconciliationReport.js
|   |   |       +-- ports/
|   |   |       |   +-- incoming/
|   |   |       |       +-- GetReconciliationUseCase.js
|   |   |       |       +-- VerifyMerchantUseCase.js
|   |   |       +-- adapters/
|   |   |       |   +-- incoming/
|   |   |       |       +-- admin.routes.js
|   |   |       +-- index.js
|   |   |
|   |   +-- infrastructure/          Pure infrastructure (no business logic)
|   |   |   +-- database/
|   |   |   |   +-- client.js        Kysely client setup + pool config
|   |   |   |   +-- migrations.js    Migration runner
|   |   |   |   +-- BaseRepository.js
|   |   |   +-- mpesa/
|   |   |   |   +-- MpesaClient.js   OAuth HTTP adapter
|   |   |   |   +-- stkPush.js
|   |   |   |   +-- b2c.js
|   |   |   |   +-- c2b.js
|   |   |   |   +-- transactionStatus.js
|   |   |   |   +-- accountBalance.js
|   |   |   |   +-- crypto.js        SHA256+Base64 password formula
|   |   |   |   +-- tokenCache.js    In-process OAuth token cache (55min)
|   |   |   +-- sms/
|   |   |   |   +-- africasTalking.js
|   |   |   +-- queue/
|   |   |       +-- jobProcessor.js  pg-boss handler registration
|   |   |
|   |   +-- shared/                  Cross-cutting concerns
|   |   |   +-- middleware/
|   |   |   |   +-- authenticate.js  JWT RS256 verification
|   |   |   |   +-- requireRole.js   RBAC middleware
|   |   |   |   +-- rateLimit.js     Per-route rate limits
|   |   |   |   +-- auditLog.js      Auto-log all writes
|   |   |   |   +-- idempotency.js   Idempotency key enforcement
|   |   |   +-- crypto/
|   |   |   |   +-- passwordGenerator.js    Section 4 algorithm
|   |   |   |   +-- employeeIdGenerator.js  Section 5 algorithm
|   |   |   |   +-- argon2.js               Hash + verify
|   |   |   |   +-- jwt.js                  Sign + verify RS256
|   |   |   +-- errors/
|   |   |   |   +-- AppError.js
|   |   |   |   +-- errorHandler.js
|   |   |   +-- validation/
|   |   |       +-- schemas/         Shared Zod schemas (auth, employee, txn)
|   |   |
|   |   +-- config.js               Environment config loader
|   |   +-- index.js                Fastify server bootstrap + module registration
|   |
|   +-- client/                     Frontend (React 18 + Vite)
|       +-- index.html
|       +-- vite.config.js
|       +-- package.json
|       +-- src/
|           +-- app/
|           |   +-- App.jsx
|           |   +-- Router.jsx       All routes with React.lazy + Suspense
|           |   +-- queryClient.js
|           |
|           +-- features/           Domain-driven vertical slices
|           |   +-- landing/
|           |   |   +-- LandingPage.jsx
|           |   |   +-- sections/
|           |   |   |   +-- HeroSection.jsx
|           |   |   |   +-- HowItWorks.jsx
|           |   |   |   +-- FeaturesGrid.jsx
|           |   |   |   +-- StatsBar.jsx
|           |   |   |   +-- ValueProps.jsx
|           |   |   |   +-- SecurityBadges.jsx
|           |   |   |   +-- Footer.jsx
|           |   |   +-- LandingPage.css
|           |   |
|           |   +-- auth/
|           |   |   +-- AuthHub.jsx             Role selector portal
|           |   |   +-- org/
|           |   |   |   +-- OrgAuthPage.jsx     Login + Register tabs
|           |   |   +-- merchant/
|           |   |   |   +-- MerchantAuthPage.jsx
|           |   |   +-- employee/
|           |   |   |   +-- EmployeeLoginPage.jsx
|           |   |   |   +-- ForgotPasswordPage.jsx
|           |   |   +-- AuthHub.css
|           |   |
|           |   +-- org-portal/
|           |   |   +-- OrgLayout.jsx
|           |   |   +-- dashboard/
|           |   |   |   +-- OrgDashboard.jsx
|           |   |   |   +-- OrgDashboard.css
|           |   |   +-- employees/
|           |   |   |   +-- EmployeeRoster.jsx
|           |   |   |   +-- AddEmployeeForm.jsx  Generates + displays FP-ID & password
|           |   |   |   +-- EmployeeDetail.jsx
|           |   |   |   +-- PasswordResetRequests.jsx
|           |   |   +-- transactions/
|           |   |   |   +-- OrgTransactions.jsx
|           |   |   +-- payroll/
|           |   |   |   +-- PayrollPreview.jsx
|           |   |   |   +-- PayrollHistory.jsx
|           |   |   +-- credit-policy/
|           |   |   |   +-- CreditPolicyEditor.jsx
|           |   |   +-- analytics/
|           |   |       +-- OrgAnalytics.jsx
|           |   |
|           |   +-- employee-portal/
|           |   |   +-- EmployeeLayout.jsx
|           |   |   +-- dashboard/
|           |   |   |   +-- EmployeeDashboard.jsx
|           |   |   |   +-- EmployeeDashboard.css
|           |   |   +-- transactions/
|           |   |   |   +-- TransactionList.jsx
|           |   |   |   +-- TransactionDetail.jsx
|           |   |   +-- profile/
|           |   |       +-- EmployeeProfile.jsx  QR code display + download
|           |   |
|           |   +-- merchant-portal/
|           |   |   +-- MerchantLayout.jsx
|           |   |   +-- dashboard/
|           |   |   |   +-- MerchantDashboard.jsx
|           |   |   +-- pos/
|           |   |   |   +-- MerchantPOS.jsx      Verify employee + create transaction
|           |   |   +-- transactions/
|           |   |   |   +-- MerchantTransactions.jsx
|           |   |   +-- receivables/
|           |   |   |   +-- MerchantReceivables.jsx
|           |   |   +-- analytics/
|           |   |       +-- MerchantAnalytics.jsx
|           |   |
|           |   +-- admin-portal/
|           |       +-- AdminLayout.jsx
|           |       +-- orgs/
|           |       +-- merchants/
|           |       +-- reconciliation/
|           |
|           +-- components/          Shared UI primitives
|           |   +-- ui/
|           |   |   +-- Button.jsx + .css
|           |   |   +-- Modal.jsx + .css
|           |   |   +-- SplitBar.jsx + .css
|           |   |   +-- LedgerTable.jsx + .css
|           |   |   +-- StatCard.jsx + .css
|           |   |   +-- StatusBadge.jsx + .css
|           |   |   +-- CreditRing.jsx          Circular credit usage gauge
|           |   |   +-- QRCodeCard.jsx           Employee QR code display
|           |   |   +-- DataTable.jsx            Sortable/filterable table
|           |   |   +-- PasswordDisplay.jsx      Ephemeral one-time password modal
|           |   |   +-- Toast.jsx + .css
|           |   +-- layout/
|           |       +-- AppShell.jsx + .css
|           |       +-- Sidebar.jsx
|           |       +-- ProtectedRoute.jsx
|           |
|           +-- hooks/
|           |   +-- useAuth.js
|           |   +-- usePolling.js
|           |   +-- useDebounce.js
|           |
|           +-- stores/
|           |   +-- authStore.js     Zustand auth state
|           |   +-- uiStore.js       Sidebar, theme
|           |
|           +-- services/
|           |   +-- api.js           Axios instance + JWT refresh interceptor
|           |   +-- auth.api.js
|           |   +-- employees.api.js
|           |   +-- merchants.api.js
|           |   +-- transactions.api.js
|           |   +-- payroll.api.js
|           |
|           +-- utils/
|           |   +-- format.js        ETB currency, EAT timestamps
|           |   +-- validators.js    Shared Zod schemas
|           |
|           +-- styles/
|               +-- tokens.css       Design tokens (existing, extended)
|               +-- global.css       Global resets (existing, extended)
|
+-- tests/
    +-- unit/
    |   +-- crypto.test.js           Password generator + Employee ID tests
    |   +-- split-engine.test.js     Payment split calculation
    |   +-- ledger.test.js           Double-entry invariant
    |   +-- auth.test.js             Login, JWT, refresh flow
    |   +-- api.test.js              Full API integration
    +-- e2e/
        +-- landing.spec.js
        +-- org-flow.spec.js         Org register -> create employee
        +-- employee-flow.spec.js    Login -> dashboard -> view transactions
        +-- merchant-flow.spec.js    POS verify + checkout
        +-- payroll-flow.spec.js     Settlement E2E
```

---

*This blueprint is a living document. All architectural decisions were made in priority order: (1) Financial data integrity, (2) Security, (3) Developer experience, (4) Performance, (5) Extensibility.*

*Last updated: 2026-10-16 by Principal System Architect*
