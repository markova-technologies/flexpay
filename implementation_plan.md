# FlexPay v2 — Implementation Plan

**Reference:** blueprint.md v2.0.0  
**Implementation Approach:** Phased, test-first, component-by-component  
**Total Estimated Phases:** 8  
**Prerequisite Reading:** Read `blueprint.md` fully before starting any phase

---

## How to Use This Document

Each phase has:
- **Goal**: What the system can do after this phase is complete
- **Dependencies**: What must be done first
- **Steps**: Numbered, granular implementation steps
- **Tests**: What to verify before moving to next phase
- **Definition of Done**: Exact acceptance criteria

Never start a phase without completing the previous phase's Definition of Done.

---

## Phase 0: Environment Setup & Project Scaffold

**Goal:** Local dev environment is fully configured, dev server runs, database is connected.  
**Dependencies:** Node.js 22 LTS, PostgreSQL access via Supabase, npm

### 0.1 Verify and Install Node.js 22 LTS

```bash
node --version   # must be v22.x.x
npm --version    # must be v10.x.x+
```

If not v22: download from nodejs.org/en/download or use nvm.

### 0.2 Install Core Dependencies

```bash
# In project root
npm install fastify@4 @fastify/cors @fastify/helmet @fastify/rate-limit @fastify/cookie @fastify/sensible

# Database
npm install kysely pg

# Auth & Crypto
npm install argon2 jsonwebtoken

# Validation
npm install zod

# Logging
npm install pino pino-pretty

# SMS
npm install africastalking

# Job Queue
npm install pg-boss

# In-process cache
npm install node-cache

# Dev tools
npm install -D nodemon dotenv

# Date utilities
npm install date-fns
```

### 0.3 Configure Environment Variables

Create `.env` from `.env.example`:

```bash
cp .env.example .env
```

Fill in all variables from Section 13.3 of blueprint.md. For local dev, use Supabase sandbox credentials and M-PESA sandbox.

### 0.4 Generate RS256 Key Pair for JWT

```bash
# Generate RSA private key (2048-bit minimum, 4096-bit recommended)
openssl genrsa -out jwt_private.pem 4096

# Extract public key
openssl rsa -in jwt_private.pem -pubout -out jwt_public.pem

# Convert to single-line for .env (replace newlines with \n)
# Paste the PEM contents into .env as JWT_PRIVATE_KEY and JWT_PUBLIC_KEY
```

### 0.5 Create the Entry Server File

Create `src/server/index.js`:

```javascript
const Fastify = require('fastify');
const { loadConfig } = require('./config');

async function buildServer() {
  const config = loadConfig();
  
  const fastify = Fastify({
    logger: {
      level: config.LOG_LEVEL,
      redact: ['req.headers.authorization', 'body.password', 'body.passwordHash'],
    },
    genReqId: () => require('node:crypto').randomUUID(),
  });

  // Plugins
  await fastify.register(require('@fastify/cors'), { origin: config.CORS_ORIGIN });
  await fastify.register(require('@fastify/helmet'));
  await fastify.register(require('@fastify/cookie'));
  await fastify.register(require('@fastify/rate-limit'), { max: 100, timeWindow: '1 minute' });

  // Modules (register in Phase 2+)
  // await fastify.register(require('./modules/auth'), { prefix: '/api/v1' });

  fastify.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

  return fastify;
}

async function start() {
  const config = loadConfig();
  const server = await buildServer();
  await server.listen({ port: config.PORT, host: '0.0.0.0' });
}

start().catch(err => { console.error(err); process.exit(1); });
module.exports = { buildServer };
```

### 0.6 Create Config Loader

Create `src/server/config.js`:

```javascript
require('dotenv').config();

function loadConfig() {
  const required = ['DATABASE_URL', 'JWT_PRIVATE_KEY', 'JWT_PUBLIC_KEY'];
  const missing = required.filter(k => !process.env[k]);
  if (missing.length) throw new Error(`Missing required env vars: ${missing.join(', ')}`);
  
  return {
    DATABASE_URL: process.env.DATABASE_URL,
    JWT_PRIVATE_KEY: process.env.JWT_PRIVATE_KEY.replace(/\\n/g, '\n'),
    JWT_PUBLIC_KEY: process.env.JWT_PUBLIC_KEY.replace(/\\n/g, '\n'),
    JWT_ACCESS_EXPIRY: Number(process.env.JWT_ACCESS_EXPIRY) || 900,
    JWT_REFRESH_EXPIRY: Number(process.env.JWT_REFRESH_EXPIRY) || 604800,
    MPESA_CONSUMER_KEY: process.env.MPESA_CONSUMER_KEY,
    MPESA_CONSUMER_SECRET: process.env.MPESA_CONSUMER_SECRET,
    MPESA_PASSKEY: process.env.MPESA_PASSKEY,
    MPESA_INITIATOR_NAME: process.env.MPESA_INITIATOR_NAME,
    MPESA_SECURITY_CREDENTIAL: process.env.MPESA_SECURITY_CREDENTIAL,
    MPESA_SHORTCODE: process.env.MPESA_SHORTCODE,
    MPESA_ENV: process.env.MPESA_ENV || 'sandbox',
    MPESA_BASE_URL: process.env.MPESA_BASE_URL || 'https://sandbox.safaricom.et',
    MPESA_CALLBACK_BASE: process.env.MPESA_CALLBACK_BASE,
    AT_API_KEY: process.env.AT_API_KEY,
    AT_USERNAME: process.env.AT_USERNAME,
    NODE_ENV: process.env.NODE_ENV || 'development',
    PORT: Number(process.env.PORT) || 3001,
    CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:5173',
    LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  };
}

module.exports = { loadConfig };
```

### 0.7 Setup Database Client (Kysely)

Create `src/server/infrastructure/database/client.js`:

```javascript
const { Kysely, PostgresDialect } = require('kysely');
const { Pool } = require('pg');
const { loadConfig } = require('../../config');

let db;

function getDb() {
  if (!db) {
    const config = loadConfig();
    const pool = new Pool({
      connectionString: config.DATABASE_URL,
      ssl: { rejectUnauthorized: false }, // Supabase requires SSL
      max: 10,
      idleTimeoutMillis: 30000,
    });
    db = new Kysely({ dialect: new PostgresDialect({ pool }) });
  }
  return db;
}

module.exports = { getDb };
```

### 0.8 Verify Setup

```bash
npm run dev
# Should see: Server listening at http://0.0.0.0:3001
curl http://localhost:3001/health
# Should return: {"status":"ok","timestamp":"..."}
```

**Definition of Done Phase 0:**
- [ ] `GET /health` returns 200 with `{status: "ok"}`
- [ ] Server starts without errors
- [ ] Database connection pool initializes (no connection errors in logs)
- [ ] All env vars load without "Missing required" errors

---

## Phase 1: Database Schema

**Goal:** Full v2 schema deployed to Supabase PostgreSQL.  
**Dependencies:** Phase 0 complete, Supabase project created

### 1.1 Write Migration 0001: Core Schema

Create `supabase/migrations/0001_initial.sql`.

This file must contain all tables from Section 7.2 of blueprint.md in this exact order (respecting FK dependencies):

```
1. CREATE TYPE declarations (enums)
2. CREATE TABLE organizations
3. CREATE TABLE merchants
4. CREATE TABLE employees (references organizations)
5. CREATE TABLE users (references organizations, merchants, employees)
6. CREATE TABLE refresh_tokens (references users)
7. CREATE TABLE org_credit_policies (references organizations)
8. CREATE TABLE password_reset_requests (references employees, users)
9. CREATE TABLE transactions (references employees, merchants, organizations)
10. CREATE TABLE journal_entries (references transactions)
11. CREATE TABLE payroll_settlements (references organizations, users)
12. CREATE TABLE payroll_disbursement_lines (references payroll_settlements, merchants, employees)
13. CREATE TABLE audit_log
14. CREATE TABLE idempotency_keys
15. All CREATE INDEX statements
16. All CONSTRAINT statements
17. All TRIGGER functions and CREATE TRIGGER statements
```

