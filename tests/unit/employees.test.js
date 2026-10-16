const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { buildServer } = require('../../src/server/index');
const { Employee } = require('../../src/server/modules/employees/domain/Employee');
const { CreateEmployeeUseCase } = require('../../src/server/modules/employees/ports/incoming/CreateEmployeeUseCase');
const { signAccessToken } = require('../../src/server/shared/crypto/jwt');

// Test InMemory Repository for Employee Management
class InMemoryEmployeeRepository {
  constructor() {
    this.employees = new Map();
    this.users = new Map();
    this.policies = new Map();
    this.resetRequests = new Map();
    this.orgs = new Map([
      ['org-acme-1', { id: 'org-acme-1', name: 'Acme Corporation', mpesa_shortcode: '2005' }],
    ]);

    // Initial default policy
    this.policies.set('org-acme-1', {
      organization_id: 'org-acme-1',
      global_credit_limit: 3500,
      allowed_categories: ['FOOD', 'TRANSPORT'],
    });
  }

  async findByPhone(orgId, phone) {
    for (const emp of this.employees.values()) {
      if (emp.organization_id === orgId && emp.phone_number === phone && !emp.deleted_at) {
        return emp;
      }
    }
    return null;
  }

  async findByFpId(fpId) {
    for (const emp of this.employees.values()) {
      if (emp.fp_employee_id === fpId && !emp.deleted_at) {
        return emp;
      }
    }
    return null;
  }

  async findById(empId) {
    return this.employees.get(empId) || null;
  }

  async findByOrgId(orgId, { page = 1, limit = 20, search, department } = {}) {
    let list = Array.from(this.employees.values()).filter(
      (e) => e.organization_id === orgId && !e.deleted_at
    );
    if (department) list = list.filter((e) => e.department === department);
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(
        (e) =>
          e.full_name.toLowerCase().includes(s) ||
          e.fp_employee_id.toLowerCase().includes(s) ||
          e.phone_number.includes(s)
      );
    }
    const offset = (page - 1) * limit;
    return list.slice(offset, offset + limit);
  }

  async createEmployeeWithUser({
    fpEmployeeId,
    organizationId,
    fullName,
    phoneNumber,
    creditLimit,
    department,
    passwordHash,
  }) {
    const id = `emp-${Math.random().toString(36).substring(2, 9)}`;
    const emp = {
      id,
      fp_employee_id: fpEmployeeId,
      organization_id: organizationId,
      full_name: fullName,
      phone_number: phoneNumber,
      credit_limit: creditLimit,
      available_credit: creditLimit,
      department: department || null,
      status: 'ACTIVE',
      created_at: new Date(),
    };
    this.employees.set(id, emp);

    const userId = `usr-${id}`;
    this.users.set(userId, {
      id: userId,
      role: 'EMPLOYEE',
      organization_id: organizationId,
      employee_id: id,
      password_hash: passwordHash,
      status: 'ACTIVE',
      must_change_password: false,
    });

    return emp;
  }

  async updateCreditLimit(employeeId, newLimit) {
    const emp = this.employees.get(employeeId);
    if (!emp) throw new Error('Employee not found');
    const spent = Number(emp.credit_limit) - Number(emp.available_credit);
    if (newLimit < spent) {
      throw new Error(`New limit cannot be lower than already spent amount of ${spent}`);
    }
    emp.credit_limit = newLimit;
    emp.available_credit = Math.max(0, newLimit - spent);
    emp.updated_at = new Date();
    return emp;
  }

  async getOrgCreditPolicy(orgId) {
    return this.policies.get(orgId) || null;
  }

  async updateOrgCreditPolicy(orgId, { globalLimit, allowedCategories }) {
    const existing = this.policies.get(orgId) || { organization_id: orgId };
    if (globalLimit !== undefined) existing.global_credit_limit = globalLimit;
    if (allowedCategories !== undefined) existing.allowed_categories = allowedCategories;
    this.policies.set(orgId, existing);
    return existing;
  }

  async listPasswordResetRequests(orgId, status = 'PENDING') {
    const results = [];
    for (const req of this.resetRequests.values()) {
      const emp = this.employees.get(req.employee_id);
      if (emp && emp.organization_id === orgId && req.status === status) {
        results.push({
          requestId: req.id,
          status: req.status,
          deliveryMethod: req.delivery_method,
          requestedAt: req.requested_at,
          employeeId: emp.id,
          fpEmployeeId: emp.fp_employee_id,
          fullName: emp.full_name,
          phoneNumber: emp.phone_number,
          department: emp.department,
        });
      }
    }
    return results;
  }

  async findPasswordResetRequestById(requestId) {
    const req = this.resetRequests.get(requestId);
    if (!req) return null;
    const emp = this.employees.get(req.employee_id);
    return {
      requestId: req.id,
      status: req.status,
      deliveryMethod: req.delivery_method,
      employeeId: req.employee_id,
      organizationId: emp ? emp.organization_id : null,
      phoneNumber: emp ? emp.phone_number : null,
      fullName: emp ? emp.full_name : null,
    };
  }

  async approvePasswordReset(requestId, reviewerUserId, newPasswordHash) {
    const req = this.resetRequests.get(requestId);
    if (!req) throw new Error('Request not found');
    req.status = 'APPROVED';
    req.reviewed_by = reviewerUserId;
    req.reviewed_at = new Date();

    // Update user password
    for (const user of this.users.values()) {
      if (user.employee_id === req.employee_id) {
        user.password_hash = newPasswordHash;
        user.must_change_password = true;
      }
    }
    return req;
  }

  async rejectPasswordReset(requestId, reviewerUserId) {
    const req = this.resetRequests.get(requestId);
    if (!req) throw new Error('Request not found');
    req.status = 'REJECTED';
    req.reviewed_by = reviewerUserId;
    req.reviewed_at = new Date();
    return req;
  }

  async updateOrgMpesaShortcode(orgId, shortcode) {
    const org = this.orgs.get(orgId);
    if (org) org.mpesa_shortcode = shortcode;
    return org;
  }
}

