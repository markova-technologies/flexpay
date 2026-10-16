const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { buildServer } = require('../../src/server/index');
const { generateCompliantPassword } = require('../../src/server/shared/crypto/passwordGenerator');
const { generateEmployeeId } = require('../../src/server/shared/crypto/employeeIdGenerator');
const { hashPassword } = require('../../src/server/shared/crypto/argon2');
const { verifyAccessToken } = require('../../src/server/shared/crypto/jwt');

// In-Memory Test Repositories to isolate unit tests from external database dependency
class InMemoryAuthRepository {
  constructor() {
    this.orgs = new Map();
    this.merchants = new Map();
    this.employees = new Map();
    this.users = new Map();
    this.policies = new Map();
    this.resetRequests = [];
  }

  async findOrgByTin(tin) {
    for (const org of this.orgs.values()) {
      if (org.tin_number === tin && !org.deleted_at) return org;
    }
    return null;
  }

  async createOrganization({ name, tinNumber, contactPhone, mpesaShortcode }) {
    const id = `org-${Math.random().toString(36).substring(2, 9)}`;
    const org = {
      id,
      name,
      tin_number: tinNumber,
      contact_phone: contactPhone,
      mpesa_shortcode: mpesaShortcode || null,
      status: 'ACTIVE',
      created_at: new Date(),
    };
    this.orgs.set(id, org);
    return org;
  }

  async createOrgCreditPolicy(orgId, globalLimit = 0) {
    const policy = { id: `pol-${orgId}`, organization_id: orgId, global_credit_limit: globalLimit };
    this.policies.set(orgId, policy);
    return policy;
  }

  async createUser({ role, organizationId, merchantId, employeeId, passwordHash, mustChangePassword = false }) {
    const id = `usr-${Math.random().toString(36).substring(2, 9)}`;
    const user = {
      id,
      role,
      organization_id: organizationId || null,
      merchant_id: merchantId || null,
      employee_id: employeeId || null,
      password_hash: passwordHash,
      must_change_password: mustChangePassword,
      status: 'ACTIVE',
      created_at: new Date(),
    };
    this.users.set(id, user);
    return user;
  }

  async findUserByOrgId(orgId, role = 'ORG_ADMIN') {
    for (const user of this.users.values()) {
      if (user.organization_id === orgId && user.role === role) return user;
    }
    return null;
  }

  async findMerchantByMpesaNumber(mpesa) {
    for (const m of this.merchants.values()) {
      if (m.mpesa_number === mpesa && !m.deleted_at) return m;
    }
    return null;
  }

  async createMerchant({ businessName, mpesaNumber, category, contactPhone }) {
    const id = `mch-${Math.random().toString(36).substring(2, 9)}`;
    const merchant = {
      id,
      business_name: businessName,
      mpesa_number: mpesaNumber,
      category,
      contact_phone: contactPhone,
      status: 'ACTIVE',
      created_at: new Date(),
    };
    this.merchants.set(id, merchant);
    return merchant;
  }

  async findUserByMerchantId(merchantId) {
    for (const user of this.users.values()) {
      if (user.merchant_id === merchantId) return user;
    }
    return null;
  }

  async findEmployeeByFpId(fpId) {
    for (const emp of this.employees.values()) {
      if (emp.fp_employee_id === fpId && !emp.deleted_at) return emp;
    }
    return null;
  }

  async findUserByEmployeeId(empId) {
    for (const user of this.users.values()) {
      if (user.employee_id === empId) return user;
    }
    return null;
  }

  async findUserById(userId) {
    return this.users.get(userId) || null;
  }

  async updateLastLogin(userId) {
    const user = this.users.get(userId);
    if (user) user.last_login_at = new Date();
  }

  async createPasswordResetRequest({ employeeId, deliveryMethod }) {
    const req = { id: `rst-${Date.now()}`, employee_id: employeeId, delivery_method: deliveryMethod, status: 'PENDING' };
    this.resetRequests.push(req);
    return req;
  }
}

class InMemorySessionRepository {
  constructor() {
    this.tokens = new Map();
  }