### 1.2 Add refresh_tokens Table

This table was referenced in blueprint.md Section 10.1 but not in the table list — add it:

```sql
CREATE TABLE refresh_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL,     -- SHA256 of the opaque token (never store raw token)
  expires_at  TIMESTAMPTZ NOT NULL,
  revoked_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address  INET,
  user_agent  TEXT
);
CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_hash ON refresh_tokens(token_hash);
```

### 1.3 Add Auto-Update Trigger for updated_at

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to every table that has updated_at
CREATE TRIGGER trg_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Repeat for: merchants, employees, users, org_credit_policies
```

### 1.4 Add Credit Constraint Check

```sql
-- Already in employees table definition:
CONSTRAINT chk_credit_valid CHECK (
  available_credit >= 0 AND available_credit <= credit_limit
)
```

### 1.5 Revoke Destructive Privileges

```sql
-- Run as superuser after creating the app DB user (supabase_user or similar)
-- This ensures audit_log and journal_entries are append-only at the DB level
REVOKE UPDATE, DELETE ON audit_log FROM authenticated;
REVOKE UPDATE, DELETE ON journal_entries FROM authenticated;
```

### 1.6 Run Migration Against Supabase

```bash
# Using Supabase CLI (if installed)
supabase db push

# OR run directly via psql
psql "$DATABASE_URL" -f supabase/migrations/0001_initial.sql
```

### 1.7 Verify Schema

```sql
-- Run these queries to verify:
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';
-- Must return: organizations, merchants, employees, users, refresh_tokens,
--              org_credit_policies, password_reset_requests, transactions,
--              journal_entries, payroll_settlements, payroll_disbursement_lines,
--              audit_log, idempotency_keys

SELECT constraint_name FROM information_schema.check_constraints;
-- Must include: chk_credit_valid, chk_amounts_add_up
```

**Definition of Done Phase 1:**
- [ ] All 13 tables exist in Supabase
- [ ] All ENUM types created
- [ ] All UNIQUE and CHECK constraints active
- [ ] updated_at triggers fire on UPDATE (test with a manual UPDATE)
- [ ] audit_log and journal_entries: UPDATE fails for app user (permission denied)

---

## Phase 2: Shared Infrastructure (Crypto, Auth Utilities)

**Goal:** Password generation, Employee ID generation, Argon2id hashing, and JWT utilities are built and unit-tested.  
**Dependencies:** Phase 0

### 2.1 Password Generator

Create `src/server/shared/crypto/passwordGenerator.js` with the exact implementation from Section 4.3 of blueprint.md.

Write unit tests in `tests/unit/crypto.test.js`:

```javascript
const { generateCompliantPassword, generateSecurePassword } = require('../../src/server/shared/crypto/passwordGenerator');

// Test 1: Length
const p = generateCompliantPassword();
assert(p.length === 16, 'Password must be 16 chars');

