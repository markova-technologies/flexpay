const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { buildServer } = require('../../src/server/index');
const { SplitEngine } = require('../../src/server/modules/transactions/domain/SplitEngine');
const { LedgerEngine } = require('../../src/server/modules/transactions/domain/LedgerEngine');
const { generateEmployeeId } = require('../../src/server/shared/crypto/employeeIdGenerator');
const { signAccessToken } = require('../../src/server/shared/crypto/jwt');

class InMemoryTransactionRepository {
  constructor() {
    this.transactions = new Map();
    this.journalEntries = [];
    this.employees = null; // Bound from test harness
  }

  async createTransactionWithEntries(data, entries) {
    const emp = this.employees.get(data.employee_id);
    if (!emp) throw new Error('Employee not found');

    const creditPortion = Number(data.credit_portion || 0);
    if (creditPortion > 0) {
      if (emp.available_credit < creditPortion) {
        const err = new Error('Insufficient credit');
        err.statusCode = 400;
        throw err;
      }
      emp.available_credit = Number((emp.available_credit - creditPortion).toFixed(2));
    }

    const id = `txn-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const record = { id, ...data };
    this.transactions.set(id, record);

    for (const entry of entries) {
      this.journalEntries.push({ ...entry, transaction_id: id });
    }

    return record;
  }

  async updateStatus(txnId, status, mpesaReceipt = null) {
    const txn = this.transactions.get(txnId);
    if (txn) {
      txn.status = status;
      if (mpesaReceipt) txn.mpesa_receipt = mpesaReceipt;
    }
    return txn;
  }

  async reverseCreditReservation(txnId) {
    const txn = this.transactions.get(txnId);
    if (!txn) throw new Error('Txn not found');

    const credit = Number(txn.credit_portion || 0);
    if (credit > 0) {
      const emp = this.employees.get(txn.employee_id);
      if (emp) {
        emp.available_credit = Number((emp.available_credit + credit).toFixed(2));
      }
    }
    txn.status = 'FAILED';
    return txn;
  }

  async findByStkCheckoutRequestId(reqId) {
    for (const t of this.transactions.values()) {
      if (t.stk_checkout_request_id === reqId) return t;
    }
    return null;
  }

  async findById(txnId) {
    return this.transactions.get(txnId) || null;
  }

  async listRecentByMerchant(merchantId, limit = 20) {
    return Array.from(this.transactions.values())
      .filter((t) => t.merchant_id === merchantId)
      .slice(0, limit);
  }
}

describe('Phase 5: Merchant Module & Transaction Flow', () => {
  describe('5.1 SplitEngine Domain Calculation', () => {
    test('Calculates 100% credit coverage when amount <= available credit', () => {
      const split = SplitEngine.calculate(500, 1000);
      assert.equal(split.totalAmount, 500);
      assert.equal(split.creditPortion, 500);
      assert.equal(split.copayPortion, 0);
      assert.equal(split.requiresStkPush, false);
    });

    test('Calculates split with co-pay when amount > available credit', () => {
      const split = SplitEngine.calculate(1500, 1000);
      assert.equal(split.totalAmount, 1500);
      assert.equal(split.creditPortion, 1000);
      assert.equal(split.copayPortion, 500);
      assert.equal(split.requiresStkPush, true);
    });

    test('Calculates 100% co-pay when available credit is zero', () => {
      const split = SplitEngine.calculate(750, 0);
      assert.equal(split.totalAmount, 750);
      assert.equal(split.creditPortion, 0);
      assert.equal(split.copayPortion, 750);
      assert.equal(split.requiresStkPush, true);
    });

    test('Throws error for invalid or negative amounts', () => {
      assert.throws(() => SplitEngine.calculate(-100, 500));
      assert.throws(() => SplitEngine.calculate(0, 500));
    });
  });

  describe('5.2 LedgerEngine Double-Entry Accounting Invariant', () => {
    test('Generates balanced entries where debits === credits', () => {
      const entries = LedgerEngine.generateCreditEntries('TXN-101', 850, '251911223344', 'FP-ETH-2026-X');
      assert.equal(entries.length, 2);

      const debits = entries.reduce((s, e) => s + e.debit_amount, 0);
      const credits = entries.reduce((s, e) => s + e.credit_amount, 0);
      assert.equal(debits, 850);
      assert.equal(credits, 850);
      assert.equal(LedgerEngine.verifyBalance(entries), true);
    });

    test('Throws error if journal entries violate balance equation', () => {
      const badEntries = [
        { debit_amount: 500, credit_amount: 0 },
        { debit_amount: 0, credit_amount: 450 }, // 50 ETB imbalance!
      ];
      assert.throws(() => LedgerEngine.verifyBalance(badEntries));
    });
  });

  describe('5.3 End-to-End Purchase Flow & Webhook Credit Reversal', () => {
    let server;
    let txnRepo;
    let employeesMap;
    let merchantsMap;
    let merchantToken;
    let fpEmployeeId;
    let employeeId;

    before(async () => {
      fpEmployeeId = generateEmployeeId('ETH');
      employeeId = 'emp-almaz-1';

      employeesMap = new Map([
        [
          employeeId,
          {
            id: employeeId,
            fp_employee_id: fpEmployeeId,
            organization_id: 'org-telecom-1',
            full_name: 'Almaz Tadesse',
            phone_number: '251911223344',
            credit_limit: 4000,
            available_credit: 2500,
            status: 'ACTIVE',
          },
        ],
      ]);

      merchantsMap = new Map([
        [
          'mch-restaurant-1',
          {
            id: 'mch-restaurant-1',
            business_name: 'Lucy Traditional Restaurant',
            mpesa_number: '251988776655',
            category: 'FOOD',
            status: 'ACTIVE',
          },
        ],
        [
          'mch-fuel-1',
          {
            id: 'mch-fuel-1',
            business_name: 'Total Fuel Station',
            mpesa_number: '251933445566',
            category: 'FUEL',
            status: 'ACTIVE',
          },
        ],
      ]);

      txnRepo = new InMemoryTransactionRepository();
      txnRepo.employees = employeesMap;

      const mockEmployeeRepo = {
        findByFpId: async (id) => {
          for (const emp of employeesMap.values()) {
            if (emp.fp_employee_id === id) return emp;
          }
          return null;
        },
        getOrgCreditPolicy: async () => ({
          allowed_categories: ['FOOD', 'TRANSPORT'], // FUEL is NOT allowed
        }),
      };

      const mockMerchantRepo = {
        findById: async (id) => merchantsMap.get(id) || null,
        getReceivablesSummary: async () => ({
          totalOutstandingReceivables: 1500,
          uniqueOrganizations: 1,
          uniqueEmployees: 1,
          totalTransactions: 2,
          receivablesByOrg: [],
        }),
      };

      const mockMpesaStk = {
        initiateStkPush: async () => ({
          checkoutRequestId: 'ws_CO_TEST_998877',
        }),
      };

      server = await buildServer({
        logger: false,
        transactionRepo: txnRepo,
        employeeRepo: mockEmployeeRepo,
        merchantRepo: mockMerchantRepo,
        mpesaStkService: mockMpesaStk,
      });

      merchantToken = signAccessToken({
        sub: 'usr-mch-1',
        role: 'MERCHANT_OWNER',
        merchantId: 'mch-restaurant-1',
      });
    });

    after(async () => {
      await server.close();
    });

    test('Merchant verifies employee at POS: category approved', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/v1/merchant/verify-employee',
        headers: { authorization: `Bearer ${merchantToken}` },
        payload: { fpEmployeeId },
      });

      assert.equal(res.statusCode, 200);
      const body = JSON.parse(res.payload);
      assert.equal(body.eligible, true);
      assert.equal(body.employee.fullName, 'Almaz Tadesse');
      assert.equal(body.employee.availableCredit, 2500);
    });

    test('Merchant checks out with 100% credit (amount <= available)', async () => {
      const initialCredit = employeesMap.get(employeeId).available_credit;

      const res = await server.inject({
        method: 'POST',
        url: '/api/v1/merchant/transaction',
        headers: { authorization: `Bearer ${merchantToken}` },
        payload: {
          fpEmployeeId,
          totalAmount: 1000,
        },
      });

      assert.equal(res.statusCode, 201);
      const body = JSON.parse(res.payload);
      assert.equal(body.creditPortion, 1000);
      assert.equal(body.copayPortion, 0);
      assert.equal(body.requiresStkPush, false);
      assert.equal(body.status, 'COMPLETED');

      // Verify available credit was deducted
      const updatedCredit = employeesMap.get(employeeId).available_credit;
      assert.equal(updatedCredit, initialCredit - 1000);
    });

    test('Merchant checks out with Split (amount > available credit) -> STK push initiated', async () => {
      const available = employeesMap.get(employeeId).available_credit; // 1500 remaining

      const res = await server.inject({
        method: 'POST',
        url: '/api/v1/merchant/transaction',
        headers: { authorization: `Bearer ${merchantToken}` },
        payload: {
          fpEmployeeId,
          totalAmount: 2000, // 1500 credit + 500 co-pay
        },
      });

      assert.equal(res.statusCode, 201);
      const body = JSON.parse(res.payload);
      assert.equal(body.creditPortion, 1500);
      assert.equal(body.copayPortion, 500);
      assert.equal(body.requiresStkPush, true);
      assert.equal(body.stkPushInitiated, true);
      assert.equal(body.status, 'STK_SENT');

      // Store checkout request ID on transaction
      txnRepo.transactions.get(body.transaction.id).stk_checkout_request_id = 'ws_CO_TEST_998877';
    });

    test('M-PESA Webhook reverses credit deduction on failed/cancelled STK push', async () => {
      const creditBefore = employeesMap.get(employeeId).available_credit; // 0 remaining

      // Simulate customer cancelled USSD prompt callback from Safaricom
      const res = await server.inject({
        method: 'POST',
        url: '/api/v1/webhooks/mpesa/stk',
        payload: {
          Body: {
            stkCallback: {
              MerchantRequestID: 'req-1',
              CheckoutRequestID: 'ws_CO_TEST_998877',
              ResultCode: 1032, // User cancelled prompt
              ResultDesc: 'Request cancelled by user',
            },
          },
        },
      });

      assert.equal(res.statusCode, 200);

      // Verify the 1500 ETB reserved credit was restored back to the employee!
      const creditAfter = employeesMap.get(employeeId).available_credit;
      assert.equal(creditAfter, creditBefore + 1500);

      const txn = await txnRepo.findByStkCheckoutRequestId('ws_CO_TEST_998877');
      assert.equal(txn.status, 'FAILED');
    });

    test('M-PESA Webhook confirms completed transaction on ResultCode 0', async () => {
      // Create another split txn
      const resTxn = await server.inject({
        method: 'POST',
        url: '/api/v1/merchant/transaction',
        headers: { authorization: `Bearer ${merchantToken}` },
        payload: { fpEmployeeId, totalAmount: 800 },
      });
      const body = JSON.parse(resTxn.payload);
      const txnRecord = txnRepo.transactions.get(body.transaction.id);
      txnRecord.stk_checkout_request_id = 'ws_CO_SUCCESS_001';

      // Safaricom callback success
      const resWebhook = await server.inject({
        method: 'POST',
        url: '/api/v1/webhooks/mpesa/stk',
        payload: {
          Body: {
            stkCallback: {
              CheckoutRequestID: 'ws_CO_SUCCESS_001',
              ResultCode: 0,
              ResultDesc: 'The service was accepted successfully',
              CallbackMetadata: {
                Item: [
                  { Name: 'MpesaReceiptNumber', Value: 'SBX987654321' },
                  { Name: 'Amount', Value: 800 },
                ],
              },
            },
          },
        },
      });

      assert.equal(resWebhook.statusCode, 200);
      assert.equal(txnRecord.status, 'COMPLETED');
      assert.equal(txnRecord.mpesa_receipt, 'SBX987654321');
    });
  });
});
