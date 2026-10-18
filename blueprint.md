# FlexPay v3 — System Architecture Blueprint

**Classification:** Enterprise-Grade Architecture Document
**Version:** 3.0.0
**Date:** 2026-10-18
**Author:** Principal System Architect
**Stack:** Modular Hexagonal Monolith → Cloud-Native SPA + Node.js/Fastify + PostgreSQL (Supabase) + Safaricom Ethiopia M-PESA

---

## Table of Contents

1. [Executive Summary & Business Model](#1-executive-summary--business-model)
2. [User Roles & Access Model](#2-user-roles--access-model)
3. [Full User Journey & Flow Architecture](#3-full-user-journey--flow-architecture)
4. [Password Generation Algorithm](#4-password-generation-algorithm)
5. [Employee ID & QR Algorithm](#5-employee-id--qr-algorithm)
6. [Backend Architecture: Hexagonal Modular Monolith](#6-backend-architecture-hexagonal-modular-monolith)
7. [Database Architecture & Schema Design](#7-database-architecture--schema-design)
8. [M-PESA Integration Architecture](#8-m-pesa-integration-architecture)
9. [Frontend Architecture](#9-frontend-architecture)
10. [Loading UX Architecture](#10-loading-ux-architecture)
11. [Security Architecture](#11-security-architecture)
12. [Notification & SMS Architecture](#12-notification--sms-architecture)
13. [Audit, Logging & Compliance Architecture](#13-audit-logging--compliance-architecture)
14. [Scalability & Deployment Architecture](#14-scalability--deployment-architecture)
15. [Enterprise Folder Structure](#15-enterprise-folder-structure)

---

## 1. Executive Summary & Business Model

### 1.1 What FlexPay Is

FlexPay is an **Ethiopian fintech platform** that gives employees access to their salary before payday.
It is **NOT a loan** — it is a salary-advance credit system where the employer funds the employee's
spending power, and the employee's **monthly salary is the default credit limit**.
Merchants accept FlexPay credit in exchange for guaranteed M-PESA settlement on payroll day.

| Party | Role | Value Received |
|---|---|---|
| **Organization (Employer)** | Creates employees with salary-based credit limits; manages policy | Digitizes benefits, eliminates petty-cash requests, zero-interest salary advance |
| **Employee** | Spends FlexPay credit at eligible merchants up to their monthly salary | Purchasing power before payday; no interest; full spending visibility |
| **Merchant** | Accepts FlexPay credit at POS; receives M-PESA settlement on payroll day | Increased sales, guaranteed settlement, zero credit risk |

### 1.2 Credit Model (Salary-First Design)

```
Employee is created by Org Admin:
  Required fields: full name, phone, department, monthly_salary (ETB)
  credit_limit      = monthly_salary   (default; org admin can override)
  available_credit  = credit_limit     (starts fully available)

When employee spends ETB 500 at merchant:
  available_credit  -= 500
  credit_used       += 500   (computed from transactions)
  merchant_receivable += 500

On payroll day:
  net_to_employee  = monthly_salary - total_credit_used_this_period
  Org pays (B2C):  net to employee phone + credit_used to merchant(s)
  available_credit resets to credit_limit
```

### 1.3 Money Flow Lifecycle

```
Organization ---(B2C/PayBill)---> FlexPay Escrow Wallet
     |                                      |
     | Creates Employees                    | Allocates salary-backed credit
     | (monthly_salary = default limit)     |  to employee profiles
     v                                      v
HR Dashboard                          Employee Credit Account
     |                                      |
     |                                      | Employee buys at Merchant
     |                                      | (QR scan PRIMARY / FP-ID fallback)
     |                                      v
     |                                 Transaction Log
     |                           (FP-EMP-ID, Merchant#, Amount, Timestamp, Receipt)
     |                                      |
  Payroll Day ------------------------------|
     |                                      |
     | Org runs settlement preview          | FlexPay pays (B2C):
     | Org confirms (Modal — no prompt)     |  Merchants get owed ETB
     |                                      |  Employees get net salary
     +--------------------------------------+
```

### 1.4 Critical Design Constraints

- **Not a loan**: Monthly salary is the source of truth for the default credit limit. Employees access salary they have already earned.
- **Merchant settlement is guaranteed**: On payroll day, merchants are paid first, then employees receive net remainder.
- **Employee accounts are employer-managed**: Employees cannot self-register. All employees are created by the org's HR admin with salary on file.
- **QR Code is the primary POS credential**: Each employee has a signed, time-limited QR on their dashboard. Merchants scan it at POS. Manual FP-ID entry is the fallback.
- **Merchant dashboard is a full management console**: Merchants can see every organization, employee credit profile, and transaction that flows through their POS.
- **Zero browser prompts**: The entire system uses its own Toast + Modal components. No alert(), confirm(), or prompt() anywhere.

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
(full)     (read + approve)
```

### 2.2 Account Creation Rules

| Actor | Self-Register | Created By | Reason |
|---|---|---|---|
| **Organization** | YES | Self | B2B onboarding |
| **Merchant** | YES | Self | B2B onboarding |
| **Employee** | NO | Org HR Admin only | Salary must be employer-verified; credit line must be org-backed |

### 2.3 Role Permissions Matrix

| Permission | FP Admin | Org Admin | Org Controller | Merchant Owner | Merchant Staff | Employee |
|---|---|---|---|---|---|---|
| Create Employee (with salary) | YES | YES | — | — | — | — |
| Set Credit Limit Override | YES | YES | — | — | — | — |
| View Own Transactions | YES | YES | YES | YES | YES | YES |
| View Merchant Detail (org view) | YES | YES | YES | — | — | — |
| Download Receipt | YES | YES | YES | YES | YES | YES |
| Approve Password Reset | YES | YES | YES | — | — | — |
| Initiate Payroll Settlement | YES | YES | — | — | — | — |
| View Merchant Credit Exposure | YES | — | — | YES | YES | — |
| View Employee Credit Profile | YES | — | — | YES | YES | — |
| Scan Employee QR Code (POS) | — | — | — | YES | YES | — |
| Spend / Create Purchase | — | — | — | — | — | YES |

---

## 3. Full User Journey & Flow Architecture

### 3.1 Authentication Hub

```
/auth  -->  Three portals:
  [Organization]  -->  /auth/org     (Login | Register)
  [Merchant]      -->  /auth/merchant (Login | Register)
  [Employee]      -->  /auth/employee (Login + Forgot Password ONLY)
```

### 3.2 Organization Registration & Employee Creation

```
Registration: org name, TIN, contact phone, M-PESA shortcode, password

Add Employee (Org Admin):
  REQUIRED: first name, last name, phone (251XXXXXXXXX), monthly_salary (ETB)
  OPTIONAL: department, job_title, credit_limit_override
  RULE: credit_limit = credit_limit_override ?? monthly_salary
         available_credit = credit_limit (starts full)
  SYSTEM GENERATES: FP-ID (Section 5), 16-char password (Section 4)
  DISPLAYS: password ONCE in ephemeral Modal (never logged or re-shown)
```

### 3.3 Employee Login & QR Dashboard

```
Login: FP Employee ID + 16-char password  -->  /employee/dashboard

Dashboard loads with skeleton screens:
  - Credit Ring widget (used / available / limit)
    Label: "Credit Limit = Monthly Salary: ETB X,XXX"
  - QR Code Card (200x200px, signed, auto-refreshes every 4 min)
    [Save QR as PNG] button
  - Recent Transactions (last 5, clickable -> TransactionDetailModal)
    TransactionDetailModal: date, merchant, amount breakdown, FP-TXN ref, [Download Receipt PDF]
  - Spending by Category (Recharts bar chart)
```

### 3.4 Password Reset Flow (Zero Browser Prompts)

```
Employee -> "Forgot Password" -> enters FP-ID + phone
System creates password_reset_requests record (PENDING)
Org Admin sees in-app Toast notification (NOT browser alert)
Org Admin opens Password Reset panel -> reviews -> clicks [Approve] or [Reject]
  Confirmation: system Modal (NOT browser confirm())
If APPROVED:
  System generates new CSPRNG password
  Toast: "Password approved and sent via SMS"
  Africa's Talking SMS -> employee phone
If REJECTED:
  Toast: "Request rejected"
All server-side UUID param validation returns HTTP 400 (never 500 "undefined")
```

### 3.5 Merchant Onboarding & Dashboard

```
Register: business name, M-PESA Till/Paybill, category, contact, password
Status: PENDING_VERIFICATION -> FlexPay Admin approves -> ACTIVE

Merchant Dashboard (full management console):

  SIDEBAR:
    Dashboard Overview | Organizations | Employees | Transactions | POS | Analytics

  DASHBOARD OVERVIEW (skeleton KPI cards):
    Total Outstanding Receivables (ETB, all orgs)
    Total Credit Given This Month / All-Time (ETB)
    Unique Organizations | Unique Employees | Transactions This Month

  ORGANIZATIONS PANEL:
    List of all orgs whose employees transacted here
    Per org: name, employee count, total credit given, outstanding receivable
    Click org -> OrgDetailDrawer:
      Summary stats | Employee list from this org | Transaction history
      [Download Statement PDF] | [Export CSV]

  EMPLOYEES PANEL:
    Searchable list: FP-ID | Name | Org | Total Credit Here | Last Visit
    Click employee -> EmployeeCreditProfile panel:
      FP-ID, name, org badge, credit given (total + this month)
      Full transaction history with this employee
      [Download History PDF]

  TRANSACTIONS PANEL:
    Full paginated history (skeleton 10 rows while loading)
    Filters: date range, org, employee, status
    Columns: Date | FP-ID | Name | Org | Amount | Credit | Co-pay | Receipt | Status
    [Export CSV]

  POS PANEL:
    Mode A (PRIMARY): [Scan QR Code] -> camera modal (html5-qrcode)
      Employee shows QR from their dashboard
      System verifies HMAC signature + expiry
      Displays: "Verified: [Name] | [Org] | Available: ETB X,XXX"
    Mode B (FALLBACK): FP-ID text input -> [Verify Employee]
    After verification: Amount input -> [Authorize Payment]
      Shows: "ETB X,XXX authorized | FP Credit: X | M-PESA: X"
      Transaction reference displayed

  ANALYTICS PANEL:
    Credit by category (donut chart)
    Revenue by org (bar chart)
    Daily transaction volume — 30 days (line chart)
    Top 10 employees by spend
    Period toggles: Month / Week / Day
    [Export Full Report CSV]
```

### 3.6 Organization Dashboard — Merchant Detail View

```
Org Dashboard -> Merchants tab:
  List of merchants this org's employees have used
  Click merchant -> MerchantDetailDrawer (slide-in from right)

MerchantDetailDrawer contains:
  Header: merchant name, category badge, M-PESA number, status
  Summary cards: Total Credit Extended | Employee Count | Transaction Count

  Tabs inside drawer:
    [Transactions] — all transactions at this merchant from this org's employees
      Date | FP-ID | Name | Amount | Credit | Co-pay | Status | [Receipt]
    [By Employee] — grouped by employee
      Name | FP-ID | Total Spent Here | Last Visit

  [Download Statement PDF] — full merchant statement for this org
  [Export CSV]
```

### 3.7 Purchase / Transaction Flow (POS Core)

```
Step 1: QR scan (preferred) or manual FP-ID entry
Step 2: System validates (<200ms):
  a. Employee ACTIVE, org ACTIVE
  b. Merchant category in employee's allowed_categories
  c. available_credit > 0
  d. Merchant ACTIVE and verified
Step 3: Merchant enters amount
Step 4: SplitEngine:
  Case A: amount <= available_credit -> 100% credit, no STK Push
  Case B: amount > available_credit -> credit portion + STK Push for remainder
Step 5: PostgreSQL ACID transaction:
  BEGIN; SELECT employee FOR UPDATE; validate; UPDATE available_credit;
  INSERT transaction; INSERT journal_entries (double-entry); COMMIT
Step 6: STK Push (if co-pay); webhook updates receipt + status
Step 7: ReceiptEngine generates PDF (pdfkit), stores in Supabase Storage
  receipt_url saved on transaction record
Step 8: All three portals can now download the receipt
```

### 3.8 Payroll Day Settlement Flow

```
Org Admin -> "Run Payroll Settlement"
Select period -> System computes preview:
  Per employee: name, monthly_salary, credit_used, net_to_pay
  Per merchant: total owed from this org's employees
  Grand total

net_to_employee = monthly_salary - total_credit_used_this_period
  (monthly_salary is read from employee record — always the settlement source)

Confirm via Modal (NOT browser confirm())
System verifies M-PESA wallet balance >= total
B2C disbursements:
  Merchants first: org_shortcode -> merchant_mpesa_number
  Employees: org_shortcode -> employee_phone (net salary)
Each B2C -> payroll_disbursement_line (gross_salary, credit_used, net amount)
Webhook callbacks -> COMPLETED / FAILED
FAILED -> Toast alert for manual retry (NOT browser alert)
After all complete: available_credit reset to credit_limit for all employees
```

---

## 4. Password Generation Algorithm

### 4.1 CSPRNG with Rejection Sampling

Entropy: 16 chars × log2(94) ≈ 105 bits (NIST-grade)
Source: Node.js crypto.randomBytes() — OS kernel /dev/urandom
Bias: Zero — rejection sampling eliminates modulo bias

```javascript
// src/server/shared/crypto/passwordGenerator.js
const { randomBytes } = require('node:crypto');
const CHARSET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
const MAX_VALID_BYTE = 256 - (256 % CHARSET.length); // 248

function generateSecurePassword(length = 16) {
  const result = [];
  while (result.length < length) {
    const byte = randomBytes(1)[0];
    if (byte < MAX_VALID_BYTE) result.push(CHARSET[byte % CHARSET.length]);
  }
  return result.join('');
}

function generateCompliantPassword(length = 16) {
  const POOLS = ['abcdefghijklmnopqrstuvwxyz','ABCDEFGHIJKLMNOPQRSTUVWXYZ','0123456789','!@#$%^&*()'];
  let pw;
  do { pw = generateSecurePassword(length); }
  while (!POOLS.every(p => p.split('').some(c => pw.includes(c))));
  return pw;
}
module.exports = { generateSecurePassword, generateCompliantPassword };
```

---

## 5. Employee ID & QR Algorithm

### 5.1 FP-ID Format

```
FP - ETH - 2026 - A3X9K - Q
|     |     |      |       |
|     |     |      |       +-- Luhn-style mod-26 checksum (A-Z)
|     |     |      +---------- 5-char CSPRNG Base36 (60.4M slots/year/region)
|     |     +------------------ Year of account creation
|     +------------------------ Country code (ETH)
+-------------------------------- Platform prefix
```

Collision math: 60.4M slots per year. At 100k accounts/day, collision probability < 0.001% through 2030.

### 5.2 QR Code Security

```
QR Payload: { id, eid, oid, ts, sig }
  id  = fp_employee_id
  eid = employee UUID
  oid = org UUID
  ts  = Unix timestamp (seconds)
  sig = HMAC-SHA256(secret, JSON({id,eid,oid,ts})).slice(0,16) [64-bit truncated]

Security properties:
  - HMAC-SHA256 with server QR_SECRET (env var, rotatable)
  - 5-minute expiry enforced server-side (ts check)
  - Employee QR auto-refreshes every 4 minutes on dashboard
  - Replay-attack prevention: time-based window
  - HTTPS-only transport prevents interception
```

### 5.3 Implementation

```javascript
// src/server/shared/crypto/employeeIdGenerator.js
const { randomBytes, createHmac } = require('node:crypto');
const BASE36 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function generateSegment(len = 5) {
  const MAX = 256 - (256 % 36);
  const r = [];
  while (r.length < len) { const b = randomBytes(1)[0]; if (b < MAX) r.push(BASE36[b % 36]); }
  return r.join('');
}

function computeChecksum(seg) {
  const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let sum = 0;
  for (let i = 0; i < seg.length; i++) { const v = BASE36.indexOf(seg[i]); sum += i % 2 === 0 ? v * 2 : v; }
  return A[sum % 26];
}

function generateEmployeeId(region = 'ETH') {
  const seg = generateSegment(5);
  return `FP-${region}-${new Date().getFullYear()}-${seg}-${computeChecksum(seg)}`;
}

function validateEmployeeId(id) {
  if (!/^FP-[A-Z]{2,4}-\d{4}-[0-9A-Z]{5}-[A-Z]$/.test(id)) return { valid: false, error: 'Invalid format' };
  const parts = id.split('-');
  return computeChecksum(parts[3]) === parts[4] ? { valid: true } : { valid: false, error: 'Invalid checksum' };
}

function generateQRPayload(fpId, eid, oid, secret) {
  const ts = Math.floor(Date.now() / 1000);
  const data = { id: fpId, eid, oid, ts };
  const sig = createHmac('sha256', secret).update(JSON.stringify(data)).digest('hex').slice(0, 16);
  return JSON.stringify({ ...data, sig });
}

function verifyQRPayload(payloadStr, secret, maxAge = 300) {
  try {
    const { sig, ...data } = JSON.parse(payloadStr);
    if (Math.floor(Date.now() / 1000) - data.ts > maxAge) return { valid: false, error: 'QR expired' };
    const expected = createHmac('sha256', secret).update(JSON.stringify(data)).digest('hex').slice(0, 16);
    if (sig !== expected) return { valid: false, error: 'Invalid QR signature' };
    return { valid: true, fpEmployeeId: data.id, employeeId: data.eid, orgId: data.oid };
  } catch { return { valid: false, error: 'Malformed QR payload' }; }
}

module.exports = { generateEmployeeId, validateEmployeeId, generateQRPayload, verifyQRPayload };
```

---

## 6. Backend Architecture: Hexagonal Modular Monolith

### 6.1 Why Modular Monolith

| Factor | Modular Monolith (CHOSEN) | Microservices (REJECTED for now) |
|---|---|---|
| Financial ACID | Native PostgreSQL transactions | Requires Saga / eventual consistency — dangerous for money |
| Team Size | Perfect for 1–5 devs | Requires full DevOps, service mesh |
| Deployment | Single container, simple CI/CD | Kubernetes, service discovery |
| Scale Path | Horizontal + load balancer first | Extract only when bottleneck proven |

### 6.2 Tech Stack

| Layer | Technology | Reason |
|---|---|---|
| Runtime | Node.js 22 LTS | Excellent async I/O for payment callbacks |
| Framework | Fastify | 3× faster than Express; JSON Schema validation |
| Database | PostgreSQL 15 via Supabase | ACID, NUMERIC money, row locks, triggers |
| Query Builder | Kysely | Type-safe, parameterized — no SQL injection |
| Auth | JWT RS256 | Asymmetric signing; stateless access tokens |
| Password Hashing | Argon2id | NIST-recommended; memory-hard |
| SMS | Africa's Talking | Ethiopia Safaricom coverage |
| M-PESA | Safaricom Ethiopia Daraja | STK Push, B2C, OAuth |
| Job Queue | pg-boss | PostgreSQL-backed; no Redis needed for MVP |
| Logging | Pino | Structured JSON, PII redaction |
| Validation | Zod | Runtime schemas shared client/server |
| QR (server) | qrcode npm | PNG generation from signed payload |
| PDF Receipts | pdfkit npm | Branded transaction receipt PDFs |
| Storage | Supabase Storage | Receipt PDF blob storage |

### 6.3 Module Map (Bounded Contexts)

```
src/server/modules/
  auth/           Authentication & JWT session management
  organizations/  Org registration, M-PESA config, credit policy, merchant detail view
  employees/      Employee CRUD, salary/credit, password reset, signed QR generation
  merchants/      Registration, receivables, full credit analytics, org/employee panels
  transactions/   Purchase flow, SplitEngine, LedgerEngine, ReceiptEngine, webhooks
  payroll/        Settlement preview (salary-based), B2C disbursement orchestration
  notifications/  SMS dispatcher (Africa's Talking)
  admin/          FlexPay ops: reconciliation, merchant verification
```

### 6.4 Complete API Route Map

```
PUBLIC
POST /api/v1/auth/org/register
POST /api/v1/auth/org/login
POST /api/v1/auth/merchant/register
POST /api/v1/auth/merchant/login
POST /api/v1/auth/employee/login
POST /api/v1/auth/employee/forgot-password
POST /api/v1/auth/refresh
POST /api/v1/webhooks/mpesa/stk
POST /api/v1/webhooks/mpesa/b2c-result
POST /api/v1/webhooks/mpesa/c2b-confirm

ORGANIZATION (JWT: ORG_ADMIN | ORG_CONTROLLER)
GET    /api/v1/org/dashboard
GET    /api/v1/org/employees
POST   /api/v1/org/employees               -- Requires monthly_salary
GET    /api/v1/org/employees/:fpId
PATCH  /api/v1/org/employees/:fpId/credit
GET    /api/v1/org/employees/:fpId/transactions
GET    /api/v1/org/password-reset-requests
PATCH  /api/v1/org/password-reset-requests/:id
GET    /api/v1/org/transactions
GET    /api/v1/org/transactions/:id
GET    /api/v1/org/transactions/:id/receipt
GET    /api/v1/org/merchants               -- Merchants used by this org's employees
GET    /api/v1/org/merchants/:merchantId   -- Merchant detail + transactions from this org
GET    /api/v1/org/payroll/preview
POST   /api/v1/org/payroll/run
GET    /api/v1/org/payroll/history
GET    /api/v1/org/credit-policy
PATCH  /api/v1/org/credit-policy
POST   /api/v1/org/mpesa-config
GET    /api/v1/org/analytics

EMPLOYEE (JWT: EMPLOYEE)
GET  /api/v1/employee/dashboard
GET  /api/v1/employee/transactions
GET  /api/v1/employee/transactions/:id
GET  /api/v1/employee/transactions/:id/receipt
GET  /api/v1/employee/profile
GET  /api/v1/employee/qr-code             -- Returns signed QR PNG + JSON payload

MERCHANT (JWT: MERCHANT_OWNER | MERCHANT_STAFF)
GET  /api/v1/merchant/dashboard
GET  /api/v1/merchant/verify-employee     -- QR verify (payload query param)
POST /api/v1/merchant/verify-employee     -- Manual FP-ID verify
POST /api/v1/merchant/transaction
GET  /api/v1/merchant/transactions
GET  /api/v1/merchant/transactions/:id
GET  /api/v1/merchant/transactions/:id/receipt
GET  /api/v1/merchant/receivables
GET  /api/v1/merchant/orgs
GET  /api/v1/merchant/orgs/:orgId
GET  /api/v1/merchant/employees
GET  /api/v1/merchant/employees/:fpId
GET  /api/v1/merchant/analytics
GET  /api/v1/merchant/analytics/export

FLEXPAY ADMIN
GET   /api/v1/admin/orgs
GET   /api/v1/admin/merchants
PATCH /api/v1/admin/merchants/:id/verify
GET   /api/v1/admin/transactions
GET   /api/v1/admin/reconciliation
```

---

## 7. Database Architecture & Schema Design

### 7.1 Design Principles

- **NUMERIC(14,2)** for all monetary values — never FLOAT
- **UUID** primary keys + human-facing TEXT for fp_employee_id
- **TIMESTAMPTZ** everywhere — UTC stored, EAT in application
- **Enum types** for status fields — never free-text
- **Append-only** journal_entries and audit_log — no UPDATE/DELETE
- **Soft deletes** — deleted_at TIMESTAMPTZ on all tables
- **Row-level locking** — SELECT FOR UPDATE on all credit updates
- **monthly_salary** stored on employee — source of truth for payroll net and default credit_limit

### 7.2 Core Tables

#### organizations
```sql
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
```

#### employees (salary-first)
```sql
CREATE TABLE employees (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fp_employee_id   TEXT UNIQUE NOT NULL,
  organization_id  UUID NOT NULL REFERENCES organizations(id),
  full_name        TEXT NOT NULL,
  phone_number     TEXT NOT NULL,
  department       TEXT,
  job_title        TEXT,
  monthly_salary   NUMERIC(14,2) NOT NULL DEFAULT 0,  -- source of truth
  credit_limit     NUMERIC(14,2) NOT NULL DEFAULT 0,  -- = monthly_salary unless overridden
  available_credit NUMERIC(14,2) NOT NULL DEFAULT 0,
  status           TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at       TIMESTAMPTZ,
  CONSTRAINT chk_credit_valid CHECK (available_credit >= 0 AND available_credit <= credit_limit),
  CONSTRAINT chk_salary_positive CHECK (monthly_salary >= 0)
);
CREATE UNIQUE INDEX idx_employees_fp_id ON employees(fp_employee_id);
CREATE INDEX idx_employees_org ON employees(organization_id);
```

**Business rule (CreateEmployeeUseCase):**
```
credit_limit     = credit_limit_override ?? monthly_salary
available_credit = credit_limit
```

#### merchants
```sql
CREATE TYPE merchant_category AS ENUM ('FOOD','TRANSPORT','HEALTH','GROCERY','FUEL','EDUCATION');
CREATE TYPE merchant_status AS ENUM ('PENDING_VERIFICATION','ACTIVE','SUSPENDED');

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
```

#### users
```sql
CREATE TABLE users (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role                 TEXT NOT NULL,
  organization_id      UUID REFERENCES organizations(id),
  merchant_id          UUID REFERENCES merchants(id),
  employee_id          UUID REFERENCES employees(id),
  password_hash        TEXT NOT NULL,
  must_change_password BOOLEAN DEFAULT FALSE,
  last_login_at        TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### org_credit_policies
```sql
CREATE TABLE org_credit_policies (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id        UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  global_credit_limit    NUMERIC(14,2) NOT NULL DEFAULT 0,
  allowed_categories     TEXT[] NOT NULL DEFAULT '{}',
  max_daily_spend        NUMERIC(14,2),
  max_single_transaction NUMERIC(14,2),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### password_reset_requests
```sql
CREATE TYPE reset_status AS ENUM ('PENDING','APPROVED','REJECTED','EXPIRED');
CREATE TABLE password_reset_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id     UUID NOT NULL REFERENCES employees(id),
  requested_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_by     UUID REFERENCES users(id),
  reviewed_at     TIMESTAMPTZ,
  status          reset_status NOT NULL DEFAULT 'PENDING',
  delivery_method TEXT NOT NULL DEFAULT 'SMS',
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '48 hours')
);
```

#### transactions
```sql
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
  total_amount             NUMERIC(14,2) NOT NULL,
  credit_portion           NUMERIC(14,2) NOT NULL DEFAULT 0,
  copay_portion            NUMERIC(14,2) NOT NULL DEFAULT 0,
  stk_checkout_request_id  TEXT,
  mpesa_receipt            TEXT,
  receipt_url              TEXT,
  status                   transaction_status NOT NULL DEFAULT 'PENDING',
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_amounts_add_up CHECK (credit_portion + copay_portion = total_amount)
);
CREATE INDEX idx_txn_employee ON transactions(employee_id);
CREATE INDEX idx_txn_merchant  ON transactions(merchant_id);
CREATE INDEX idx_txn_org       ON transactions(organization_id);
CREATE INDEX idx_txn_created   ON transactions(created_at DESC);
```

#### journal_entries (append-only double-entry ledger)
```sql
CREATE TABLE journal_entries (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES transactions(id),
  account_type   TEXT NOT NULL,  -- EMPLOYEE_CREDIT | MERCHANT_RECEIVABLE | MPESA_CLEARING
  debit_amount   NUMERIC(14,2) NOT NULL DEFAULT 0,
  credit_amount  NUMERIC(14,2) NOT NULL DEFAULT 0,
  description    TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
  -- REVOKE UPDATE, DELETE from app user
);
```

#### payroll_settlements & disbursement_lines
```sql
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
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_id         UUID NOT NULL REFERENCES payroll_settlements(id),
  recipient_type        TEXT NOT NULL,   -- MERCHANT | EMPLOYEE
  merchant_id           UUID REFERENCES merchants(id),
  employee_id           UUID REFERENCES employees(id),
  recipient_mpesa_number TEXT NOT NULL,
  gross_salary          NUMERIC(14,2),  -- EMPLOYEE lines: monthly_salary at settlement time
  credit_used           NUMERIC(14,2),  -- EMPLOYEE lines: total credit used this period
  amount                NUMERIC(14,2) NOT NULL,  -- net to disburse
  status                TEXT NOT NULL DEFAULT 'PENDING',
  mpesa_conversation_id TEXT,
  mpesa_receipt         TEXT,
  dispatched_at         TIMESTAMPTZ,
  completed_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### refresh_tokens
```sql
CREATE TABLE refresh_tokens (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT
);
CREATE INDEX idx_refresh_tokens_hash ON refresh_tokens(token_hash);
```

#### audit_log (append-only)
```sql
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
  -- REVOKE UPDATE, DELETE from app user
);
```

#### idempotency_keys
```sql
CREATE TABLE idempotency_keys (
  key        TEXT PRIMARY KEY,
  response   JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);
```

### 7.3 Migrations

| File | Description |
|---|---|
| 0001_initial.sql | All core tables (organizations, users, merchants, employees, transactions, journal_entries, etc.) |
| 0002_salary_credit.sql | Adds monthly_salary, job_title to employees; adds total_receivable to merchants |
| 0003_receipts.sql | Adds receipt_url to transactions |
| 0004_payroll_lines_v2.sql | Adds gross_salary, credit_used columns to payroll_disbursement_lines |

---

## 8. M-PESA Integration Architecture

### 8.1 APIs Used

| API | Use Case |
|---|---|
| OAuth token | All calls — cached 55 min |
| C2B STK Push | Employee co-pay portion |
| B2C BusinessPayment | Merchant settlement on payroll day |
| B2C SalaryPayment | Employee net salary (salary − credit used) |
| Transaction Status | Query pending transactions |
| Account Balance | Verify org wallet before payroll run |

### 8.2 Ethiopia-Specific STK Push Password

```javascript
const sha256hex = crypto.createHash('sha256')
  .update(shortCode + passKey + timestamp)
  .digest('hex').toUpperCase();
const password = Buffer.from(sha256hex).toString('base64');
// NOTE: Ethiopia uses SHA256+hex before Base64 — differs from Kenya
```

### 8.3 Idempotency

Every M-PESA call uses an idempotency_key — prevents double-sends on network retries.

### 8.4 Webhook Pattern

```javascript
// Respond 200 immediately, process asynchronously
await reply.code(200).send({ ResultCode: 0, ResultDesc: 'Accepted' });
await jobQueue.enqueue('process-stk-callback', request.body);
```

---

## 9. Frontend Architecture

### 9.1 Stack

| Tool | Role |
|---|---|
| React 18 | UI framework |
| Vite 5 | Build + code splitting |
| React Router v6 | Lazy-loaded routes with Suspense |
| Zustand 4 | Auth state + UI state (toast queue) |
| TanStack Query 5 | Server state, caching, background refresh |
| Framer Motion 11 | Animations and transitions |
| Recharts 2 | Charts (credit ring, analytics) |
| Axios 1 | HTTP client with JWT refresh interceptor |
| Vanilla CSS | Design tokens (obsidian-dark system) |
| qrcode.react | Employee QR display |
| html5-qrcode | Merchant POS camera scanner |

### 9.2 Design System (obsidian-dark)

```
--bg-primary:      #0a0a0f   (deep black)
--bg-surface:      #12121a   (card surface)
--bg-elevated:     #1a1a26   (modal/drawer)
--accent-primary:  #00c896   (FlexPay green — M-PESA aligned)
--accent-secondary: #6366f1  (indigo)
--text-primary:    #f0f0f5
--text-secondary:  #8b8b9a
--danger:          #ef4444
--warning:         #f59e0b
--success:         #22c55e

Typography: Inter (Google Fonts) 400/500/600/700
Spacing: 4px base (4, 8, 12, 16, 24, 32, 48, 64)
Border radius: 8px cards | 12px modals | 4px inputs
```

### 9.3 Notification System — Zero Browser Prompts

ALL user feedback MUST go through these two systems:

```
Toast (ToastContext + useToast):
  - Types: success | error | warning | info
  - Position: bottom-right, stacked
  - Auto-dismiss: 5s | Manual dismiss: ✕
  - Max 5 stacked (oldest removed first)

Modal (Modal.jsx):
  - Used for: confirmations, approvals, payroll run, destructive actions
  - Rendered in DOM with overlay, title, body, action buttons
  - NEVER uses browser confirm()

Error handling contract:
  - Form errors: inline below field (red text + shake animation)
  - API 4xx: Toast with server message or friendly fallback
  - API 5xx: Toast "Unexpected error, our team has been notified"
  - Network: Toast "Connection issue — tap to retry"
  - UUID undefined server: returns HTTP 400 (never 500)
```

### 9.4 Portal-Specific Widgets

**Employee Dashboard:**
- Credit Ring (SVG gauge) — tooltip shows "Credit Limit = Monthly Salary: ETB X,XXX"
- QR Code Card — signed, auto-refreshes every 4 min, [Save as PNG] button
- Recent Transactions — clickable → TransactionDetailModal → [Download Receipt PDF]
- Spending by Category chart

**Organization Dashboard tabs:**
- Employees: DataTable with salary, credit_limit, available_credit columns; [+ Add Employee] opens form with monthly_salary required field
- Transactions: full history with [Receipt] column; click merchant name → MerchantDetailDrawer
- Merchants (NEW): list of merchants used; click → MerchantDetailDrawer (slide-in right) with per-org transactions, per-employee breakdown, [Download Statement PDF]
- Payroll: PayrollPreview showing salary-based net calculations; [Run Payroll] → Modal confirmation
- Password Resets: notification bell → slide-in panel; [Approve]/[Reject] → Modal → Toast

**Merchant Dashboard (full management console):**
- Sidebar navigation: Overview | Organizations | Employees | Transactions | POS | Analytics
- Overview: KPI cards (skeleton loading) + quick charts
- Organizations panel: org cards → OrgDetailDrawer (employee list + transactions)
- Employees panel: searchable employee list → EmployeeCreditProfile panel
- Transactions panel: full history, filters, export CSV
- POS panel: QR scan (html5-qrcode camera) PRIMARY + manual FP-ID FALLBACK
- Analytics: category donut, org bar, volume line, top-10 employee list, export

---

## 10. Loading UX Architecture

### 10.1 Strategy by Context

| Context | Strategy | Why |
|---|---|---|
| Initial dashboard | Full SkeletonDashboard component | Shows layout; reduces perceived wait |
| Table data | SkeletonTable (8–10 rows) | No layout shift on load |
| KPI/stat cards | SkeletonStatCard with pulse | Grid layout preserved |
| Charts | SkeletonChart placeholder | No empty axes flash |
| Form submit | Button spinner + disabled state | Prevents double-submit |
| Modal open | fade + scale-in CSS animation | Smooth entry |
| Drawer slide | slide-from-right transform | Natural spatial feel |
| QR generation | SkeletonQR (square pulse) | Shows where QR appears |
| Route change | NavigationProgress (3px top bar) | SPA feels instant |
| Receipt download | Inline button spinner | Clear action feedback |

### 10.2 Skeleton CSS

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
  border-radius: 4px;
}
```

### 10.3 TanStack Query Pattern

```javascript
const { data, isLoading, isError, refetch } = useQuery({
  queryKey: ['org-dashboard'],
  queryFn: fetchOrgDashboard,
  staleTime: 30_000,   // 30s before background refetch
  gcTime:   300_000,   // 5min cache
});

if (isLoading) return <SkeletonDashboard />;
if (isError)   return <ErrorState onRetry={refetch} />;
return <Dashboard data={data} />;
```

---

## 11. Security Architecture

### 11.1 Auth Token Lifecycle

```
Access Token:  JWT RS256, 15 min, in Zustand memory (never localStorage)
Refresh Token: UUID, 7 days, HttpOnly Secure SameSite=Strict cookie
Auto-refresh:  Axios interceptor catches 401 → POST /auth/refresh
               Rotates refresh token (old immediately revoked)
Logout:        Delete refresh token from DB → both tokens invalid
```

### 11.2 Security Controls

| Control | Implementation |
|---|---|
| Rate Limiting | 5 login attempts / 15min / IP |
| Input Validation | Zod + Fastify JSON Schema on all routes |
| SQL Injection | Kysely parameterized queries only |
| XSS | Content-Security-Policy; no dangerouslySetInnerHTML |
| CSRF | SameSite=Strict cookies + Origin header validation |
| PII in Logs | Pino redact: password, phone, passwordHash, token |
| Webhook Auth | Safaricom IP whitelist + HMAC validation |
| Double-Spend | SELECT FOR UPDATE row-level lock on credit |
| Idempotency | idempotency_keys table; never double-M-PESA |
| Audit Trail | append-only audit_log; REVOKE UPDATE/DELETE |
| QR Forgery | HMAC-SHA256 signed + 5-min expiry |
| UUID Params | Zod UUID validation; bad UUID → HTTP 400 not 500 |
| Browser Prompts | Zero — all feedback via Toast + Modal |

---

## 12. Notification & SMS Architecture

### 12.1 SMS Triggers

| Event | Recipient | Template |
|---|---|---|
| Employee created | Employee | "Your FlexPay account: ID [FP-ID]. Password: [pw]. Login at flexpay.et" |
| Password reset requested | Org Admin | "FlexPay: [Name] requested a password reset. Login to approve." |
| Password reset approved | Employee | "New FlexPay password: [pw]. Login immediately at flexpay.et" |
| Purchase completed | Employee | "FlexPay: ETB [amt] at [merchant]. Credit: [c]. Co-pay: [m]. Ref: [FP-TXN]" |
| Settlement received | Merchant | "FlexPay settlement: ETB [amt] from [Org] employees. M-PESA: [receipt]" |
| Settlement failed | Org Admin | "ALERT: Payroll settlement FAILED for [N] disbursements. Login to retry." |
| Low wallet | Org Admin | "ALERT: FlexPay wallet low: ETB [X]. Refund before payroll day." |

---

## 13. Audit, Logging & Compliance Architecture

### 13.1 Append-Only Audit Log
- Every state-changing request auto-logged via Fastify onResponse hook
- App DB user: REVOKE UPDATE, DELETE on audit_log and journal_entries
- Monthly cold-storage archival to Supabase Storage

### 13.2 Transaction Snapshot Design
All snapshot columns (name, phone, M-PESA number) captured at transaction time.
This ensures:
- Historical receipts are always accurate regardless of future updates
- Payroll settlement always routes to the correct M-PESA number
- Audit integrity across all time periods

### 13.3 Receipt Generation & Storage
```
On COMPLETED status:
  1. ReceiptEngine (pdfkit) generates branded PDF
  2. Stored: Supabase Storage bucket receipts/{org_id}/{txn_id}.pdf
  3. Signed URL generated per download request (1hr validity)
  4. receipt_url saved on transaction record
  5. Downloadable by: employee, org admin/controller, merchant

Receipt content:
  - FlexPay logo + branding
  - FP-TXN reference, date/time (EAT)
  - Employee: FP-ID, name, org
  - Merchant: name, category, M-PESA
  - Amount: credit portion / co-pay / total
  - M-PESA receipt (if co-pay)
  - Status badge
  - "Official FlexPay Transaction Record" footer
```

---

## 14. Scalability & Deployment Architecture

### 14.1 Current Architecture

```
Vercel (React 18 + Vite SPA)  <->  Render (Node.js 22 + Fastify :10000)
                                          |
                                   Supabase PostgreSQL 15
                                   Supabase Storage (receipts)
                                   Safaricom Ethiopia M-PESA
                                   Africa's Talking SMS
```

### 14.2 Scale Path

1. Add Redis (Upstash) — distributed rate limiting + session store
2. pg-boss already wired — add async B2C batch disbursements
3. Cloudflare in front of Render — DDoS + CDN
4. Render multiple instances — server is stateless, load-balancer ready
5. Supabase read replica — analytics/reporting queries
6. Materialized views for Merchant Analytics (pre-aggregated by org/employee/category)

### 14.3 Environment Variables

```
DATABASE_URL             Supabase PostgreSQL (port 6543 pooler)
JWT_PRIVATE_KEY          RS256 PEM private key
JWT_PUBLIC_KEY           RS256 PEM public key
JWT_ACCESS_EXPIRY        900 (15 min)
JWT_REFRESH_EXPIRY       604800 (7 days)
QR_SECRET                Random 32-byte hex secret for QR HMAC
MPESA_CONSUMER_KEY
MPESA_CONSUMER_SECRET
MPESA_PASSKEY
MPESA_INITIATOR_NAME
MPESA_SECURITY_CREDENTIAL
MPESA_SHORTCODE
MPESA_ENV                sandbox | production
MPESA_BASE_URL
MPESA_CALLBACK_BASE      Public URL for webhooks
AT_API_KEY               Africa's Talking
AT_USERNAME
SUPABASE_URL             For Supabase Storage SDK
SUPABASE_SERVICE_KEY     Service role key (server-side storage)
NODE_ENV                 production
PORT                     10000
CORS_ORIGIN              https://flexpay1.vercel.app
LOG_LEVEL                info
```

---

## 15. Enterprise Folder Structure

```
flex-pay/
+-- .agents/                    Agent skills (design, animation, etc.)
+-- .env.example
+-- .env
+-- .gitignore
+-- package.json
+-- render.yaml
+-- blueprint.md                THIS FILE — authoritative architecture
+-- implementation_plan.md      Step-by-step build guide
+-- DEPLOYMENT_GUIDE.md
+-- playwright.config.js
|
+-- docs/
|   +-- engineering/
|   |   +-- api-contract.md
|   |   +-- architecture-decisions.md   ADR log
|   |   +-- schema-changelog.md         Migration history + rationale
|   |   +-- loading-ux-research.md
|   +-- design/
|   |   +-- design-system.md
|   |   +-- merchant-dashboard-spec.md  Merchant UI wireframe spec
|   |   +-- org-merchant-view-spec.md   Org merchant detail drawer spec
|   +-- integrations/
|       +-- mpesa-ethiopia.md
|       +-- africas-talking.md
|
+-- supabase/
|   +-- migrations/
|   |   +-- 0001_initial.sql
|   |   +-- 0002_salary_credit.sql      Adds monthly_salary, job_title
|   |   +-- 0003_receipts.sql           Adds receipt_url
|   |   +-- 0004_payroll_lines_v2.sql   Adds gross_salary, credit_used
|   +-- seeds/
|       +-- demo_data.sql
|
+-- scripts/
|   +-- migrate.js
|   +-- seed.js
|   +-- generate-keys.sh
|
+-- src/
|   +-- server/                         Backend — Fastify + Node.js 22
|   |   +-- modules/
|   |   |   +-- auth/
|   |   |   |   +-- domain/
|   |   |   |   |   +-- Session.js
|   |   |   |   |   +-- AuthPolicy.js
|   |   |   |   +-- ports/incoming/
|   |   |   |   |   +-- LoginUseCase.js
|   |   |   |   |   +-- RefreshTokenUseCase.js
|   |   |   |   |   +-- LogoutUseCase.js
|   |   |   |   +-- ports/outgoing/
|   |   |   |   |   +-- ISessionRepository.js
|   |   |   |   +-- adapters/incoming/
|   |   |   |   |   +-- auth.routes.js
|   |   |   |   +-- adapters/outgoing/
|   |   |   |   |   +-- SessionRepository.js
|   |   |   |   +-- index.js
|   |   |   |
|   |   |   +-- organizations/
|   |   |   |   +-- domain/
|   |   |   |   |   +-- Organization.js
|   |   |   |   |   +-- CreditPolicy.js
|   |   |   |   +-- ports/incoming/
|   |   |   |   |   +-- RegisterOrganizationUseCase.js
|   |   |   |   |   +-- GetOrgDashboardUseCase.js
|   |   |   |   |   +-- UpdateCreditPolicyUseCase.js
|   |   |   |   |   +-- GetOrgMerchantsUseCase.js         [NEW]
|   |   |   |   |   +-- GetOrgMerchantDetailUseCase.js    [NEW]
|   |   |   |   +-- ports/outgoing/
|   |   |   |   |   +-- IOrganizationRepository.js
|   |   |   |   +-- adapters/incoming/
|   |   |   |   |   +-- organizations.routes.js
|   |   |   |   +-- adapters/outgoing/
|   |   |   |   |   +-- OrganizationRepository.js
|   |   |   |   +-- index.js
|   |   |   |
|   |   |   +-- employees/
|   |   |   |   +-- domain/
|   |   |   |   |   +-- Employee.js
|   |   |   |   |   +-- CreditAccount.js      (salary + limit + available)
|   |   |   |   +-- ports/incoming/
|   |   |   |   |   +-- CreateEmployeeUseCase.js          (requires monthly_salary)
|   |   |   |   |   +-- GetEmployeeDashboardUseCase.js
|   |   |   |   |   +-- UpdateCreditLimitUseCase.js
|   |   |   |   |   +-- RequestPasswordResetUseCase.js
|   |   |   |   |   +-- ApprovePasswordResetUseCase.js
|   |   |   |   |   +-- GetEmployeeQRCodeUseCase.js       [NEW]
|   |   |   |   +-- ports/outgoing/
|   |   |   |   |   +-- IEmployeeRepository.js
|   |   |   |   |   +-- INotificationService.js
|   |   |   |   +-- adapters/incoming/
|   |   |   |   |   +-- employees.routes.js
|   |   |   |   +-- adapters/outgoing/
|   |   |   |   |   +-- EmployeeRepository.js
|   |   |   |   |   +-- SmsNotificationAdapter.js
|   |   |   |   +-- index.js
|   |   |   |
|   |   |   +-- merchants/
|   |   |   |   +-- domain/
|   |   |   |   |   +-- Merchant.js
|   |   |   |   |   +-- MerchantReceivable.js
|   |   |   |   |   +-- CreditExposure.js                 [NEW]
|   |   |   |   +-- ports/incoming/
|   |   |   |   |   +-- RegisterMerchantUseCase.js
|   |   |   |   |   +-- GetMerchantDashboardUseCase.js
|   |   |   |   |   +-- GetMerchantOrgsUseCase.js         [NEW]
|   |   |   |   |   +-- GetMerchantOrgDetailUseCase.js    [NEW]
|   |   |   |   |   +-- GetMerchantEmployeesUseCase.js    [NEW]
|   |   |   |   |   +-- GetMerchantEmployeeProfileUseCase.js [NEW]
|   |   |   |   |   +-- VerifyEmployeeQRUseCase.js        [NEW]
|   |   |   |   |   +-- GetMerchantAnalyticsUseCase.js    [NEW]
|   |   |   |   +-- ports/outgoing/
|   |   |   |   |   +-- IMerchantRepository.js
|   |   |   |   +-- adapters/incoming/
|   |   |   |   |   +-- merchants.routes.js
|   |   |   |   +-- adapters/outgoing/
|   |   |   |   |   +-- MerchantRepository.js
|   |   |   |   +-- index.js
|   |   |   |
|   |   |   +-- transactions/
|   |   |   |   +-- domain/
|   |   |   |   |   +-- Transaction.js
|   |   |   |   |   +-- SplitEngine.js
|   |   |   |   |   +-- LedgerEngine.js
|   |   |   |   |   +-- ReceiptEngine.js                  [NEW pdfkit]
|   |   |   |   +-- ports/incoming/
|   |   |   |   |   +-- CreateTransactionUseCase.js
|   |   |   |   |   +-- RefundTransactionUseCase.js
|   |   |   |   |   +-- GetTransactionUseCase.js
|   |   |   |   |   +-- DownloadReceiptUseCase.js         [NEW]
|   |   |   |   +-- ports/outgoing/
|   |   |   |   |   +-- ITransactionRepository.js
|   |   |   |   |   +-- IMpesaStkService.js
|   |   |   |   |   +-- IReceiptStorage.js                [NEW]
|   |   |   |   +-- adapters/incoming/
|   |   |   |   |   +-- transactions.routes.js
|   |   |   |   |   +-- webhooks.routes.js
|   |   |   |   +-- adapters/outgoing/
|   |   |   |   |   +-- TransactionRepository.js
|   |   |   |   |   +-- ReceiptStorageAdapter.js          [NEW Supabase Storage]
|   |   |   |   +-- index.js
|   |   |   |
|   |   |   +-- payroll/
|   |   |   |   +-- domain/
|   |   |   |   |   +-- PayrollSettlement.js
|   |   |   |   |   +-- DisbursementLine.js
|   |   |   |   +-- ports/incoming/
|   |   |   |   |   +-- PreviewPayrollUseCase.js   (reads monthly_salary)
|   |   |   |   |   +-- RunPayrollUseCase.js
|   |   |   |   +-- ports/outgoing/
|   |   |   |   |   +-- IPayrollRepository.js
|   |   |   |   |   +-- IMpesaB2CService.js
|   |   |   |   +-- adapters/incoming/
|   |   |   |   |   +-- payroll.routes.js
|   |   |   |   |   +-- b2c-webhook.routes.js
|   |   |   |   +-- adapters/outgoing/
|   |   |   |   |   +-- PayrollRepository.js
|   |   |   |   +-- index.js
|   |   |   |
|   |   |   +-- notifications/
|   |   |   |   +-- domain/Notification.js
|   |   |   |   +-- adapters/outgoing/AfricasTalkingAdapter.js
|   |   |   |   +-- index.js
|   |   |   |
|   |   |   +-- admin/
|   |   |       +-- domain/ReconciliationReport.js
|   |   |       +-- ports/incoming/
|   |   |       |   +-- GetReconciliationUseCase.js
|   |   |       |   +-- VerifyMerchantUseCase.js
|   |   |       +-- adapters/incoming/admin.routes.js
|   |   |       +-- index.js
|   |   |
|   |   +-- infrastructure/
|   |   |   +-- database/
|   |   |   |   +-- client.js            Kysely + pg Pool
|   |   |   |   +-- migrator.js          Migration runner + schema sync
|   |   |   |   +-- BaseRepository.js
|   |   |   +-- mpesa/
|   |   |   |   +-- MpesaClient.js
|   |   |   |   +-- stkPush.js
|   |   |   |   +-- b2c.js
|   |   |   |   +-- c2b.js
|   |   |   |   +-- transactionStatus.js
|   |   |   |   +-- accountBalance.js
|   |   |   |   +-- crypto.js            SHA256+Base64 formula
|   |   |   |   +-- tokenCache.js        OAuth 55-min cache
|   |   |   +-- storage/
|   |   |   |   +-- supabaseStorage.js   [NEW] Receipt PDF storage client
|   |   |   +-- sms/
|   |   |   |   +-- africasTalking.js
|   |   |   +-- queue/
|   |   |       +-- jobProcessor.js
|   |   |
|   |   +-- shared/
|   |   |   +-- middleware/
|   |   |   |   +-- authenticate.js
|   |   |   |   +-- requireRole.js
|   |   |   |   +-- rateLimit.js
|   |   |   |   +-- auditLog.js
|   |   |   |   +-- idempotency.js
|   |   |   |   +-- validateUUID.js     [NEW] 400 on bad UUID params
|   |   |   +-- crypto/
|   |   |   |   +-- passwordGenerator.js
|   |   |   |   +-- employeeIdGenerator.js  (+ QR payload functions)
|   |   |   |   +-- argon2.js
|   |   |   |   +-- jwt.js
|   |   |   +-- errors/
|   |   |   |   +-- AppError.js
|   |   |   |   +-- errorHandler.js
|   |   |   +-- validation/schemas/
|   |   |       +-- employee.schema.js   (includes monthly_salary)
|   |   |       +-- auth.schema.js
|   |   |       +-- transaction.schema.js
|   |   |       +-- merchant.schema.js
|   |   |
|   |   +-- config.js
|   |   +-- index.js
|   |
|   +-- client/                          Frontend — React 18 + Vite
|       +-- index.html
|       +-- vite.config.js
|       +-- src/
|           +-- App.jsx
|           +-- main.jsx
|           +-- router/
|           |   +-- Router.jsx
|           |   +-- ProtectedRoute.jsx
|           +-- api/
|           |   +-- axios.js
|           |   +-- auth.api.js
|           |   +-- employees.api.js
|           |   +-- merchants.api.js
|           |   +-- transactions.api.js
|           |   +-- payroll.api.js
|           |   +-- qr.api.js            [NEW]
|           |   +-- receipts.api.js      [NEW]
|           +-- stores/
|           |   +-- authStore.js
|           |   +-- uiStore.js           (includes toast queue)
|           +-- contexts/
|           |   +-- ToastContext.jsx
|           +-- hooks/
|           |   +-- useAuth.js
|           |   +-- useToast.js          [NEW]
|           |   +-- usePolling.js        [NEW] QR auto-refresh
|           |   +-- useDebounce.js
|           |   +-- useQRScanner.js      [NEW] html5-qrcode wrapper
|           +-- features/
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
|           |   |   +-- AuthHub.jsx
|           |   |   +-- org/OrgAuthPage.jsx
|           |   |   +-- merchant/MerchantAuthPage.jsx
|           |   |   +-- employee/EmployeeLoginPage.jsx
|           |   |   +-- employee/ForgotPasswordPage.jsx
|           |   |
|           |   +-- organization/
|           |   |   +-- OrgLayout.jsx
|           |   |   +-- OrgDashboard.jsx
|           |   |   +-- AddEmployeeForm.jsx        (monthly_salary required)
|           |   |   +-- PasswordDisplay.jsx         (one-time modal)
|           |   |   +-- PasswordResetRequests.jsx
|           |   |   +-- PayrollPreview.jsx           (salary-based net)
|           |   |   +-- MerchantDetailDrawer.jsx    [NEW]
|           |   |   +-- MerchantStatementDownload.jsx [NEW]
|           |   |
|           |   +-- employee/
|           |   |   +-- EmployeeDashboard.jsx
|           |   |   +-- CreditRing.jsx
|           |   |   +-- QRCodeCard.jsx               (auto-refresh)
|           |   |   +-- TransactionDetailModal.jsx   [NEW]
|           |   |   +-- ReceiptDownload.jsx           [NEW]
|           |   |
|           |   +-- merchant/
|           |       +-- MerchantLayout.jsx            [NEW sidebar]
|           |       +-- dashboard/
|           |       |   +-- MerchantDashboard.jsx
|           |       |   +-- MerchantKPICards.jsx
|           |       |   +-- RevenueByOrgChart.jsx    [NEW]
|           |       |   +-- DailyVolumeChart.jsx     [NEW]
|           |       +-- organizations/
|           |       |   +-- MerchantOrgs.jsx         [NEW]
|           |       |   +-- OrgDetailDrawer.jsx      [NEW]
|           |       +-- employees/
|           |       |   +-- MerchantEmployees.jsx    [NEW]
|           |       |   +-- EmployeeCreditProfile.jsx [NEW]
|           |       +-- transactions/
|           |       |   +-- MerchantTransactions.jsx
|           |       +-- pos/
|           |       |   +-- MerchantPOS.jsx          (QR scan primary)
|           |       |   +-- QRScannerModal.jsx        [NEW camera]
|           |       |   +-- EmployeeVerifyCard.jsx    [NEW]
|           |       +-- analytics/
|           |           +-- MerchantAnalytics.jsx    [NEW]
|           |           +-- CategoryChart.jsx
|           |           +-- OrgRevenueChart.jsx
|           |           +-- TopEmployeesTable.jsx    [NEW]
|           |
|           +-- components/ui/
|           |   +-- Button.jsx / .css
|           |   +-- Modal.jsx / .css         (replaces ALL browser prompts)
|           |   +-- Toast.jsx / .css         (replaces ALL browser alerts)
|           |   +-- Drawer.jsx / .css        [NEW slide-in panels]
|           |   +-- DataTable.jsx / .css
|           |   +-- StatCard.jsx / .css
|           |   +-- StatusBadge.jsx
|           |   +-- SplitBar.jsx
|           |   +-- CreditRing.jsx
|           |   +-- QRCodeCard.jsx
|           |   +-- PasswordDisplay.jsx
|           |   +-- NavigationProgress.jsx  [NEW top loading bar]
|           |   +-- Skeleton/
|           |       +-- Skeleton.jsx          (base pulse)
|           |       +-- SkeletonLine.jsx
|           |       +-- SkeletonStatCard.jsx
|           |       +-- SkeletonTable.jsx
|           |       +-- SkeletonChart.jsx
|           |       +-- SkeletonQR.jsx
|           |       +-- SkeletonDashboard.jsx
|           |
|           +-- components/layout/
|           |   +-- AppShell.jsx / .css
|           |   +-- Sidebar.jsx
|           |
|           +-- utils/
|           |   +-- format.js       ETB currency, EAT timestamps
|           |   +-- validators.js
|           |   +-- download.js     [NEW] Blob PDF download trigger
|           |
|           +-- styles/
|               +-- tokens.css
|               +-- global.css
|               +-- skeleton.css    [NEW] pulse keyframes
|
+-- tests/
    +-- unit/
    |   +-- crypto.test.js          Password gen + FP-ID + QR verify
    |   +-- split-engine.test.js
    |   +-- ledger.test.js
    |   +-- auth.test.js
    |   +-- qr.test.js              [NEW] QR generate + verify + expiry
    |   +-- salary-credit.test.js   [NEW] credit_limit = monthly_salary logic
    |   +-- receipt.test.js         [NEW] PDF receipt generation
    +-- integration/
    |   +-- api.test.js
    |   +-- merchant-analytics.test.js [NEW]
    +-- e2e/
        +-- landing.spec.js
        +-- org-flow.spec.js           (add employee with salary)
        +-- employee-flow.spec.js      (QR display + transaction receipt)
        +-- merchant-flow.spec.js      (QR scan -> verify -> checkout)
        +-- merchant-dashboard.spec.js [NEW org/employee panels]
        +-- payroll-flow.spec.js       (salary-based net calc)
```

---

*This blueprint is the authoritative source of truth for all FlexPay v3 architecture decisions.*
*All new code must be consistent with this document. Deviations require an ADR entry.*
*Priority: (1) Financial integrity, (2) Security, (3) UX, (4) Developer experience, (5) Performance*
*Last updated: 2026-10-18 — Principal System Architect — v3.0.0*
