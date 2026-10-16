const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { buildServer } = require('../../src/server/index');
const { signAccessToken } = require('../../src/server/shared/crypto/jwt');

class InMemoryPayrollRepository {
  constructor() {
    this.settlements = new Map();
    this.lines = new Map();
    this.employees = null; // Injected from test harness
  }

  async createSettlement(data) {
    const id = `stl-${Date.now()}`;
    const record = {
      id,
      status: 'RUNNING',
      organization_id: data.organizationId || data.organization_id,
      ...data,
      created_at: new Date(),
    };
    this.settlements.set(id, record);
    return record;
  }

  async createDisbursementLines(lines) {
    const created = [];
    for (const l of lines) {
      const id = `line-${Math.random().toString(36).substring(2, 7)}`;
      const rec = { id, ...l };
      this.lines.set(id, rec);
      created.push(rec);
    }
    return created;
  }

  async findSettlementById(id) {
    return this.settlements.get(id) || null;
  }

  async listSettlementsByOrg(orgId) {
    return Array.from(this.settlements.values()).filter(
      (s) => s.organization_id === orgId || s.organizationId === orgId
    );
  }

  async findLineByConversationId(convId) {
    for (const l of this.lines.values()) {
      if (l.mpesa_conversation_id === convId) return l;
    }
    return null;
  }

  async markLineCompleted(lineId, receipt) {
    const l = this.lines.get(lineId);
    if (l) {
      l.status = 'COMPLETED';
      l.mpesa_receipt = receipt;
    }
    return l;
  }

  async markLineFailed(lineId) {
    const l = this.lines.get(lineId);
    if (l) l.status = 'FAILED';
    return l;
  }

  async checkAllLinesComplete(settlementId) {
    const settlementLines = Array.from(this.lines.values()).filter(
      (l) => (l.settlement_id || l.settlementId) === settlementId
    );
    if (settlementLines.length === 0) return false;
    return settlementLines.every((l) => l.status === 'COMPLETED');
  }

  async markSettlementCompleted(settlementId) {
    const s = this.settlements.get(settlementId);
    if (s) {
      s.status = 'COMPLETED';
      s.completed_at = new Date();
    }
    return s;
  }

  async resetCreditForSettlement(settlementId) {
    const s = this.settlements.get(settlementId);
    if (!s) return;
    const orgId = s.organization_id || s.organizationId;
    for (const emp of this.employees.values()) {
      if (emp.organization_id === orgId) {
        emp.available_credit = emp.credit_limit;
      }
    }
  }
}