// Test 2: Contains all character pools
assert(/[a-z]/.test(p), 'Must contain lowercase');
assert(/[A-Z]/.test(p), 'Must contain uppercase');
assert(/[0-9]/.test(p), 'Must contain digits');
assert(/[!@#$%^&*()]/.test(p), 'Must contain symbols');

// Test 3: Uniqueness (10,000 samples)
const samples = new Set(Array.from({ length: 10000 }, generateCompliantPassword));
assert(samples.size === 10000, 'Must be unique across 10k samples');

// Test 4: No excluded characters
assert(!/["'`\\]/.test(p), 'Must not contain excluded chars');
```

### 2.2 Employee ID Generator

Create `src/server/shared/crypto/employeeIdGenerator.js` with the exact implementation from Section 5.3 of blueprint.md.

Write unit tests:

```javascript
const { generateEmployeeId, validateEmployeeId } = require('../../src/server/shared/crypto/employeeIdGenerator');

// Test 1: Format
const id = generateEmployeeId('ETH');
assert(/^FP-ETH-\d{4}-[0-9A-Z]{5}-[A-Z]$/.test(id), 'Format correct');

// Test 2: Checksum validation
assert(validateEmployeeId(id).valid === true, 'Valid ID passes');

// Test 3: Tampered ID fails
const tampered = id.slice(0, -1) + (id.slice(-1) === 'A' ? 'B' : 'A');
assert(validateEmployeeId(tampered).valid === false, 'Tampered ID fails checksum');

// Test 4: Uniqueness (100k samples)
const ids = new Set(Array.from({ length: 100000 }, () => generateEmployeeId()));
assert(ids.size === 100000, 'No collisions in 100k samples');
```

### 2.3 Argon2id Hash & Verify

Create `src/server/shared/crypto/argon2.js`:

```javascript
const argon2 = require('argon2');

const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 65536,    // 64MB
  timeCost: 3,          // 3 iterations
  parallelism: 4,
};

async function hashPassword(plaintext) {
  return argon2.hash(plaintext, ARGON2_OPTIONS);
}

async function verifyPassword(hash, plaintext) {
  try {
    return await argon2.verify(hash, plaintext);
  } catch {
    return false;
  }
}

module.exports = { hashPassword, verifyPassword };
```

### 2.4 JWT Sign & Verify

Create `src/server/shared/crypto/jwt.js`:

```javascript
const jwt = require('jsonwebtoken');
const { loadConfig } = require('../../config');

function signAccessToken(payload) {
  const config = loadConfig();
  return jwt.sign(payload, config.JWT_PRIVATE_KEY, {
    algorithm: 'RS256',
    expiresIn: config.JWT_ACCESS_EXPIRY,
  });
}

function verifyAccessToken(token) {
  const config = loadConfig();
  return jwt.verify(token, config.JWT_PUBLIC_KEY, { algorithms: ['RS256'] });
}

module.exports = { signAccessToken, verifyAccessToken };
```

### 2.5 Authentication Middleware

Create `src/server/shared/middleware/authenticate.js`:

```javascript
const { verifyAccessToken } = require('../crypto/jwt');

async function authenticate(request, reply) {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return reply.code(401).send({ error: 'Missing or invalid authorization header' });
  }
  const token = authHeader.slice(7);
  try {
    request.user = verifyAccessToken(token);
  } catch (err) {
    return reply.code(401).send({ error: 'Invalid or expired token' });
  }
}

module.exports = { authenticate };
```

Create `src/server/shared/middleware/requireRole.js`:

```javascript
function requireRole(...roles) {
  return async (request, reply) => {
    if (!request.user || !roles.includes(request.user.role)) {
      return reply.code(403).send({ error: 'Forbidden: insufficient permissions' });
    }
  };
}

module.exports = { requireRole };
```

### 2.6 Run Unit Tests

```bash
node --test tests/unit/crypto.test.js
# All tests must pass before continuing
```

**Definition of Done Phase 2:**
- [ ] `generateCompliantPassword()` passes all 4 unit tests
- [ ] `generateEmployeeId()` passes all 4 unit tests
- [ ] `hashPassword()` / `verifyPassword()` work (test manually)
- [ ] `signAccessToken()` / `verifyAccessToken()` work (test manually)
- [ ] `authenticate` middleware returns 401 for missing/invalid tokens

---

## Phase 3: Auth Module (Register & Login)

**Goal:** Organizations and Merchants can register and login. Employees can login. JWT pairs are issued. Refresh works.  
**Dependencies:** Phase 1, Phase 2

### 3.1 Create Auth Domain Objects

Create `src/server/modules/auth/domain/AuthPolicy.js`:

```javascript
class AuthPolicy {
  static canLogin(user) {
    if (!user) return { allowed: false, reason: 'User not found' };
    if (user.status === 'SUSPENDED') return { allowed: false, reason: 'Account suspended' };
    return { allowed: true };
  }
}
module.exports = { AuthPolicy };
```

### 3.2 Create SessionRepository

Create `src/server/modules/auth/adapters/outgoing/SessionRepository.js`:

```javascript
const { getDb } = require('../../../../infrastructure/database/client');
const { randomUUID } = require('node:crypto');
const { createHash } = require('node:crypto');

class SessionRepository {
  constructor() { this.db = getDb(); }

  async createRefreshToken(userId, { ipAddress, userAgent, expiresInSeconds }) {
    const token = randomUUID() + randomUUID(); // 64-char opaque token
    const hash = createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);
    await this.db.insertInto('refresh_tokens').values({
      user_id: userId, token_hash: hash, expires_at: expiresAt,
      ip_address: ipAddress, user_agent: userAgent,
    }).execute();
    return token; // Return the raw token to be set as cookie
  }

  async findAndRotateRefreshToken(rawToken) {
    const hash = createHash('sha256').update(rawToken).digest('hex');
    const record = await this.db
      .selectFrom('refresh_tokens')
      .selectAll()
      .where('token_hash', '=', hash)
      .where('expires_at', '>', new Date())
      .where('revoked_at', 'is', null)
      .executeTakeFirst();
    if (!record) return null;
    // Revoke old token
    await this.db.updateTable('refresh_tokens')
      .set({ revoked_at: new Date() })
      .where('id', '=', record.id)
      .execute();
    return record;
  }

  async revokeAllForUser(userId) {
    await this.db.updateTable('refresh_tokens')
      .set({ revoked_at: new Date() })
      .where('user_id', '=', userId)
      .where('revoked_at', 'is', null)
      .execute();
  }
}
module.exports = { SessionRepository };
```

### 3.3 Create Auth Routes

Create `src/server/modules/auth/adapters/incoming/auth.routes.js`.

Implement these routes:

**POST /api/v1/auth/org/register**
```
Body: { orgName, tinNumber, contactPhone, mpesaShortcode, password }
Actions:
  1. Validate with Zod schema
  2. Check tinNumber not already registered (409 if exists)
  3. hashPassword(password) -> hash
  4. INSERT INTO organizations (name, tin_number, mpesa_shortcode, contact_phone)
  5. INSERT INTO users (role: 'ORG_ADMIN', organization_id, password_hash: hash)
  6. Return: { message: 'Organization registered', organizationId }
```

**POST /api/v1/auth/org/login**
```
Body: { tinNumber, password }
Rate limit: 5 attempts / 15min / IP
Actions:
  1. Find organization by tin_number
  2. Find user WHERE organization_id AND role = 'ORG_ADMIN'
  3. verifyPassword(user.password_hash, password) -> if false: 401
  4. AuthPolicy.canLogin(user) -> if not allowed: 401/403
  5. signAccessToken({ sub: user.id, role: 'ORG_ADMIN', orgId: org.id })
  6. sessionRepo.createRefreshToken(user.id, ...) -> rawToken
  7. reply.setCookie('refresh_token', rawToken, { httpOnly, secure, sameSite: 'strict' })
  8. Return: { accessToken, user: { id, role, orgId, orgName } }
```

**POST /api/v1/auth/merchant/register** — Similar to org register

**POST /api/v1/auth/merchant/login** — Similar to org login with MERCHANT_OWNER role

**POST /api/v1/auth/employee/login**
```
Body: { fpEmployeeId, password }
Rate limit: 5 attempts / 15min / IP
Actions:
  1. validateEmployeeId(fpEmployeeId) -> if invalid format: 400
  2. Find employee WHERE fp_employee_id = fpEmployeeId AND status = 'ACTIVE'
  3. Find user WHERE employee_id = employee.id AND role = 'EMPLOYEE'
  4. verifyPassword(user.password_hash, password) -> if false: 401
  5. signAccessToken({ sub: user.id, role: 'EMPLOYEE', employeeId: employee.id, orgId: employee.organization_id })
  6. Issue refresh token cookie
  7. Return: { accessToken, user: { fpEmployeeId, name, orgId } }
```

**POST /api/v1/auth/refresh**
```
Cookie: refresh_token
Actions:
  1. Read refresh_token from cookie
  2. sessionRepo.findAndRotateRefreshToken(token) -> record
  3. If null: 401 'Refresh token invalid or expired'
  4. Find user by record.user_id
  5. signAccessToken(new payload from user)
  6. Create new refresh token, set new cookie
  7. Return: { accessToken }
```

**POST /api/v1/auth/logout**
```
Auth: JWT required
Actions:
  1. sessionRepo.revokeAllForUser(request.user.sub)
  2. reply.clearCookie('refresh_token')
  3. Return: { message: 'Logged out' }
```

### 3.4 Create Zod Validation Schemas

Create `src/server/shared/validation/schemas/auth.schemas.js`:

```javascript
const { z } = require('zod');

const phoneSchema = z.string().regex(/^251[79]\d{8}$/, 'Must be Ethiopian Safaricom number (251XXXXXXXXX)');

const orgRegisterSchema = z.object({
  orgName: z.string().min(2).max(100),
  tinNumber: z.string().min(5).max(20),
  contactPhone: phoneSchema,
  mpesaShortcode: z.string().optional(),
  password: z.string().min(8).max(128),
});

const employeeLoginSchema = z.object({
  fpEmployeeId: z.string().regex(/^FP-[A-Z]{2,4}-\d{4}-[0-9A-Z]{5}-[A-Z]$/),
  password: z.string().min(1),
});

module.exports = { orgRegisterSchema, employeeLoginSchema };
```

### 3.5 Register Auth Module in Server

In `src/server/index.js`, add:

```javascript
await fastify.register(require('./modules/auth'), { prefix: '/api/v1' });
```

### 3.6 Test Auth Flows

```bash
# Register org
curl -X POST http://localhost:3001/api/v1/auth/org/register \
  -H "Content-Type: application/json" \
  -d '{"orgName":"Acme Corp","tinNumber":"TIN123","contactPhone":"251912345678","password":"TestPass123!"}'

# Login org
curl -X POST http://localhost:3001/api/v1/auth/org/login \
  -H "Content-Type: application/json" \
  -d '{"tinNumber":"TIN123","password":"TestPass123!"}'
# Should return: { accessToken: "eyJ..." }
```

**Definition of Done Phase 3:**
- [ ] Org register + login return valid JWT
- [ ] Merchant register + login return valid JWT
- [ ] Employee login with valid FP-ID + password returns JWT
- [ ] Invalid password returns 401
- [ ] Expired access token + valid refresh cookie -> new access token (refresh works)
- [ ] Logout revokes refresh token (second refresh attempt returns 401)
- [ ] Rate limit triggers after 5 failed login attempts

---

## Phase 4: Organization Module (Employee Management)

**Goal:** Org Admins can create employees (generating FP-ID + password), view employee list, update credit limits, and manage password reset requests.  
**Dependencies:** Phase 3

### 4.1 Create Employee Domain Entity

Create `src/server/modules/employees/domain/Employee.js`:

```javascript
class Employee {
  constructor(data) {
    this.id = data.id;
    this.fpEmployeeId = data.fp_employee_id;
    this.organizationId = data.organization_id;
    this.fullName = data.full_name;
    this.phoneNumber = data.phone_number;
    this.creditLimit = Number(data.credit_limit);
    this.availableCredit = Number(data.available_credit);
    this.department = data.department;
    this.status = data.status;
    this.createdAt = data.created_at;
  }

  get spentCredit() {
    return this.creditLimit - this.availableCredit;
  }

  get creditUtilizationPct() {
    if (this.creditLimit === 0) return 0;
    return Math.round((this.spentCredit / this.creditLimit) * 100);
  }

  canSpend(amount) {
    return this.status === 'ACTIVE' && this.availableCredit >= amount;
  }
}
module.exports = { Employee };
```

### 4.2 Create Employee Use Cases

Create `src/server/modules/employees/ports/incoming/CreateEmployeeUseCase.js`:

```javascript
const { generateEmployeeId } = require('../../../../shared/crypto/employeeIdGenerator');
const { generateCompliantPassword } = require('../../../../shared/crypto/passwordGenerator');
const { hashPassword } = require('../../../../shared/crypto/argon2');

class CreateEmployeeUseCase {
  constructor({ employeeRepository, notificationService, db }) {
    this.repo = employeeRepository;
    this.notifications = notificationService;
    this.db = db;
  }

  async execute({ organizationId, fullName, phoneNumber, department, creditLimitOverride, sendSms }) {
    // 1. Check phone not already registered in this org
    const existing = await this.repo.findByPhone(organizationId, phoneNumber);
    if (existing) throw Object.assign(new Error('Phone already registered'), { statusCode: 409 });

    // 2. Get org credit policy for default limit
    const policy = await this.repo.getOrgCreditPolicy(organizationId);
    const creditLimit = creditLimitOverride ?? policy?.global_credit_limit ?? 0;

    // 3. Generate FP Employee ID (with uniqueness retry)
    let fpEmployeeId;
    let attempts = 0;
    do {
      fpEmployeeId = generateEmployeeId('ETH');
      const collision = await this.repo.findByFpId(fpEmployeeId);
      if (!collision) break;
      attempts++;
    } while (attempts < 10);
    if (attempts >= 10) throw new Error('ID generation collision — this should never happen');

    // 4. Generate password
    const plainPassword = generateCompliantPassword(16);
    const passwordHash = await hashPassword(plainPassword);

    // 5. Insert employee + user record in a single DB transaction
    const employee = await this.db.transaction().execute(async (trx) => {
      const emp = await trx.insertInto('employees').values({
        fp_employee_id: fpEmployeeId,
        organization_id: organizationId,
        full_name: fullName,
        phone_number: phoneNumber,
        credit_limit: creditLimit,
        available_credit: creditLimit,
        department: department ?? null,
        status: 'ACTIVE',
      }).returningAll().executeTakeFirstOrThrow();

      await trx.insertInto('users').values({
        role: 'EMPLOYEE',
        organization_id: organizationId,
        employee_id: emp.id,
        password_hash: passwordHash,
        must_change_password: false,
      }).execute();

      return emp;
    });

    // 6. Optionally send SMS
    if (sendSms && phoneNumber) {
      await this.notifications.sendEmployeeCreatedSms({
        to: phoneNumber,
        fpEmployeeId,
        password: plainPassword, // Sent in SMS only if org admin requests
      });
    }

    // 7. Return employee data + plainPassword (displayed ONCE to org admin)
    // WARNING: plainPassword is NEVER logged, NEVER stored, returned ONCE here only
    return { employee, plainPassword, fpEmployeeId };
  }
}
module.exports = { CreateEmployeeUseCase };
```

### 4.3 Create Employee Repository

Create `src/server/modules/employees/adapters/outgoing/EmployeeRepository.js` with methods:
- `findByPhone(orgId, phone)`
- `findByFpId(fpId)`
- `findById(id)`
- `findByOrgId(orgId, { page, limit, search })`
- `updateCreditLimit(id, newLimit, db?)`
- `decreaseCredit(id, amount, trx)` — uses SELECT FOR UPDATE
- `getOrgCreditPolicy(orgId)`
- `createPasswordResetRequest(employeeId, deliveryMethod)`
- `listPasswordResetRequests(orgId, status)`
- `approvePasswordReset(requestId, reviewerId, newPasswordHash)`

### 4.4 Create Organization Routes

Create `src/server/modules/organizations/adapters/incoming/organizations.routes.js`.

Implement these routes with `preHandler: [authenticate, requireRole('ORG_ADMIN', 'ORG_CONTROLLER')]`:

**GET /api/v1/org/employees** — List with pagination + search
**POST /api/v1/org/employees** — Create employee (CreateEmployeeUseCase)
**GET /api/v1/org/employees/:fpId** — Employee detail + recent transactions
**PATCH /api/v1/org/employees/:fpId/credit** — Update credit limit (ORG_ADMIN only)
**GET /api/v1/org/password-reset-requests** — List pending requests
**PATCH /api/v1/org/password-reset-requests/:id** — Approve/reject (generates new password if approved)
**PATCH /api/v1/org/credit-policy** — Update global credit policy (ORG_ADMIN only)
**POST /api/v1/org/mpesa-config** — Save M-PESA shortcode

### 4.5 Password Reset Approval Flow Implementation

In the PATCH `/api/v1/org/password-reset-requests/:id` handler:

```javascript
// action: 'APPROVE' or 'REJECT'
if (action === 'APPROVE') {
  const newPassword = generateCompliantPassword(16);
  const newHash = await hashPassword(newPassword);
  
  // Update user password hash
  await db.updateTable('users')
    .set({ password_hash: newHash, updated_at: new Date() })
    .where('employee_id', '=', request.employeeId)
    .execute();
  
  // Mark reset request as approved
  await db.updateTable('password_reset_requests')
    .set({ status: 'APPROVED', reviewed_by: adminUserId, reviewed_at: new Date() })
    .where('id', '=', requestId)
    .execute();
  
  // Send SMS if delivery_method === 'SMS'
  if (resetRequest.delivery_method === 'SMS') {
    await smsService.sendPasswordResetApprovedSms({ to: employee.phone_number, newPassword });
  }
  
  // Return new password to admin (displayed once in UI)
  return reply.send({ approved: true, newPassword, deliveredViaSms: resetRequest.delivery_method === 'SMS' });
}
```

### 4.6 Test Employee Management

```bash
# Create employee
curl -X POST http://localhost:3001/api/v1/org/employees \
  -H "Authorization: Bearer <org_admin_token>" \
  -H "Content-Type: application/json" \
  -d '{"fullName":"Abebe Kebede","phoneNumber":"251912345679","sendSms":false}'
# Must return: { employee: { fpEmployeeId: "FP-ETH-2026-XXXXX-X", ... }, plainPassword: "Abc123..." }

# Login as employee using returned FP-ID and plainPassword
curl -X POST http://localhost:3001/api/v1/auth/employee/login \
  -H "Content-Type: application/json" \
  -d '{"fpEmployeeId":"FP-ETH-2026-XXXXX-X","password":"Abc123..."}'
# Must return valid JWT
```

**Definition of Done Phase 4:**
- [ ] Org Admin can create employees, receives FP-ID and plaintext password ONCE
- [ ] Employee can login with generated credentials
- [ ] Credit limit can be updated per employee (ORG_ADMIN only)
- [ ] Password reset request created by employee, visible in org admin dashboard
- [ ] Org Admin can approve reset, new password generated, old password no longer works
- [ ] `plainPassword` never appears in server logs (verify in Pino output)

---

## Phase 5: Merchant Module & Transaction Flow

**Goal:** Merchants can register and login. The core purchase transaction flow works (credit reservation, STK Push for co-pay, ledger entries).  
**Dependencies:** Phase 4

### 5.1 Create SplitEngine Domain Object

Create `src/server/modules/transactions/domain/SplitEngine.js`:

```javascript
class SplitEngine {
  /**
   * Calculates how to split a purchase between FlexPay credit and M-PESA co-pay.
   * @param {number} totalAmount - ETB amount employee wants to spend
   * @param {number} availableCredit - ETB of credit employee currently has
   * @returns {{ creditPortion: number, copayPortion: number, requiresStkPush: boolean }}
   */
  static calculate(totalAmount, availableCredit) {
    if (totalAmount <= 0) throw new Error('Amount must be positive');
    
    const creditPortion = Math.min(totalAmount, availableCredit);
    const copayPortion = Math.max(0, totalAmount - availableCredit);
    
    return {
      creditPortion,
      copayPortion,
      requiresStkPush: copayPortion > 0,
    };
  }
}
module.exports = { SplitEngine };
```

Write unit test in `tests/unit/split-engine.test.js`:

```javascript
const { SplitEngine } = require('../../src/server/modules/transactions/domain/SplitEngine');

// Test 1: Full credit coverage
const r1 = SplitEngine.calculate(500, 1000);
assert(r1.creditPortion === 500 && r1.copayPortion === 0 && !r1.requiresStkPush);

// Test 2: Partial credit
const r2 = SplitEngine.calculate(1500, 1000);
assert(r2.creditPortion === 1000 && r2.copayPortion === 500 && r2.requiresStkPush);

// Test 3: Zero credit
const r3 = SplitEngine.calculate(500, 0);
assert(r3.creditPortion === 0 && r3.copayPortion === 500 && r3.requiresStkPush);

// Test 4: Invalid amount
assert.throws(() => SplitEngine.calculate(-100, 1000), Error);
```

### 5.2 Create LedgerEngine Domain Object

Create `src/server/modules/transactions/domain/LedgerEngine.js`:

```javascript
class LedgerEngine {
  /**
   * Creates the journal entries for a FlexPay credit purchase.
   * Double-entry: debits must equal credits.
   * 
   * Credit purchase model:
   *   DEBIT  EMPLOYEE_CREDIT      (employee owes FlexPay)
   *   CREDIT MERCHANT_RECEIVABLE  (merchant is owed by FlexPay on settlement day)
   */
  static generateCreditEntries(transactionId, creditPortion, merchantMpesaNumber) {
    if (creditPortion <= 0) return [];
    return [
      {
        transaction_id: transactionId,
        account_type: 'EMPLOYEE_CREDIT',
        debit_amount: creditPortion,
        credit_amount: 0,
        description: `Employee credit deducted for purchase`,
      },
      {
        transaction_id: transactionId,
        account_type: 'MERCHANT_RECEIVABLE',
        debit_amount: 0,
        credit_amount: creditPortion,
        description: `Merchant receivable: ${merchantMpesaNumber}`,
      },
    ];
  }

  static verifyBalance(entries) {
    const totalDebits = entries.reduce((s, e) => s + Number(e.debit_amount), 0);
    const totalCredits = entries.reduce((s, e) => s + Number(e.credit_amount), 0);
    if (Math.abs(totalDebits - totalCredits) > 0.001) {
      throw new Error(`Journal imbalance: debits=${totalDebits}, credits=${totalCredits}`);
    }
    return true;
  }
}
module.exports = { LedgerEngine };
```

### 5.3 Create Transaction Use Case

Create `src/server/modules/transactions/ports/incoming/CreateTransactionUseCase.js`:

```javascript
class CreateTransactionUseCase {
  constructor({ transactionRepo, employeeRepo, merchantRepo, mpesaStkService, db }) {
    this.txnRepo = transactionRepo;
    this.empRepo = employeeRepo;
    this.mchRepo = merchantRepo;
    this.mpesa = mpesaStkService;
    this.db = db;
  }

  async execute({ merchantId, fpEmployeeId, totalAmount, orgPolicy }) {
    // 1. Load employee (with FOR UPDATE lock inside transaction)
    // 2. Load merchant
    // 3. Verify: employee active, merchant active, category allowed
    // 4. Verify: employee has credit > 0
    // 5. Calculate split: SplitEngine.calculate(totalAmount, employee.available_credit)
    // 6. Generate fp_transaction_ref: `FP-TXN-${Date.now()}-${randomBytes(4).toString('hex').toUpperCase()}`
    // 7. BEGIN DB TRANSACTION:
    //    a. SELECT employee FOR UPDATE (row lock)
    //    b. Re-validate available_credit is still sufficient
    //    c. INSERT transaction record (status: CREDIT_RESERVED)
    //    d. UPDATE employee: available_credit -= creditPortion
    //    e. INSERT journal_entries via LedgerEngine.generateCreditEntries()
    //    f. LedgerEngine.verifyBalance() — throw if imbalanced
    //    g. COMMIT
    // 8. If requiresStkPush:
    //    a. UPDATE transaction status: STK_SENT
    //    b. mpesaStkService.initiateStkPush({ phone, amount: copayPortion, transactionRef })
    //    c. Store stk_checkout_request_id on transaction
    // 9. If !requiresStkPush:
    //    a. UPDATE transaction status: COMPLETED
    // 10. Return transaction data
  }
}
```

### 5.4 M-PESA STK Push Webhook Handler

Create `src/server/modules/transactions/adapters/incoming/webhooks.routes.js`:

```javascript
// POST /api/v1/webhooks/mpesa/stk
// IMPORTANT: No auth middleware on this route (M-PESA calls it directly)
// IMPORTANT: Respond 200 IMMEDIATELY, then process asynchronously

fastify.post('/api/v1/webhooks/mpesa/stk', async (request, reply) => {
  // 1. Immediately respond 200 to prevent Safaricom timeout/retry
  await reply.code(200).send({ ResultCode: 0, ResultDesc: 'Accepted' });
  
  // 2. Validate payload
  const { Body: { stkCallback } } = request.body;
  
  // 3. Find transaction by stk_checkout_request_id
  const txn = await txnRepo.findByStkId(stkCallback.CheckoutRequestID);
  if (!txn) return; // Unknown callback, ignore
  
  if (stkCallback.ResultCode === 0) {
    // Payment successful
    const receipt = stkCallback.CallbackMetadata.Item.find(i => i.Name === 'MpesaReceiptNumber')?.Value;
    await txnRepo.updateStatus(txn.id, 'COMPLETED', receipt);
    // Send purchase confirmation SMS to employee
    await notifications.sendPurchaseConfirmation(txn);
  } else {
    // Payment failed (user cancelled or timeout)
    await txnRepo.updateStatus(txn.id, 'FAILED');
    // Reverse the credit reservation
    await empRepo.increaseCredit(txn.employee_id, txn.credit_portion); // Restore credit
  }
});
```

### 5.5 Create Merchant Routes

Implement merchant routes with JWT auth:

**POST /api/v1/merchant/verify-employee**
```
Body: { fpEmployeeId }
Returns: { employee: { name, orgName, availableCredit }, merchant: { name, category } }
Validates: employee active, merchant active, category allowed
```

**POST /api/v1/merchant/transaction**
```
Body: { fpEmployeeId, totalAmount }
Returns: { transaction, creditPortion, copayPortion, stkPushSent }
Triggers CreateTransactionUseCase
```

### 5.6 Test Transaction Flow

```bash
# Merchant verifies employee
curl -X POST http://localhost:3001/api/v1/merchant/verify-employee \
  -H "Authorization: Bearer <merchant_token>" \
  -d '{"fpEmployeeId":"FP-ETH-2026-XXXXX-X"}'

# Create transaction (credit only)
curl -X POST http://localhost:3001/api/v1/merchant/transaction \
  -H "Authorization: Bearer <merchant_token>" \
  -d '{"fpEmployeeId":"FP-ETH-2026-XXXXX-X","totalAmount":500}'

# Verify employee's available_credit decreased by 500
curl -X GET http://localhost:3001/api/v1/employee/dashboard \
  -H "Authorization: Bearer <employee_token>"
```

**Definition of Done Phase 5:**
- [ ] SplitEngine unit tests all pass
- [ ] LedgerEngine unit tests all pass
- [ ] Credit-only purchase: employee available_credit decreases correctly
- [ ] Journal entries created: debits = credits (invariant holds)
- [ ] STK Push triggered for co-pay portion (verify in M-PESA sandbox)
- [ ] STK Push webhook received: transaction status COMPLETED, M-PESA receipt recorded
- [ ] STK Push rejected by user: credit reservation reversed (credit restored)
- [ ] Double-spend prevented: concurrent requests handled by SELECT FOR UPDATE

---

## Phase 6: Dashboard APIs (All Three Portals)

**Goal:** All dashboard data APIs are working. Frontend can display real data.  
**Dependencies:** Phase 5

### 6.1 Employee Dashboard API

**GET /api/v1/employee/dashboard**

Returns:
```json
{
  "employee": {
    "fpEmployeeId": "FP-ETH-2026-A3X9K-Q",
    "fullName": "Abebe Kebede",
    "organizationName": "Acme Corp",
    "creditLimit": 5000,
    "availableCredit": 3200,
    "spentCredit": 1800,
    "utilizationPct": 36
  },
  "recentTransactions": [
    {
      "id": "...",
      "merchantName": "Merkato Restaurant",
      "category": "FOOD",
      "totalAmount": 450,
      "creditPortion": 450,
      "copayPortion": 0,
      "status": "COMPLETED",
      "createdAt": "2026-10-15T12:30:00Z"
    }
  ],
  "spendingByCategory": [
    { "category": "FOOD", "total": 1200 },
    { "category": "TRANSPORT", "total": 600 }
  ]
}
```

**GET /api/v1/employee/qr-code**

Returns: A QR code image (PNG base64 or URL) encoding the employee's FP-ID for merchant POS scanning. Use the `qrcode` npm package.

### 6.2 Organization Dashboard API

**GET /api/v1/org/dashboard**

Returns:
```json
{
  "org": { "name": "Acme Corp", "mpesaShortcode": "123456" },
  "stats": {
    "totalEmployees": 45,
    "activeEmployees": 43,
    "employeesWithOutstandingBalance": 18,
    "totalCreditExtended": 85000,
    "totalAvailableCredit": 62000,
    "pendingPasswordResets": 2
  },
  "topSpendingCategories": [
    { "category": "FOOD", "total": 45000 },
    { "category": "TRANSPORT", "total": 22000 }
  ],
  "recentTransactions": [ ... ]
}
```

**GET /api/v1/org/payroll/preview**

Query: `?periodStart=2026-10-01&periodEnd=2026-10-31`

Returns:
```json
{
  "period": { "start": "2026-10-01", "end": "2026-10-31" },
  "merchantDisbursements": [
    {
      "merchantId": "...",
      "merchantName": "Merkato Restaurant",
      "merchantMpesaNumber": "0912345678",
      "totalOwed": 45000,
      "transactionCount": 89
    }
  ],
  "employeeOutstandingBalances": [
    {
      "fpEmployeeId": "FP-ETH-2026-A3X9K-Q",
      "fullName": "Abebe Kebede",
      "totalCreditUsed": 1800,
      "breakdownByMerchant": [ ... ]
    }
  ],
  "totalMerchantDisbursements": 45000,
  "totalEmployeeSettlements": 0
}
```

### 6.3 Merchant Dashboard API

**GET /api/v1/merchant/dashboard**

Returns:
```json
{
  "merchant": { "businessName": "Merkato Restaurant", "mpesaNumber": "0912345678", "category": "FOOD" },
  "stats": {
    "totalOutstandingReceivables": 45000,
    "uniqueOrganizations": 3,
    "uniqueEmployees": 89,
    "totalTransactions": 156,
    "totalCreditGiven": 78000
  },
  "receivablesByOrg": [
    {
      "orgId": "...",
      "orgName": "Acme Corp",
      "totalOwed": 30000,
      "employeeCount": 45
    }
  ],
  "recentTransactions": [ ... ]
}
```

### 6.4 Add QR Code Support

```bash
npm install qrcode
```

In employee QR code endpoint:
```javascript
const QRCode = require('qrcode');
const qrDataUrl = await QRCode.toDataURL(fpEmployeeId);
return reply.send({ qrDataUrl, fpEmployeeId });
```

**Definition of Done Phase 6:**
- [ ] Employee dashboard returns correct credit stats
- [ ] Employee transaction history is accurate and complete
- [ ] Org dashboard shows all employee and transaction stats
- [ ] Org payroll preview correctly sums per-merchant and per-employee
- [ ] Merchant dashboard shows correct receivables by org
- [ ] QR code endpoint returns valid base64 PNG

---

## Phase 7: Payroll Settlement

**Goal:** Org Admins can run payroll. System sends B2C payments to merchants and employees via M-PESA. Settlement completes automatically on callback.  
**Dependencies:** Phase 6

### 7.1 Build M-PESA Infrastructure Layer

Create `src/server/infrastructure/mpesa/MpesaClient.js`:

```javascript
const axios = require('axios');
const NodeCache = require('node-cache');
const { loadConfig } = require('../../config');

const tokenCache = new NodeCache({ stdTTL: 3300 }); // 55 minutes

class MpesaClient {
  constructor() {
    this.config = loadConfig();
    this.baseUrl = this.config.MPESA_BASE_URL;
  }

  async getAccessToken() {
    const cached = tokenCache.get('token');
    if (cached) return cached;
    
    const credentials = Buffer.from(
      `${this.config.MPESA_CONSUMER_KEY}:${this.config.MPESA_CONSUMER_SECRET}`
    ).toString('base64');
    
    const response = await axios.get(`${this.baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
      headers: { Authorization: `Basic ${credentials}` },
    });
    
    const token = response.data.access_token;
    tokenCache.set('token', token);
    return token;
  }

  async post(path, data) {
    const token = await this.getAccessToken();
    return axios.post(`${this.baseUrl}${path}`, data, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      timeout: 30000,
    });
  }
}
module.exports = { MpesaClient };
```

Create `src/server/infrastructure/mpesa/b2c.js`:

```javascript
const { MpesaClient } = require('./MpesaClient');
const { loadConfig } = require('../../config');

const client = new MpesaClient();

async function sendB2C({ commandId, amount, recipientPhone, remarks, queueTimeOutUrl, resultUrl, occasion }) {
  const config = loadConfig();
  
  return client.post('/mpesa/b2c/v1/paymentrequest', {
    InitiatorName: config.MPESA_INITIATOR_NAME,
    SecurityCredential: config.MPESA_SECURITY_CREDENTIAL,
    CommandID: commandId, // 'BusinessPayment' or 'SalaryPayment'
    Amount: Math.round(amount), // M-PESA requires integer ETB
    PartyA: config.MPESA_SHORTCODE,
    PartyB: recipientPhone,
    Remarks: remarks.slice(0, 100), // M-PESA max 100 chars
    QueueTimeOutURL: queueTimeOutUrl,
    ResultURL: resultUrl,
    Occasion: (occasion || '').slice(0, 100),
  });
}

module.exports = { sendB2C };
```

### 7.2 Build RunPayroll Use Case

Create `src/server/modules/payroll/ports/incoming/RunPayrollUseCase.js`:

```javascript
class RunPayrollUseCase {
  async execute({ organizationId, periodStart, periodEnd, employeeSalaries, initiatedBy }) {
    // 1. Load all COMPLETED transactions for this org in this period
    // 2. Group by merchant: calculate total owed per merchant
    // 3. Group by employee: calculate total credit used per employee
    // 4. Validate: all employee IDs in employeeSalaries exist and belong to this org
    // 5. Create payroll_settlement record (status: RUNNING)
    // 6. Create payroll_disbursement_lines for each merchant (type: MERCHANT)
    // 7. Create payroll_disbursement_lines for each employee (type: EMPLOYEE)
    //    amount = grossSalary - creditUsed
    // 8. Dispatch B2C calls for each merchant (async, use pg-boss job queue)
    // 9. Dispatch B2C calls for each employee
    // 10. Return settlement summary
  }
}
```

### 7.3 B2C Result Webhook Handler

Create `src/server/modules/payroll/adapters/incoming/b2c-webhook.routes.js`:

```javascript
fastify.post('/api/v1/webhooks/mpesa/b2c-result', async (request, reply) => {
  await reply.code(200).send({ ResultCode: 0, ResultDesc: 'Accepted' });
  
  const { Result } = request.body;
  const conversationId = Result.ConversationID;
  
  // Find disbursement line by conversation_id
  const line = await payrollRepo.findLineByConversationId(conversationId);
  if (!line) return;
  
  if (Result.ResultCode === 0) {
    const receiptNo = Result.ResultParameters?.ResultParameter
      ?.find(p => p.Key === 'TransactionReceipt')?.Value;
    
    await payrollRepo.markLineCompleted(line.id, receiptNo);
    
    // Check if all lines for this settlement are complete
    const allComplete = await payrollRepo.checkAllLinesComplete(line.settlement_id);
    if (allComplete) {
      // Reset employee credit accounts
      await empRepo.resetCreditForSettlement(line.settlement_id);
      // Mark settlement as COMPLETED
      await payrollRepo.markSettlementCompleted(line.settlement_id);
      // Notify org admin
      await notifications.sendSettlementCompleted(line.settlement_id);
    }
  } else {
    await payrollRepo.markLineFailed(line.id, Result.ResultDesc);
    await notifications.sendSettlementLineFailed(line.id, Result.ResultDesc);
  }
});
```

### 7.4 Test Payroll Settlement (Sandbox)

```bash
# Preview payroll
curl -X GET "http://localhost:3001/api/v1/org/payroll/preview?periodStart=2026-10-01&periodEnd=2026-10-31" \
  -H "Authorization: Bearer <org_admin_token>"

# Run payroll (M-PESA sandbox)
curl -X POST http://localhost:3001/api/v1/org/payroll/run \
  -H "Authorization: Bearer <org_admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "periodStart": "2026-10-01",
    "periodEnd": "2026-10-31",
    "employeeSalaries": [
      { "employeeId": "...", "grossSalary": 15000 }
    ]
  }'
```

**Definition of Done Phase 7:**
- [ ] Payroll preview returns accurate merchant and employee breakdowns
- [ ] B2C calls dispatched to M-PESA sandbox (verify in sandbox dashboard)
- [ ] B2C result webhook received and processed correctly
- [ ] On settlement complete: employee credit accounts reset to credit_limit
- [ ] Settlement record status COMPLETED
- [ ] Failed disbursement line: admin notified, settlement status PARTIAL

---

## Phase 8: Frontend Implementation

**Goal:** Full React SPA with all portals is built and connected to the backend.  
**Dependencies:** Phases 3-7 (all APIs working)

### 8.1 Vite + React Setup

```bash
cd src/client
npm create vite@latest . -- --template react
npm install react-router-dom @tanstack/react-query zustand axios framer-motion recharts qrcode.react
```

### 8.2 Build Design System First

Extend `src/client/src/styles/tokens.css` with the FlexPay v2 token set:

```css
:root {
  /* Color Palette — FlexPay Dark Fintech */
  --color-bg-base:        #0a0b0d;     /* Deepest background */
  --color-bg-surface:     #111318;     /* Card/panel surface */
  --color-bg-elevated:    #1a1d24;     /* Hover, raised elements */
  --color-border:         #2a2d36;     /* Borders */
  --color-border-subtle:  #1f2128;
  
  /* Accent — M-PESA Green */
  --color-accent:         #00c853;     /* Primary CTA, success */
  --color-accent-dim:     #00c85322;   /* Background tint */
  --color-accent-hover:   #00e676;
  
  /* Text */
  --color-text-primary:   #f0f2f7;
  --color-text-secondary: #8b92a5;
  --color-text-muted:     #4a5168;
  
  /* Semantic */
  --color-danger:         #ff4757;
  --color-warning:        #ffa502;
  --color-info:           #3498db;
  
  /* Typography */
  --font-family:          'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  --font-mono:            'JetBrains Mono', 'Fira Code', monospace;
  
  /* Spacing */
  --space-1: 4px;   --space-2: 8px;   --space-3: 12px;  --space-4: 16px;
  --space-5: 20px;  --space-6: 24px;  --space-8: 32px;  --space-10: 40px;
  --space-12: 48px; --space-16: 64px; --space-20: 80px;
  
  /* Border radius */
  --radius-sm: 6px;   --radius-md: 10px;   --radius-lg: 16px;   --radius-xl: 24px;
  
  /* Shadows */
  --shadow-card: 0 4px 24px rgba(0, 0, 0, 0.4);
  --shadow-accent: 0 0 20px rgba(0, 200, 83, 0.15);
  
  /* Transitions */
  --transition-fast:   all 0.12s ease;
  --transition-base:   all 0.2s ease;
  --transition-smooth: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
```

Add Inter font in `index.html`:
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
```

### 8.3 Build Auth Store (Zustand)

Create `src/client/src/stores/authStore.js`:

```javascript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useAuthStore = create(persist((set) => ({
  user: null,
  accessToken: null,
  setAuth: (user, accessToken) => set({ user, accessToken }),
  clearAuth: () => set({ user: null, accessToken: null }),
}), {
  name: 'flexpay-auth',
  partialize: (state) => ({ user: state.user }), // Don't persist token in localStorage
}));
```

### 8.4 Build Axios Instance with JWT Refresh

Create `src/client/src/services/api.js`:

```javascript
import axios from 'axios';
import { useAuthStore } from '../stores/authStore';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1',
  withCredentials: true, // Send refresh token cookie automatically
});

// Request interceptor: add access token
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Response interceptor: refresh on 401
let isRefreshing = false;
let refreshQueue = [];

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status !== 401 || error.config._retry) {
      return Promise.reject(error);
    }
    
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        refreshQueue.push({ resolve, reject, config: error.config });
      });
    }
    
    isRefreshing = true;
    error.config._retry = true;
    
    try {
      const { data } = await axios.post('/api/v1/auth/refresh', {}, { withCredentials: true });
      useAuthStore.getState().setAuth(useAuthStore.getState().user, data.accessToken);
      refreshQueue.forEach(({ resolve, config }) => {
        config.headers.Authorization = `Bearer ${data.accessToken}`;
        resolve(api(config));
      });
      refreshQueue = [];
      return api(error.config);
    } catch {
      useAuthStore.getState().clearAuth();
      window.location.href = '/auth';
    } finally {
      isRefreshing = false;
    }
  }
);