describe('Phase 4: Organization Module & Employee Management', () => {
  let employeeRepo;
  let server;
  let adminToken;
  let controllerToken;
  let employeeToken;

  before(async () => {
    employeeRepo = new InMemoryEmployeeRepository();
    server = await buildServer({
      logger: false,
      employeeRepo,
    });

    adminToken = signAccessToken({
      sub: 'admin-1',
      role: 'ORG_ADMIN',
      orgId: 'org-acme-1',
    });

    controllerToken = signAccessToken({
      sub: 'controller-1',
      role: 'ORG_CONTROLLER',
      orgId: 'org-acme-1',
    });

    employeeToken = signAccessToken({
      sub: 'emp-user-1',
      role: 'EMPLOYEE',
      orgId: 'org-acme-1',
    });
  });

  after(async () => {
    await server.close();
  });

  describe('4.1 Employee Domain Entity Logic', () => {
    test('Calculates spent credit and utilization percentage accurately', () => {
      const emp = new Employee({
        credit_limit: 5000,
        available_credit: 3500,
      });

      assert.equal(emp.spentCredit, 1500);
      assert.equal(emp.creditUtilizationPct, 30);
      assert.equal(emp.canSpend(1000), true);
      assert.equal(emp.canSpend(4000), false);
    });

    test('Prevents reducing credit limit below spent amount', () => {
      const emp = new Employee({
        credit_limit: 10000,
        available_credit: 6000, // spent = 4000
      });

      const allowedCheck = emp.canUpdateCreditLimit(5000);
      assert.equal(allowedCheck.allowed, true);

      const rejectedCheck = emp.canUpdateCreditLimit(3000);
      assert.equal(rejectedCheck.allowed, false);
      assert.ok(rejectedCheck.reason.includes('cannot be lower than already spent'));
    });
  });

  describe('4.2 CreateEmployeeUseCase Unit Behavior', () => {
    test('Generates FP-ID and 16-character password and stores records', async () => {
      const useCase = new CreateEmployeeUseCase({ employeeRepository: employeeRepo });
      const result = await useCase.execute({
        organizationId: 'org-acme-1',
        fullName: 'Kidus Yohannes',
        phoneNumber: '251977112233',
        department: 'Engineering',
      });

      assert.ok(result.fpEmployeeId.startsWith('FP-ETH-'));
      assert.equal(result.plainPassword.length, 16);
      assert.equal(result.employee.credit_limit, 3500, 'Inherited global policy limit');
    });

    test('Rejects creating employee with duplicate phone in same organization', async () => {
      const useCase = new CreateEmployeeUseCase({ employeeRepository: employeeRepo });
      await assert.rejects(
        async () => {
          await useCase.execute({
            organizationId: 'org-acme-1',
            fullName: 'Duplicate Person',
            phoneNumber: '251977112233',
          });
        },
        (err) => err.statusCode === 409
      );
    });
  });

  describe('4.3 Organization Routes & Permissions', () => {
    let createdFpId;

    test('ORG_ADMIN adds employee via POST /api/v1/org/employees', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/v1/org/employees',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          fullName: 'Hiwot Bekele',
          phoneNumber: '0911887766',
          department: 'Product',
          creditLimitOverride: 7500,
          sendSms: false,
        },
      });

      assert.equal(res.statusCode, 201);
      const body = JSON.parse(res.payload);
      assert.ok(body.fpEmployeeId);
      assert.equal(body.plainPassword.length, 16);
      assert.equal(body.employee.creditLimit, 7500);
      createdFpId = body.fpEmployeeId;
    });

    test('EMPLOYEE is forbidden from calling org endpoints (403)', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/api/v1/org/employees',
        headers: { authorization: `Bearer ${employeeToken}` },
      });
      assert.equal(res.statusCode, 403);
    });

    test('ORG_CONTROLLER can list employees', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/api/v1/org/employees',
        headers: { authorization: `Bearer ${controllerToken}` },
      });

      assert.equal(res.statusCode, 200);
      const body = JSON.parse(res.payload);
      assert.ok(Array.isArray(body.employees));
      assert.ok(body.employees.length >= 2);
    });

    test('ORG_ADMIN fetches employee details by fpId', async () => {
      const res = await server.inject({
        method: 'GET',
        url: `/api/v1/org/employees/${createdFpId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      assert.equal(res.statusCode, 200);
      const body = JSON.parse(res.payload);
      assert.equal(body.employee.fpEmployeeId, createdFpId);
      assert.equal(body.employee.creditLimit, 7500);
    });

    test('ORG_ADMIN updates credit limit for employee', async () => {
      const res = await server.inject({
        method: 'PATCH',
        url: `/api/v1/org/employees/${createdFpId}/credit`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { creditLimit: 12000 },
      });

      assert.equal(res.statusCode, 200);
      const body = JSON.parse(res.payload);
      assert.equal(body.creditLimit, 12000);
      assert.equal(body.availableCredit, 12000);
    });
  });

  describe('4.4 Password Reset Request Approval Flow', () => {
    let requestId;

    before(async () => {
      // Create a pending password reset request
      const emp = Array.from(employeeRepo.employees.values())[0];
      const reqId = `rst-${Date.now()}`;
      employeeRepo.resetRequests.set(reqId, {
        id: reqId,
        employee_id: emp.id,
        delivery_method: 'SMS',
        status: 'PENDING',
        requested_at: new Date(),
      });
      requestId = reqId;
    });

    test('ORG_CONTROLLER can view pending reset requests', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/api/v1/org/password-reset-requests',
        headers: { authorization: `Bearer ${controllerToken}` },
      });

      assert.equal(res.statusCode, 200);
      const body = JSON.parse(res.payload);
      assert.ok(body.requests.length >= 1);
    });

    test('ORG_ADMIN approves password reset, receives new 16-character password', async () => {
      const res = await server.inject({
        method: 'PATCH',
        url: `/api/v1/org/password-reset-requests/${requestId}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { action: 'APPROVE' },
      });

      assert.equal(res.statusCode, 200);
      const body = JSON.parse(res.payload);
      assert.equal(body.approved, true);
      assert.equal(body.newPassword.length, 16);

      // Verify the request is no longer pending
      const checkRes = await server.inject({
        method: 'GET',
        url: '/api/v1/org/password-reset-requests',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const checkBody = JSON.parse(checkRes.payload);
      assert.equal(checkBody.requests.filter((r) => r.requestId === requestId).length, 0);
    });
  });

  describe('4.5 Organization Credit Policy & M-PESA Shortcode', () => {
    test('GET and PATCH /api/v1/org/credit-policy', async () => {
      const getRes = await server.inject({
        method: 'GET',
        url: '/api/v1/org/credit-policy',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      assert.equal(getRes.statusCode, 200);

      const patchRes = await server.inject({
        method: 'PATCH',
        url: '/api/v1/org/credit-policy',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          globalLimit: 5000,
          allowedCategories: ['FOOD', 'TRANSPORT', 'HEALTH', 'GROCERY'],
        },
      });
      assert.equal(patchRes.statusCode, 200);
      const body = JSON.parse(patchRes.payload);
      assert.equal(body.policy.global_credit_limit, 5000);
    });

    test('POST /api/v1/org/mpesa-config saves M-PESA shortcode', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/v1/org/mpesa-config',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { mpesaShortcode: '200599' },
      });

      assert.equal(res.statusCode, 200);
      const body = JSON.parse(res.payload);
      assert.equal(body.mpesaShortcode, '200599');
    });
  });
});