  async createRefreshToken(userId, { ipAddress, userAgent, expiresInSeconds = 604800 } = {}) {
    const rawToken = require('node:crypto').randomBytes(32).toString('hex');
    const hash = require('node:crypto').createHash('sha256').update(rawToken).digest('hex');
    const record = {
      id: `tok-${Date.now()}`,
      user_id: userId,
      token_hash: hash,
      expires_at: new Date(Date.now() + expiresInSeconds * 1000),
      revoked_at: null,
      ip_address: ipAddress,
      user_agent: userAgent,
    };
    this.tokens.set(hash, record);
    return rawToken;
  }

  async findAndRotateRefreshToken(rawToken) {
    const hash = require('node:crypto').createHash('sha256').update(rawToken).digest('hex');
    const record = this.tokens.get(hash);
    if (!record || record.revoked_at || record.expires_at < new Date()) {
      return null;
    }
    record.revoked_at = new Date();
    return record;
  }

  async revokeAllForUser(userId) {
    for (const record of this.tokens.values()) {
      if (record.user_id === userId) {
        record.revoked_at = new Date();
      }
    }
  }
}

describe('Phase 3: Auth Module (Register, Login, Employee, Refresh)', () => {
  let server;
  let authRepo;
  let sessionRepo;

  before(async () => {
    authRepo = new InMemoryAuthRepository();
    sessionRepo = new InMemorySessionRepository();
    server = await buildServer({
      logger: false,
      authRepo,
      sessionRepo,
    });
  });

  after(async () => {
    await server.close();
  });

  describe('3.1 Organization Registration & Login', () => {
    test('Registers a new organization and returns 201', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/org/register',
        payload: {
          orgName: 'Ethio Telecom HQ',
          tinNumber: 'TIN-0098765',
          contactPhone: '0912345678',
          mpesaShortcode: '200501',
          password: 'EnterprisePassword2026!',
        },
      });

      assert.equal(res.statusCode, 201);
      const body = JSON.parse(res.payload);
      assert.ok(body.organizationId, 'Must return organizationId');
      assert.ok(body.userId, 'Must return userId');
    });

    test('Rejects duplicate TIN with 409 Conflict', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/org/register',
        payload: {
          orgName: 'Duplicate Org',
          tinNumber: 'TIN-0098765',
          contactPhone: '0911223344',
          password: 'AnotherPassword123!',
        },
      });

      assert.equal(res.statusCode, 409);
    });

    test('Logs in organization admin with valid credentials', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/org/login',
        payload: {
          tinNumber: 'TIN-0098765',
          password: 'EnterprisePassword2026!',
        },
      });

      assert.equal(res.statusCode, 200);
      const body = JSON.parse(res.payload);
      assert.ok(body.accessToken, 'Must return RS256 accessToken');
      assert.equal(body.user.role, 'ORG_ADMIN');

      const decoded = verifyAccessToken(body.accessToken);
      assert.equal(decoded.role, 'ORG_ADMIN');
    });

    test('Rejects organization login with wrong password', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/org/login',
        payload: {
          tinNumber: 'TIN-0098765',
          password: 'IncorrectPassword!',
        },
      });

      assert.equal(res.statusCode, 401);
    });
  });

  describe('3.2 Merchant Registration & Login', () => {
    test('Registers a new verified merchant', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/merchant/register',
        payload: {
          businessName: 'Bole Fresh Mart',
          mpesaNumber: '251911998877',
          category: 'GROCERY',
          contactPhone: '0911998877',
          password: 'MerchantPass2026!',
        },
      });

      assert.equal(res.statusCode, 201);
      const body = JSON.parse(res.payload);
      assert.ok(body.merchantId);
    });

    test('Logs in merchant owner with valid credentials', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/merchant/login',
        payload: {
          mpesaNumber: '251911998877',
          password: 'MerchantPass2026!',
        },
      });

      assert.equal(res.statusCode, 200);
      const body = JSON.parse(res.payload);
      assert.ok(body.accessToken);
      assert.equal(body.user.role, 'MERCHANT_OWNER');
      assert.equal(body.user.category, 'GROCERY');
    });
  });

  describe('3.3 Employee Login & Forgot Password Workflow', () => {
    let fpId;
    let employeePassword;

    before(async () => {
      fpId = generateEmployeeId('ETH');
      employeePassword = generateCompliantPassword(16);
      const passwordHash = await hashPassword(employeePassword);

      // Pre-seed an employee created by an org admin
      const empId = `emp-${Date.now()}`;
      authRepo.employees.set(empId, {
        id: empId,
        fp_employee_id: fpId,
        organization_id: 'org-test-1',
        full_name: 'Almaz Tadesse',
        phone_number: '251922334455',
        credit_limit: 5000,
        available_credit: 5000,
        status: 'ACTIVE',
      });

      authRepo.users.set(`usr-${empId}`, {
        id: `usr-${empId}`,
        role: 'EMPLOYEE',
        employee_id: empId,
        organization_id: 'org-test-1',
        password_hash: passwordHash,
        status: 'ACTIVE',
        must_change_password: true,
      });
    });

    test('Employee logs in with 16-char generated password and valid FP-ID', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/employee/login',
        payload: {
          fpEmployeeId: fpId,
          password: employeePassword,
        },
      });

      assert.equal(res.statusCode, 200);
      const body = JSON.parse(res.payload);
      assert.ok(body.accessToken);
      assert.equal(body.user.role, 'EMPLOYEE');
      assert.equal(body.user.fpEmployeeId, fpId);
      assert.equal(body.user.mustChangePassword, true);

      const decoded = verifyAccessToken(body.accessToken);
      assert.equal(decoded.role, 'EMPLOYEE');
      assert.equal(decoded.employeeId, authRepo.employees.get(Array.from(authRepo.employees.keys())[0]).id);
    });

    test('Rejects employee login with bad checksum format', async () => {
      const parts = fpId.split('-');
      const badChecksum = parts[4] === 'Z' ? 'A' : 'Z';
      const badId = `${parts[0]}-${parts[1]}-${parts[2]}-${parts[3]}-${badChecksum}`;

      const res = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/employee/login',
        payload: {
          fpEmployeeId: badId,
          password: employeePassword,
        },
      });

      assert.equal(res.statusCode, 400);
      const body = JSON.parse(res.payload);
      assert.ok(body.error.includes('checksum'));
    });

    test('Employee forgot-password routes request to organization admin', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/employee/forgot-password',
        payload: {
          fpEmployeeId: fpId,
          phoneNumber: '0922334455', // Normalizes to 251922334455
        },
      });

      assert.equal(res.statusCode, 200);
      assert.equal(authRepo.resetRequests.length, 1);
      assert.equal(authRepo.resetRequests[0].status, 'PENDING');
    });
  });

  describe('3.4 Token Refresh & Rotation and Logout', () => {
    let accessToken;
    let refreshCookie;

    before(async () => {
      const loginRes = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/org/login',
        payload: {
          tinNumber: 'TIN-0098765',
          password: 'EnterprisePassword2026!',
        },
      });
      const body = JSON.parse(loginRes.payload);
      accessToken = body.accessToken;
      refreshCookie = loginRes.cookies.find((c) => c.name === 'refresh_token');
    });

    test('Refreshes access token and rotates refresh token', async () => {
      assert.ok(refreshCookie, 'Refresh token cookie must be set');
      const res = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/refresh',
        cookies: {
          refresh_token: refreshCookie.value,
        },
      });

      assert.equal(res.statusCode, 200);
      const body = JSON.parse(res.payload);
      assert.ok(body.accessToken);

      // Verify old refresh token is revoked (cannot replay)
      const replayRes = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/refresh',
        cookies: {
          refresh_token: refreshCookie.value,
        },
      });
      assert.equal(replayRes.statusCode, 401, 'Replay of old refresh token must be rejected');
    });

    test('Logs out user and clears refresh cookie', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/logout',
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });

      assert.equal(res.statusCode, 200);
      const cookie = res.cookies.find((c) => c.name === 'refresh_token');
      assert.ok(cookie, 'Logout must clear cookie');
    });
  });
});