describe('Phase 7: Automated Payroll Settlement & M-PESA B2C Wires', () => {
  let server;
  let payrollRepo;
  let employeesMap;
  let orgAdminToken;

  before(async () => {
    employeesMap = new Map([
      [
        'emp-1',
        {
          id: 'emp-1',
          organization_id: 'org-cbe-1',
          full_name: 'Solomon Tesfaye',
          phone_number: '251911334455',
          credit_limit: 10000,
          available_credit: 7000, // spent 3000
        },
      ],
      [
        'emp-2',
        {
          id: 'emp-2',
          organization_id: 'org-cbe-1',
          full_name: 'Bethlehem Girma',
          phone_number: '251922445566',
          credit_limit: 8000,
          available_credit: 6500, // spent 1500
        },
      ],
    ]);

    const transactions = [
      {
        id: 't-1',
        employee_id: 'emp-1',
        merchant_id: 'mch-grocery-1',
        organization_id: 'org-cbe-1',
        merchant_name_snapshot: 'Friendship Supermarket',
        merchant_mpesa_snapshot: '251944556677',
        credit_portion: 3000,
        status: 'COMPLETED',
      },
      {
        id: 't-2',
        employee_id: 'emp-2',
        merchant_id: 'mch-grocery-1',
        organization_id: 'org-cbe-1',
        merchant_name_snapshot: 'Friendship Supermarket',
        merchant_mpesa_snapshot: '251944556677',
        credit_portion: 1500,
        status: 'COMPLETED',
      },
    ];

    payrollRepo = new InMemoryPayrollRepository();
    payrollRepo.employees = employeesMap;

    const mockEmployeeRepo = {
      findById: async (id) => employeesMap.get(id) || null,
    };

    const mockTxnRepo = {
      listRecentByOrg: async (orgId) => transactions.filter((t) => t.organization_id === orgId),
    };

    const mockMpesaB2C = {
      sendB2C: async ({ commandId, amount, recipientPhone }) => ({
        success: true,
        conversationId: `CONV_${commandId}_${recipientPhone}`,
      }),
    };

    server = await buildServer({
      logger: false,
      payrollRepo,
      employeeRepo: mockEmployeeRepo,
      transactionRepo: mockTxnRepo,
      mpesaB2CService: mockMpesaB2C,
    });

    orgAdminToken = signAccessToken({
      sub: 'usr-admin-cbe',
      role: 'ORG_ADMIN',
      orgId: 'org-cbe-1',
    });
  });

  after(async () => {
    await server.close();
  });

  test('7.1 ORG_ADMIN runs automated payroll settlement via POST /api/v1/org/payroll/run', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/v1/org/payroll/run',
      headers: { authorization: `Bearer ${orgAdminToken}` },
      payload: {
        periodStart: '2026-10-01',
        periodEnd: '2026-10-31',
        employeeSalaries: [
          { employeeId: 'emp-1', grossSalary: 25000 }, // net = 25000 - 3000 = 22000
          { employeeId: 'emp-2', grossSalary: 18000 }, // net = 18000 - 1500 = 16500
        ],
      },
    });

    assert.equal(res.statusCode, 201);
    const body = JSON.parse(res.payload);
    assert.ok(body.settlementId);
    assert.equal(body.totalMerchantDisbursements, 4500); // 3000 + 1500 to Friendship Supermarket
    assert.equal(body.totalEmployeeDisbursements, 38500); // 22000 + 16500 net salaries
    assert.equal(body.merchantsCount, 1);
    assert.equal(body.employeesCount, 2);

    // Verify disbursement lines created
    const lines = Array.from(payrollRepo.lines.values());
    assert.equal(lines.length, 3); // 1 merchant wire + 2 employee wires

    const merchantLine = lines.find((l) => l.recipient_type === 'MERCHANT');
    assert.equal(merchantLine.amount, 4500);
    assert.equal(merchantLine.recipient_mpesa_number, '251944556677');
    assert.equal(merchantLine.mpesa_conversation_id, 'CONV_BusinessPayment_251944556677');

    const emp1Line = lines.find((l) => l.employee_id === 'emp-1');
    assert.equal(emp1Line.amount, 22000);
  });

  test('7.2 M-PESA B2C Callback completes lines and triggers automated credit reset', async () => {
    const lines = Array.from(payrollRepo.lines.values());
    assert.equal(lines.length, 3);

    // Verify employees currently have reduced available credit
    assert.equal(employeesMap.get('emp-1').available_credit, 7000);
    assert.equal(employeesMap.get('emp-2').available_credit, 6500);

    // Simulate callback for all 3 lines
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const res = await server.inject({
        method: 'POST',
        url: '/api/v1/webhooks/mpesa/b2c-result',
        payload: {
          Result: {
            ConversationID: line.mpesa_conversation_id,
            ResultCode: 0,
            ResultDesc: 'The service request is processed successfully.',
            ResultParameters: {
              ResultParameter: [
                { Key: 'TransactionReceipt', Value: `B2C_RCP_${i + 1}` },
                { Key: 'TransactionAmount', Value: line.amount },
              ],
            },
          },
        },
      });
      assert.equal(res.statusCode, 200);
    }

    // Verify all lines are now COMPLETED
    for (const line of payrollRepo.lines.values()) {
      assert.equal(line.status, 'COMPLETED');
    }

    // Verify master settlement status is now COMPLETED
    const settlement = Array.from(payrollRepo.settlements.values())[0];
    assert.equal(settlement.status, 'COMPLETED');
    assert.ok(settlement.completed_at);

    // CRITICAL INVARIANT: Verify employee available credit accounts have been RESET to their maximum limit!
    assert.equal(employeesMap.get('emp-1').available_credit, 10000);
    assert.equal(employeesMap.get('emp-2').available_credit, 8000);
  });

  test('7.3 GET /api/v1/org/payroll/history returns settlement run history', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/v1/org/payroll/history',
      headers: { authorization: `Bearer ${orgAdminToken}` },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.settlements.length, 1);
    assert.equal(body.settlements[0].status, 'COMPLETED');
  });
});
