const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { buildServer } = require('../../src/server/index');
const { generateEmployeeId } = require('../../src/server/shared/crypto/employeeIdGenerator');
const { signAccessToken } = require('../../src/server/shared/crypto/jwt');

describe('Phase 6: Dashboard APIs (All Portals & QR Code Generation)', () => {
  let server;
  let employeeToken;
  let orgAdminToken;
  let merchantToken;
  let fpEmployeeId;

  before(async () => {
    fpEmployeeId = generateEmployeeId('ETH');

    const employeesMap = new Map([
      [
        'emp-dawit-1',
        {
          id: 'emp-dawit-1',
          fp_employee_id: fpEmployeeId,
          organization_id: 'org-saf-1',
          organization_name: 'Safaricom Ethiopia PLC',
          full_name: 'Dawit Abebe',
          phone_number: '251711223344',
          credit_limit: 8000,
          available_credit: 5200,
          status: 'ACTIVE',
        },
      ],
      [
        'emp-selam-2',
        {
          id: 'emp-selam-2',
          fp_employee_id: generateEmployeeId('ETH'),
          organization_id: 'org-saf-1',
          organization_name: 'Safaricom Ethiopia PLC',
          full_name: 'Selam Haile',
          phone_number: '251722334455',
          credit_limit: 6000,
          available_credit: 6000,
          status: 'ACTIVE',
        },
      ],
    ]);

    const transactions = [
      {
        id: 'txn-1',
        fp_transaction_ref: 'FP-TXN-1001',
        employee_id: 'emp-dawit-1',
        merchant_id: 'mch-cafe-1',
        organization_id: 'org-saf-1',
        employee_fp_id_snapshot: fpEmployeeId,
        employee_name_snapshot: 'Dawit Abebe',
        employee_phone_snapshot: '251711223344',
        org_name_snapshot: 'Safaricom Ethiopia PLC',
        merchant_name_snapshot: 'Bunaye Coffee & Bakery',
        merchant_mpesa_snapshot: '251799887766',
        category_snapshot: 'FOOD',
        total_amount: 1800,
        credit_portion: 1800,
        copay_portion: 0,
        status: 'COMPLETED',
        created_at: new Date(),
      },
      {
        id: 'txn-2',
        fp_transaction_ref: 'FP-TXN-1002',
        employee_id: 'emp-dawit-1',
        merchant_id: 'mch-ride-1',
        organization_id: 'org-saf-1',
        employee_fp_id_snapshot: fpEmployeeId,
        employee_name_snapshot: 'Dawit Abebe',
        employee_phone_snapshot: '251711223344',
        org_name_snapshot: 'Safaricom Ethiopia PLC',
        merchant_name_snapshot: 'Addis Ride Taxi',
        merchant_mpesa_snapshot: '251788776655',
        category_snapshot: 'TRANSPORT',
        total_amount: 1000,
        credit_portion: 1000,
        copay_portion: 0,
        status: 'COMPLETED',
        created_at: new Date(),
      },
    ];

    const mockEmployeeRepo = {
      findById: async (id) => employeesMap.get(id) || null,
      findByFpId: async (id) => {
        for (const emp of employeesMap.values()) {
          if (emp.fp_employee_id === id) return emp;
        }
        return null;
      },
      findByOrgId: async (orgId) => Array.from(employeesMap.values()).filter((e) => e.organization_id === orgId),
      listPasswordResetRequests: async () => [{ requestId: 'rst-1', status: 'PENDING' }],
    };

    const mockTxnRepo = {
      listRecentByEmployee: async (empId) => transactions.filter((t) => t.employee_id === empId),
      listRecentByOrg: async (orgId) => transactions.filter((t) => t.organization_id === orgId),
      listRecentByMerchant: async (mchId) => transactions.filter((t) => t.merchant_id === mchId),
    };

    const mockMerchantRepo = {
      findById: async () => ({
        id: 'mch-cafe-1',
        business_name: 'Bunaye Coffee & Bakery',
        mpesa_number: '251799887766',
        category: 'FOOD',
      }),
      getReceivablesSummary: async () => ({
        totalOutstandingReceivables: 1800,
        uniqueOrganizations: 1,
        uniqueEmployees: 1,
        totalTransactions: 1,
        receivablesByOrg: [
          {
            orgId: 'org-saf-1',
            orgName: 'Safaricom Ethiopia PLC',
            totalOwed: 1800,
            employeeCount: 1,
          },
        ],
      }),
    };

    const mockPayrollRepo = {
      listDisbursementLinesByMerchant: async (merchantId) => [
        {
          id: 'line-mch-101',
          settlementId: 'stl-saf-001',
          recipientType: 'MERCHANT',
          merchantId: 'mch-cafe-1',
          recipientMpesaNumber: '251799887766',
          amount: 1800,
          status: 'COMPLETED',
          mpesaReceipt: 'MP_B2C_K49X8A',
          completedAt: new Date().toISOString(),
          organizationName: 'Safaricom Ethiopia PLC',
          organizationShortcode: '251700',
        },
      ],
      findMerchantDisbursementReceipt: async (merchantId, lineId) => ({
        id: lineId,
        settlementId: 'stl-saf-001',
        recipientType: 'MERCHANT',
        merchantId: 'mch-cafe-1',
        recipientMpesaNumber: '251799887766',
        amount: 1800,
        status: 'COMPLETED',
        mpesaReceipt: 'MP_B2C_K49X8A',
        completedAt: new Date().toISOString(),
        periodStart: '2026-10-01',
        periodEnd: '2026-10-31',
        organization: {
          id: 'org-saf-1',
          name: 'Safaricom Ethiopia PLC',
          shortcode: '251700',
        },
        merchant: {
          id: 'mch-cafe-1',
          businessName: 'Bunaye Coffee & Bakery',
          category: 'FOOD',
          mpesaNumber: '251799887766',
        },
      }),
    };

    server = await buildServer({
      logger: false,
      employeeRepo: mockEmployeeRepo,
      transactionRepo: mockTxnRepo,
      merchantRepo: mockMerchantRepo,
      payrollRepo: mockPayrollRepo,
    });

    employeeToken = signAccessToken({
      sub: 'usr-dawit-1',
      role: 'EMPLOYEE',
      employeeId: 'emp-dawit-1',
      orgId: 'org-saf-1',
    });

    orgAdminToken = signAccessToken({
      sub: 'usr-admin-saf',
      role: 'ORG_ADMIN',
      orgId: 'org-saf-1',
      orgName: 'Safaricom Ethiopia PLC',
    });

    merchantToken = signAccessToken({
      sub: 'usr-mch-cafe',
      role: 'MERCHANT_OWNER',
      merchantId: 'mch-cafe-1',
    });
  });

  after(async () => {
    await server.close();
  });

  describe('6.1 Employee Dashboard & QR Code', () => {
    test('GET /api/v1/employee/dashboard returns exact statistics and spending aggregation', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/api/v1/employee/dashboard',
        headers: { authorization: `Bearer ${employeeToken}` },
      });

      assert.equal(res.statusCode, 200);
      const body = JSON.parse(res.payload);
      assert.equal(body.employee.fpEmployeeId, fpEmployeeId);
      assert.equal(body.employee.creditLimit, 8000);
      assert.equal(body.employee.availableCredit, 5200);
      assert.equal(body.employee.spentCredit, 2800);
      assert.equal(body.employee.utilizationPct, 35);

      assert.equal(body.recentTransactions.length, 2);
      assert.equal(body.spendingByCategory.length, 2);

      const foodCategory = body.spendingByCategory.find((c) => c.category === 'FOOD');
      assert.equal(foodCategory.total, 1800);

      const transportCategory = body.spendingByCategory.find((c) => c.category === 'TRANSPORT');
      assert.equal(transportCategory.total, 1000);
    });

    test('GET /api/v1/employee/qr-code returns valid base64 PNG data URL', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/api/v1/employee/qr-code',
        headers: { authorization: `Bearer ${employeeToken}` },
      });

      assert.equal(res.statusCode, 200);
      const body = JSON.parse(res.payload);
      assert.equal(body.fpEmployeeId, fpEmployeeId);
      assert.ok(body.qrDataUrl.startsWith('data:image/png;base64,'));
    });
  });

  describe('6.2 Organization Dashboard & Payroll Preview', () => {
    test('GET /api/v1/org/dashboard returns executive credit and pending stats', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/api/v1/org/dashboard',
        headers: { authorization: `Bearer ${orgAdminToken}` },
      });

      assert.equal(res.statusCode, 200);
      const body = JSON.parse(res.payload);
      assert.equal(body.stats.totalEmployees, 2);
      assert.equal(body.stats.totalCreditExtended, 14000); // 8000 + 6000
      assert.equal(body.stats.totalAvailableCredit, 11200); // 5200 + 6000
      assert.equal(body.stats.totalCreditUtilized, 2800);
      assert.equal(body.stats.pendingPasswordResets, 1);
      assert.ok(Array.isArray(body.topSpendingCategories));
    });

    test('GET /api/v1/org/payroll/preview groups disbursements per merchant and balances per employee', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/api/v1/org/payroll/preview',
        headers: { authorization: `Bearer ${orgAdminToken}` },
      });

      assert.equal(res.statusCode, 200);
      const body = JSON.parse(res.payload);
      assert.equal(body.totalMerchantDisbursements, 2800);
      assert.equal(body.merchantDisbursements.length, 2);

      const bunaye = body.merchantDisbursements.find((m) => m.merchantId === 'mch-cafe-1');
      assert.equal(bunaye.totalOwed, 1800);
      assert.equal(bunaye.merchantName, 'Bunaye Coffee & Bakery');

      const ride = body.merchantDisbursements.find((m) => m.merchantId === 'mch-ride-1');
      assert.equal(ride.totalOwed, 1000);

      assert.equal(body.employeeOutstandingBalances.length, 1);
      assert.equal(body.employeeOutstandingBalances[0].totalCreditUsed, 2800);
    });
  });

  describe('6.3 Merchant Dashboard', () => {
    test('GET /api/v1/merchant/dashboard returns receivables summary, breakdown, and recent settlements', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/api/v1/merchant/dashboard',
        headers: { authorization: `Bearer ${merchantToken}` },
      });

      assert.equal(res.statusCode, 200);
      const body = JSON.parse(res.payload);
      assert.equal(body.merchant.businessName, 'Bunaye Coffee & Bakery');
      assert.equal(body.stats.totalOutstandingReceivables, 1800);
      assert.equal(body.stats.uniqueOrganizations, 1);
      assert.equal(body.receivablesByOrg.length, 1);
      assert.equal(body.receivablesByOrg[0].totalOwed, 1800);
      assert.ok(Array.isArray(body.recentSettlements));
      assert.equal(body.recentSettlements.length, 1);
      assert.equal(body.recentSettlements[0].mpesaReceipt, 'MP_B2C_K49X8A');
    });

    test('GET /api/v1/merchant/settlements returns historical payroll settlement payouts', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/api/v1/merchant/settlements',
        headers: { authorization: `Bearer ${merchantToken}` },
      });

      assert.equal(res.statusCode, 200);
      const body = JSON.parse(res.payload);
      assert.ok(Array.isArray(body.settlements));
      assert.equal(body.settlements.length, 1);
      assert.equal(body.settlements[0].organizationName, 'Safaricom Ethiopia PLC');
      assert.equal(body.settlements[0].amount, 1800);
    });

    test('GET /api/v1/merchant/settlements/:lineId returns settlement receipt data', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/api/v1/merchant/settlements/line-mch-101',
        headers: { authorization: `Bearer ${merchantToken}` },
      });

      assert.equal(res.statusCode, 200);
      const body = JSON.parse(res.payload);
      assert.ok(body.settlement);
      assert.equal(body.settlement.mpesaReceipt, 'MP_B2C_K49X8A');
      assert.equal(body.settlement.organization.name, 'Safaricom Ethiopia PLC');
      assert.equal(body.settlement.merchant.businessName, 'Bunaye Coffee & Bakery');
    });

    test('GET /api/v1/merchant/settlements/:lineId/receipt streams official PDF settlement voucher', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/api/v1/merchant/settlements/line-mch-101/receipt',
        headers: { authorization: `Bearer ${merchantToken}` },
      });

      assert.equal(res.statusCode, 200);
      assert.equal(res.headers['content-type'], 'application/pdf');
      assert.ok(res.headers['content-disposition'].includes('flexpay-settlement-receipt-'));
      assert.ok(res.rawPayload.length > 500);
    });
  });
});
