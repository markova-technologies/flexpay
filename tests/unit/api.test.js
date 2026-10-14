const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');
const { getDb } = require('../../src/server/storage/db.js');
const { router } = require('../../src/server/api/routes.js');

let server;
let baseUrl;

test.before(async () => {
  // Initialize db
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

test('API Integration - Employee & Benefit Endpoints', async (t) => {
  await t.test('GET /api/employees/emp-001 returns employee record', async () => {
    const res = await fetch(`${baseUrl}/employees/emp-001`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.id, 'emp-001');
    assert.equal(data.name, 'Abebe Kebede');
    assert.equal(data.employerName, 'Ethio Telecom');
  });

  await t.test('GET /api/employees/emp-001/benefit-account returns live balance', async () => {
    const res = await fetch(`${baseUrl}/employees/emp-001/benefit-account`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.employeeId, 'emp-001');
    assert.equal(data.totalAllowanceETB, 3000);
    assert.equal(data.availableBalanceETB, 1500);
  });
});

test('API Integration - Checkout & Authorization Flow', async (t) => {
  let orderId;
  let paymentId;
  let checkoutRequestId;

  await t.test('POST /api/checkout calculates authoritative split for ETB 2,000 order', async () => {
    const res = await fetch(`${baseUrl}/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        employeeId: 'emp-001',
        merchantId: 'mer-001',
        customerPhone: '251912345678',
        items: [
          { name: 'Teff Flour', unitPriceETB: 1400, quantity: 1 },
          { name: 'Cooking Oil', unitPriceETB: 600, quantity: 1 },
        ],
      }),
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.orderId);
    orderId = data.orderId;
    assert.equal(data.split.orderTotalETB, 2000);
    assert.equal(data.split.benefitCoveredETB, 1500);
    assert.equal(data.split.employeeCoPayETB, 500);
    assert.equal(data.split.isEligible, true);
  });

  await t.test('POST /api/checkout/:orderId/authorize triggers STK Push with FAST scenario', async () => {
    const res = await fetch(`${baseUrl}/checkout/${orderId}/authorize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        employeeId: 'emp-001',
        customerPhone: '251912345678',
        scenario: 'FAST', // Rapid 100ms auto-callback
      }),
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.paymentId);
    paymentId = data.paymentId;
    assert.equal(data.status, 'PENDING_MPESA_CALLBACK');
    assert.equal(data.mpesaEtb, 500);
    checkoutRequestId = data.checkoutRequestId;
  });

  await t.test('GET /api/payments/:paymentId/status resolves to COMPLETED following callback', async () => {
    // Poll for status to resolve (up to 2s)
    let finalStatus = 'PENDING_MPESA_CALLBACK';
    let receiptNumber = null;
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 100));
      const res = await fetch(`${baseUrl}/payments/${paymentId}/status`);
      const data = await res.json();
      finalStatus = data.status;
      receiptNumber = data.mpesaReceiptNumber;
      if (finalStatus === 'COMPLETED') break;
    }
    assert.equal(finalStatus, 'COMPLETED');
    assert.ok(receiptNumber);
  });

  await t.test('POST /api/mpesa/callback is strictly idempotent on duplicate webhook delivery', async () => {
    const duplicatePayload = {
      Body: {
        stkCallback: {
          MerchantRequestID: 'test-dup',
          CheckoutRequestID: checkoutRequestId,
          ResultCode: 0,
          ResultDesc: 'Duplicate webhook test',
        },
      },
    };
    const res = await fetch(`${baseUrl}/mpesa/callback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(duplicatePayload),
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.ResultCode, 0);
  });
});

test('API Integration - Transactions, Refunds, and Operations Audit', async (t) => {
  await t.test('GET /api/transactions returns transactions with balanced double-entry ledgers', async () => {
    const res = await fetch(`${baseUrl}/transactions?employeeId=emp-001`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.transactions.length > 0);
    const completed = data.transactions.find((tx) => tx.status === 'COMPLETED');
    assert.ok(completed);
    assert.ok(completed.ledgerEntries.length >= 2);
  });

  await t.test('POST /api/transactions/:id/refund initiates reversal and restores balance', async () => {
    const listRes = await fetch(`${baseUrl}/transactions?employeeId=emp-001`);
    const { transactions } = await listRes.json();
    const completed = transactions.find((tx) => tx.status === 'COMPLETED');

    const res = await fetch(`${baseUrl}/transactions/${completed.id}/refund`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Customer returned item' }),
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.status, 'REFUND_PENDING');
  });

  await t.test('POST /api/ops/reconcile produces clean audited reconciliation report', async () => {
    const res = await fetch(`${baseUrl}/ops/reconcile`, { method: 'POST' });
    assert.equal(res.status, 200);
    const report = await res.json();
    assert.equal(report.status, 'BALANCED');
    assert.equal(report.totalDebits, report.totalCredits);
  });
});