export default api;
```

### 8.5 Build Landing Page

Create `src/client/src/features/landing/LandingPage.jsx`.

Design direction: Elite dark fintech landing page.

Key sections (in order):
1. **Navigation bar**: FlexPay logo (green F icon + wordmark) + "Get Started" CTA button
2. **Hero section**: Large headline "Employee Benefits, Powered by M-PESA" + animated payment-split diagram + two CTA buttons (For Organizations, For Merchants)
3. **How It Works**: 3 steps with animated connecting line — Fund → Spend → Settle
4. **Features grid**: 6 cards with icons (Category-locked benefits, Smart credit split, Instant settlement, Transparent payroll, Real-time audit, M-PESA native)
5. **Stats ticker**: Animated number counters
6. **Three-column value props**: Org / Employee / Merchant benefits
7. **Security badges row**: M-PESA certified, 256-bit encrypted, Double-entry ledger, CBE-compliant

Framer Motion animations:
- Hero: staggered fade-up (delay 0, 0.1, 0.2)
- Feature cards: whileHover scale 1.02
- Stats: useInView + count animation

### 8.6 Build Auth Hub

Create `src/client/src/features/auth/AuthHub.jsx`.

Design: Three animated portal cards on a dark background. Each card has:
- Icon (building, store, person)
- Label + description
- Hover: card lifts, border glows green
- Click: smooth navigate to portal auth page

### 8.7 Build Employee Portal

Key components:

**CreditRing.jsx** — Circular SVG gauge showing credit utilization:
- Outer ring = credit limit
- Filled arc = credit used (red/orange/green depending on utilization %)
- Center text: "ETB X,XXX Available"
- Animated stroke-dashoffset on mount

**EmployeeDashboard.jsx** — Layout:
```
[Credit Ring + Balance Stats] [Recent Transactions List]
[Spending by Category Bar Chart]
[Full Transaction Table with search/filter]
```

**EmployeeProfile.jsx** — QR code card:
- Large QR code (from /employee/qr-code endpoint)
- Download button (saves as PNG)
- Employee name + FP-ID displayed below

### 8.8 Build Organization Portal

Key components:

**AddEmployeeForm.jsx** — Multi-step form:
1. Fill name, phone, department, credit limit
2. Submit -> API call -> receive { fpEmployeeId, plainPassword }
3. Step 3: **PasswordDisplay** modal — shows FP-ID and password in large, copyable text. Text: "This password will never be shown again. Copy it or send it to the employee now." Countdown: auto-close in 60 seconds.

**PasswordDisplay.jsx**:
```jsx
// One-time display component
// Parent: AddEmployeeForm after successful employee creation
// Shows password in monospace font, large size
// "Copy Password" button with checkmark animation
// "Send via SMS" button (calls optional SMS endpoint)
// Warning banner: "This is the only time this password will be displayed"
// 60-second countdown timer before auto-dismiss
// Backdrop blur modal, cannot be dismissed by clicking outside
```

**PasswordResetRequests.jsx** — Approve/reject queue:
- Table: Employee Name | FP-ID | Requested At | Status | Actions
- "Approve" opens confirmation modal
- On approve: shows new generated password in PasswordDisplay (same component)

### 8.9 Build Merchant POS

**MerchantPOS.jsx** — Two-step checkout:

Step 1: Verify Employee
```
[QR Scanner OR Manual FP-ID input]
-> "Verify Employee" button
-> Shows: Employee Name, Org, Available Credit, Category-eligible badge
```

Step 2: Enter Amount
```
[Amount input in ETB]
-> Real-time split preview:
   "FlexPay Credit: ETB X,XXX"
   "M-PESA Co-pay:  ETB X,XXX"
   "Total:          ETB X,XXX"
