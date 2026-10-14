const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { getDb } = require('../../src/server/storage/db.js');
const { router } = require('../../src/server/api/routes.js');

let server;
let baseUrl;

test.before(async () => {
  getDb();
  const app = express();
  app.use(express.json());
  app.use('/api', router);

  await new Promise((resolve) => {
    server = app.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}/api`;
      resolve();
    });
  });
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

test('Auth API - Login & Session Lifecycle', async (t) => {
  let employeeToken;

  await t.test('POST /api/auth/login succeeds for Abebe Kebede (1234)', async () => {
    const res = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'abebe@ethiotelecom.et', pin: '1234' }),
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.token);
    assert.equal(data.user.role, 'EMPLOYEE');
    assert.equal(data.user.name, 'Abebe Kebede');
    assert.equal(data.user.entityId, 'emp-001');
    employeeToken = data.token;
  });

  await t.test('POST /api/auth/login rejects incorrect PIN', async () => {
    const res = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'abebe@ethiotelecom.et', pin: '9999' }),
    });

    assert.equal(res.status, 401);
    const data = await res.json();
    assert.equal(data.error.code, 'AUTH_FAILED');
  });

  await t.test('GET /api/auth/me verifies Bearer token identity', async () => {
    const res = await fetch(`${baseUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${employeeToken}` },
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.user.email, 'abebe@ethiotelecom.et');
    assert.equal(data.user.role, 'EMPLOYEE');
  });

  await t.test('GET /api/auth/demo-users returns all demo personas with demoPin', async () => {
    const res = await fetch(`${baseUrl}/auth/demo-users`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data.users));
    assert.ok(data.users.length >= 7);
  });
});

test('Employee Category Wallets API', async (t) => {
  await t.test('GET /api/employees/emp-001/benefit-wallets returns category breakdown', async () => {
    const res = await fetch(`${baseUrl}/employees/emp-001/benefit-wallets`);
    assert.equal(res.status, 200);
    const data = await res.json();

    assert.equal(data.employeeId, 'emp-001');
    assert.ok(Array.isArray(data.wallets));
    const food = data.wallets.find((w) => w.category === 'FOOD');
    assert.ok(food);
    assert.equal(food.monthlyLimitETB, 2000);
    assert.ok(food.availableETB > 0);

    assert.ok(data.payLater);
    assert.equal(data.payLater.limitETB, 2000);
  });
});

test('Employer Portal API', async (t) => {
  await t.test('GET /api/employer/org returns benefit pool overview', async () => {
    const res = await fetch(`${baseUrl}/employer/org?orgId=org-001`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.org.name, 'Ethio Telecom');
    assert.equal(data.org.benefitPoolETB, 500000);
  });

  await t.test('GET /api/employer/policies returns category policies', async () => {
    const res = await fetch(`${baseUrl}/employer/policies?orgId=org-001`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data.policies));
    assert.ok(data.policies.length >= 3);
  });

  await t.test('GET /api/employer/employees returns roster with categorized balances', async () => {
    const res = await fetch(`${baseUrl}/employer/employees?orgId=org-001`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data.employees));
    const abebe = data.employees.find((e) => e.id === 'emp-001');
    assert.ok(abebe);
    assert.ok(abebe.food);
    assert.ok(abebe.transport);
    assert.ok(abebe.health);
  });
});

test('Merchant POS API', async (t) => {
  await t.test('POST /api/merchants/terminal/verify-customer looks up customer phone', async () => {
    const res = await fetch(`${baseUrl}/merchants/terminal/verify-customer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerPhone: '251912345678',
        merchantId: 'mer-001',
      }),
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.customer.employeeId, 'emp-001');
    assert.equal(data.customer.name, 'Abebe Kebede');
    assert.equal(data.customer.eligibleCategory, 'FOOD');
    assert.ok(data.customer.availableBenefitETB > 0);
  });
});