-> "Authorize" button
-> If co-pay: "STK Push sent to employee's phone" loading state
-> On complete: success screen with transaction ref
```

### 8.10 Build Protected Route

```jsx
// src/client/src/components/layout/ProtectedRoute.jsx
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';

export function ProtectedRoute({ children, allowedRoles }) {
  const { user, accessToken } = useAuthStore();
  if (!accessToken || !user) return <Navigate to="/auth" replace />;
  if (allowedRoles && !allowedRoles.includes(user.role)) return <Navigate to="/auth" replace />;
  return children;
}
```

### 8.11 Final Wiring & Testing

Create `src/client/src/app/Router.jsx` with all routes lazy-loaded:

```jsx
import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';

const LandingPage = lazy(() => import('../features/landing/LandingPage'));
const AuthHub = lazy(() => import('../features/auth/AuthHub'));
// ... etc

export function Router() {
  return (
    <Suspense fallback={<div className="loading-spinner" />}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/auth" element={<AuthHub />} />
        <Route path="/auth/organization" element={<OrgAuthPage />} />
        <Route path="/auth/merchant" element={<MerchantAuthPage />} />
        <Route path="/auth/employee" element={<EmployeeLoginPage />} />
        <Route path="/org/*" element={
          <ProtectedRoute allowedRoles={['ORG_ADMIN', 'ORG_CONTROLLER']}>
            <OrgLayout />
          </ProtectedRoute>
        } />
        <Route path="/employee/*" element={
          <ProtectedRoute allowedRoles={['EMPLOYEE']}>
            <EmployeeLayout />
          </ProtectedRoute>
        } />
        <Route path="/merchant/*" element={
          <ProtectedRoute allowedRoles={['MERCHANT_OWNER', 'MERCHANT_STAFF']}>
            <MerchantLayout />
          </ProtectedRoute>
        } />
      </Routes>
    </Suspense>
  );
}
```

**Definition of Done Phase 8:**
- [ ] Landing page renders with all 7 sections and animations
- [ ] Auth Hub renders with 3 portal cards
- [ ] Org Admin can register, login, create employees, see FP-ID + password in modal
- [ ] Employee can login, see dashboard with credit ring, view transactions, download QR
- [ ] Merchant can login, verify employee, create transaction, see receivables
- [ ] Payroll preview visible in org portal
- [ ] All routes protected correctly (wrong role redirects to /auth)
- [ ] JWT refresh works transparently (user stays logged in)
- [ ] Responsive: works on mobile (merchant POS is used on phones)

---

## Phase 9: Testing, Polish & Deployment

**Goal:** E2E tests pass. Security hardened. Deployed to production.

### 9.1 E2E Tests with Playwright

Write tests in `tests/e2e/`:
- `landing.spec.js`: Page loads, CTA visible, sections exist
- `org-flow.spec.js`: Register org → add employee → employee logs in
- `employee-flow.spec.js`: Employee login → dashboard → transactions → QR code
- `merchant-flow.spec.js`: Merchant login → verify employee → transaction
- `payroll-flow.spec.js`: Preview payroll → run payroll → verify settlement

### 9.2 Security Hardening Checklist

Before production:
- [ ] All API routes have Zod validation
- [ ] Rate limiting configured (5/15min for auth, 100/min for other routes)
- [ ] Helmet.js headers configured (CSP, HSTS, X-Frame-Options)
- [ ] M-PESA webhook IP whitelist is active
- [ ] No passwords or tokens appear in any log output
- [ ] Database app user has REVOKE UPDATE/DELETE on audit_log and journal_entries
- [ ] RS256 keys are stored only in environment variables (not committed to git)
- [ ] .env is in .gitignore and not in repository

### 9.3 Deployment

```bash
# Backend (Render)
# Set all environment variables in Render dashboard
# Add render.yaml to root:

services:
  - type: web
    name: flexpay-api
    runtime: node
    plan: starter
    buildCommand: npm install
    startCommand: node src/server/index.js
    envVars:
      - key: NODE_ENV
        value: production

# Frontend (Vercel)
# Connect GitHub repo to Vercel
# Set VITE_API_URL=https://your-render-app.onrender.com
```

### 9.4 Post-Deployment Verification

```bash
# Health check
curl https://api.flexpay.et/health

# Register M-PESA C2B URLs (done once)
curl -X POST https://api.flexpay.et/api/v1/webhooks/mpesa/c2b-confirm \
  -d '{"ShortCode":"...","ResponseType":"Completed","ConfirmationURL":"https://api.flexpay.et/api/v1/webhooks/mpesa/c2b-confirm","ValidationURL":"https://api.flexpay.et/api/v1/webhooks/mpesa/c2b-validate"}'
```

---

## Implementation Priority Summary

| Phase | Priority | Estimated Effort | Risk |
|---|---|---|---|
| Phase 0: Environment | MUST | 2 hours | Low |
| Phase 1: Database Schema | MUST | 3 hours | Medium (schema mistakes are costly) |
| Phase 2: Crypto Utilities | MUST | 2 hours | Low |
| Phase 3: Auth Module | MUST | 4 hours | Medium |
| Phase 4: Org & Employee Module | MUST | 6 hours | Medium |
| Phase 5: Transaction Flow | MUST | 8 hours | HIGH (race conditions, double-spend) |
| Phase 6: Dashboard APIs | HIGH | 4 hours | Low |
| Phase 7: Payroll Settlement | HIGH | 6 hours | HIGH (M-PESA B2C is irreversible) |
| Phase 8: Frontend | HIGH | 12 hours | Medium |
| Phase 9: Testing & Deploy | MUST | 4 hours | Medium |

**Total estimated:** ~50 hours of focused implementation

---

## Common Pitfalls to Avoid

### Financial Pitfalls
1. **NEVER** use JavaScript floating-point arithmetic for money calculations — use `NUMERIC(14,2)` in PostgreSQL and string-based arithmetic on the server
2. **NEVER** fire B2C calls without idempotency protection — they are irreversible money movements
3. **ALWAYS** verify account balance before running payroll — insufficient funds causes partial settlements
4. **ALWAYS** use `SELECT ... FOR UPDATE` when deducting credit — without this, concurrent requests can overdraft

### M-PESA Pitfalls
5. **ALWAYS** respond 200 to webhooks immediately before processing — Safaricom times out in 10 seconds
6. M-PESA Ethiopia password formula uses **SHA256 hex uppercase then Base64** — this is different from Kenya's Daraja
7. OAuth tokens are valid for **3600 seconds** — cache for 3300 to have a safety buffer
8. B2C `PartyB` for `SalaryPayment` must be `251XXXXXXXXX` format (country code, no +)

### Security Pitfalls
9. **NEVER** log the `plainPassword` returned by `generateCompliantPassword()` — configure Pino redact
10. **NEVER** store the raw refresh token — only its SHA256 hash
11. The generated password is shown **once** to the Org Admin and never again — handle this in UI with a self-dismissing modal
12. Employee IDs are not secrets (shown on QR codes, shared with merchants) — passwords are the authenticator

### Frontend Pitfalls
13. **Never** store the access token in localStorage — store only in Zustand (memory) — it's lost on tab close, which is correct (forces fresh login)
14. The refresh token cookie handles session persistence via HttpOnly cookie — no manual storage needed
15. The `PasswordDisplay` component must be **unmountable on navigate** — if the admin navigates away before copying, password is gone (by design)

---

*Implementation Plan v1.0.0 — Cross-reference with blueprint.md for architecture decisions*  
*Last updated: 2026-10-16*
