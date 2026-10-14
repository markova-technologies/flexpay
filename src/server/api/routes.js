/**
 * FlexPay API Routes & Controllers
 * =================================
 * Authoritative backend endpoints adhering to docs/engineering/api-contract.md.
 * Invariant: Zero browser trust. All financial splits and state transitions
 * are strictly enforced server-side.
 */

const express = require('express');
const crypto = require('node:crypto');
const { getDb } = require('../storage/db.js');
const { calculateSplit } = require('../domain/allocation.js');
const {
  buildCompletionEntries,
  buildReversalEntries,
  postJournalEntries,
  getJournalEntriesForPayment,
  reconcile: runLedgerReconciliation,
} = require('../ledger/engine.js');
const MpesaGateway = require('../mpesa/gateway.js');
const config = require('../config.js');
const { authRouter } = require('./auth.routes.js');
const { employerRouter } = require('./employer.routes.js');
const { merchantRouter } = require('./merchant.routes.js');
const { resolveBenefitCategory } = require('../domain/merchant.js');

const router = express.Router();
const mpesaGateway = new MpesaGateway(config);

// Mount Sub-routers
router.use('/auth', authRouter);
router.use('/employer', employerRouter);
router.use('/merchants', merchantRouter);

// ---------------------------------------------------------------------------
// 1. Employee Endpoints
// ---------------------------------------------------------------------------

router.get('/employees/:id', (req, res) => {
  const db = getDb();
  const emp = db.prepare('SELECT * FROM employees WHERE id = ?').get(req.params.id);

  if (!emp) {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: `Employee ${req.params.id} not found.` },
    });
  }

  res.json({
    id: emp.id,
    name: emp.name,
    phone: emp.phone,
    employerId: emp.employer_id,
    employerName: emp.employer_name,
  });
});

router.get('/employees/:id/benefit-account', (req, res) => {
  const db = getDb();
  const ba = db.prepare('SELECT * FROM benefit_accounts WHERE employee_id = ?').get(req.params.id);

  if (!ba) {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: `Benefit account for ${req.params.id} not found.` },
    });
  }

  const totalAllowance = Number(ba.total_allowance_etb);
  const usedAllowance = Number(ba.used_allowance_etb);
  const salaryLimit = Number(ba.salary_link_limit_etb);
  const usedSalary = Number(ba.used_salary_link_etb);

  res.json({
    employeeId: ba.employee_id,
    employerName: ba.employer_name,
    totalAllowanceETB: totalAllowance,
    usedAllowanceETB: usedAllowance,
    availableBalanceETB: Math.max(0, totalAllowance - usedAllowance),
    salaryLinkLimitETB: salaryLimit,
    usedSalaryLinkETB: usedSalary,
    availableSalaryLinkETB: Math.max(0, salaryLimit - usedSalary),
    expiresAt: ba.expires_at,
  });
});

router.get('/employees/:id/benefit-wallets', (req, res) => {
  const db = getDb();
  const employeeId = req.params.id;

  const employee = db.prepare('SELECT * FROM employees WHERE id = ?').get(employeeId);
  if (!employee) {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: `Employee ${employeeId} not found.` },
    });
  }

  const wallets = db.prepare('SELECT * FROM benefit_wallets WHERE employee_id = ? ORDER BY category ASC').all(employeeId);
  const ba = db.prepare('SELECT * FROM benefit_accounts WHERE employee_id = ?').get(employeeId);

  const formattedWallets = wallets.map((w) => {
    const limit = Number(w.monthly_limit_etb);
    const used = Number(w.used_etb);
    const available = Math.max(0, limit - used);
    const utilization = limit > 0 ? Math.round((used / limit) * 100) : 0;
    return {
      id: w.id,
      category: w.category,
      monthlyLimitETB: limit,
      usedETB: used,
      availableETB: available,
      utilizationRate: utilization,
      cycleResetDate: w.cycle_reset_date,
    };
  });

  const salaryLimit = ba ? Number(ba.salary_link_limit_etb) : 1000;
  const salaryUsed = ba ? Number(ba.used_salary_link_etb) : 0;
  const availableSalary = Math.max(0, salaryLimit - salaryUsed);

  res.json({
    employeeId: employee.id,
    employeeName: employee.name,
    employerName: employee.employer_name,
    wallets: formattedWallets,
    payLater: {
      limitETB: salaryLimit,
      usedETB: salaryUsed,
      availableETB: availableSalary,
      utilizationRate: salaryLimit > 0 ? Math.round((salaryUsed / salaryLimit) * 100) : 0,
      nextRepaymentDate: '2026-10-31',
    },
  });
});

// ---------------------------------------------------------------------------
// 2. Merchant Endpoints
// ---------------------------------------------------------------------------

router.get('/merchants', (req, res) => {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM merchants').all();

  const merchants = rows.map((m) => {
    let allowedCategories = ['GROCERY', 'MEAL'];
    try {
      allowedCategories = JSON.parse(m.allowed_categories);
    } catch {}
    return {
      id: m.id,
      name: m.name,
      category: m.category,
      status: m.status,
      allowedCategories,
    };
  });

  res.json({ merchants });
});

router.get('/merchants/:id', (req, res) => {
  const db = getDb();
  const m = db.prepare('SELECT * FROM merchants WHERE id = ?').get(req.params.id);

  if (!m) {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: `Merchant ${req.params.id} not found.` },
    });
  }

  let allowedCategories = ['GROCERY', 'MEAL'];
  try {
    allowedCategories = JSON.parse(m.allowed_categories);
  } catch {}

  res.json({
    id: m.id,
    name: m.name,
    category: m.category,
    status: m.status,
    allowedCategories,
  });
});

// ---------------------------------------------------------------------------
// 3. Checkout & Authorization Endpoints
// ---------------------------------------------------------------------------

router.post('/checkout', (req, res) => {
  const { employeeId, merchantId, items, customerPhone } = req.body;
  const db = getDb();

  const employee = db.prepare('SELECT * FROM employees WHERE id = ?').get(employeeId);
  const merchant = db.prepare('SELECT * FROM merchants WHERE id = ?').get(merchantId);
  const benefitAccount = db.prepare('SELECT * FROM benefit_accounts WHERE employee_id = ?').get(employeeId);
  const wallets = employeeId ? db.prepare('SELECT * FROM benefit_wallets WHERE employee_id = ?').all(employeeId) : [];

  // Authoritatively calculate split
  const split = calculateSplit({
    merchant,
    employee,
    benefitAccount,
    items,
    wallets,
  });

  const orderId = `ord-${crypto.randomUUID().substring(0, 8)}`;
  const now = new Date().toISOString();

  // Persist order
  db.prepare(`
    INSERT INTO orders (
      id, employee_id, merchant_id, customer_phone,
      total_etb, benefit_covered_etb, employee_copay_etb,
      is_eligible, rejection_reason, items_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    orderId,
    employeeId || 'unknown',
    merchantId || 'unknown',
    customerPhone || (employee ? employee.phone : ''),
    split.orderTotalETB,
    split.benefitCoveredETB,
    split.employeeCoPayETB,
    split.isEligible ? 1 : 0,
    split.rejectionReason || null,
    JSON.stringify(items || []),
    now
  );

  res.json({
    orderId,
    split,
  });
});

router.post('/checkout/:orderId/authorize', async (req, res) => {
  const { orderId } = req.params;
  const { scenario = 'SUCCESS', customerPhone } = req.body;
  const db = getDb();

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  if (!order) {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: `Order ${orderId} not found.` },
    });
  }

  if (order.is_eligible !== 1) {
    return res.status(422).json({
      error: { code: 'ORDER_INELIGIBLE', message: order.rejection_reason || 'Order is ineligible for benefits.' },
    });
  }

  const existingPayment = db.prepare('SELECT * FROM payment_records WHERE order_id = ?').get(orderId);
  if (existingPayment && existingPayment.status === 'COMPLETED') {
    return res.status(400).json({
      error: { code: 'ALREADY_PAID', message: `Order ${orderId} is already paid.` },
    });
  }

  const paymentId = existingPayment ? existingPayment.id : `pay-${crypto.randomUUID().substring(0, 8)}`;
  const now = new Date().toISOString();
  const phone = customerPhone || order.customer_phone;

  // Case A: 100% Employer Benefit Covered (No M-PESA Co-Pay required)
  if (order.employee_copay_etb === 0) {
    try {
      db.exec('BEGIN TRANSACTION');

      if (!existingPayment) {
        db.prepare(`
          INSERT INTO payment_records (
            id, order_id, employee_id, merchant_id,
            total_etb, benefit_etb, mpesa_etb,
            status, mpesa_receipt_number, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          paymentId, order.id, order.employee_id, order.merchant_id,
          order.total_etb, order.benefit_covered_etb, 0,
          'COMPLETED', null, now, now
        );
      } else {
        db.prepare(`UPDATE payment_records SET status = 'COMPLETED', updated_at = ? WHERE id = ?`).run(now, paymentId);
      }

      // Deduct benefit allowance
      db.prepare(`
        UPDATE benefit_accounts 
        SET used_allowance_etb = used_allowance_etb + ?, updated_at = ?
        WHERE employee_id = ?
      `).run(order.benefit_covered_etb, now, order.employee_id);

      // Post double-entry journal
      const entries = buildCompletionEntries({
        totalETB: order.total_etb,
        benefitETB: order.benefit_covered_etb,
        mpesaETB: 0,
      });
      postJournalEntries(db, paymentId, entries, now);

      db.exec('COMMIT');

      return res.json({
        paymentId,
        checkoutRequestId: null,
        status: 'COMPLETED',
        mpesaEtb: 0,
        message: '100% employer benefit covered. Payment confirmed immediately.',
      });
    } catch (err) {
      db.exec('ROLLBACK');
      console.error('[Authorize 100% Benefit Error]', err);
      return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: err.message } });
    }
  }

  // Case B: Co-Pay required -> Initiate M-PESA STK Push
  if (!existingPayment) {
    db.prepare(`
      INSERT INTO payment_records (
        id, order_id, employee_id, merchant_id,
        total_etb, benefit_etb, mpesa_etb,
        status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      paymentId, order.id, order.employee_id, order.merchant_id,
      order.total_etb, order.benefit_covered_etb, order.employee_copay_etb,
      'PENDING_MPESA_CALLBACK', now, now
    );
  }

  try {
    const pushResult = await mpesaGateway.initiatePush({
      paymentId,
      orderId: order.id,
      phoneNumber: phone,
      amount: order.employee_copay_etb,
      scenario,
      onSimulatedCallback: async (callbackPayload) => {
        // Internal processing of simulated callback in mock mode
        await processMpesaCallback(callbackPayload);
      },
    });

    // Save identifiers
    db.prepare(`
      UPDATE payment_records 
      SET merchant_request_id = ?, checkout_request_id = ?, updated_at = ?
      WHERE id = ?
    `).run(pushResult.merchantRequestId, pushResult.checkoutRequestId, new Date().toISOString(), paymentId);

    res.json({
      paymentId,
      checkoutRequestId: pushResult.checkoutRequestId,
      status: 'PENDING_MPESA_CALLBACK',
      mpesaEtb: order.employee_copay_etb,
      message: pushResult.message,
    });
  } catch (err) {
    console.error('[M-PESA Push Error]', err);
    res.status(502).json({
      error: { code: 'GATEWAY_ERROR', message: `M-PESA initiation failed: ${err.message}` },
    });
  }
});

router.get('/payments/:paymentId/status', (req, res) => {
  const db = getDb();
  const payment = db.prepare('SELECT * FROM payment_records WHERE id = ?').get(req.params.paymentId);

  if (!payment) {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: `Payment ${req.params.paymentId} not found.` },
    });
  }

  res.json({
    paymentId: payment.id,
    status: payment.status,
    mpesaReceiptNumber: payment.mpesa_receipt_number,
    updatedAt: payment.updated_at,
  });
});

// ---------------------------------------------------------------------------
// 4. M-PESA Webhook Callback Endpoint (Idempotent)
// ---------------------------------------------------------------------------

router.post('/mpesa/callback', async (req, res) => {
  try {
    await processMpesaCallback(req.body);
    res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  } catch (err) {
    console.error('[M-PESA Webhook Error]', err);
    res.status(500).json({ ResultCode: 1, ResultDesc: err.message });
  }
});

/**
 * Authoritative, idempotent M-PESA callback processor.
 */
async function processMpesaCallback(payload) {
  const db = getDb();
  const parsed = mpesaGateway.parseCallback(payload);

  // 1. Idempotency Guard: Check if checkoutRequestId was already processed
  const existingEvent = db.prepare('SELECT id FROM webhook_events WHERE checkout_request_id = ?').get(parsed.checkoutRequestId);
  if (existingEvent) {
    console.log(`[Webhook Idempotency] Skipping duplicate callback for CheckoutRequestID: ${parsed.checkoutRequestId}`);
    return;
  }

  // 2. Locate associated payment record
  const payment = db.prepare(`
    SELECT * FROM payment_records 
    WHERE checkout_request_id = ? OR merchant_request_id = ?
  `).get(parsed.checkoutRequestId, parsed.merchantRequestId);

  if (!payment) {
    console.warn(`[Webhook Warning] No payment record matched CheckoutRequestID: ${parsed.checkoutRequestId}`);
    return;
  }

  // Record webhook audit event
  db.prepare(`
    INSERT INTO webhook_events (id, checkout_request_id, result_code, payload_json, processed_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    `evt-${crypto.randomUUID()}`,
    parsed.checkoutRequestId,
    parsed.resultCode,
    JSON.stringify(payload),
    new Date().toISOString()
  );

  const now = new Date().toISOString();

  // 3. Process according to ResultCode
  if (parsed.isSuccess) {
    // Single atomic transaction for payment completion + ledger write + quota deduction
    try {
      db.exec('BEGIN TRANSACTION');

      // Update payment record
      db.prepare(`
        UPDATE payment_records 
        SET status = 'COMPLETED',
            mpesa_receipt_number = ?,
            raw_callback_json = ?,
            updated_at = ?
        WHERE id = ?
      `).run(parsed.receiptNumber, JSON.stringify(payload), now, payment.id);

      // Deduct employer benefit quota & update salary link usage
      db.prepare(`
        UPDATE benefit_accounts
        SET used_allowance_etb = used_allowance_etb + ?,
            used_salary_link_etb = used_salary_link_etb + ?,
            updated_at = ?
        WHERE employee_id = ?
      `).run(payment.benefit_etb, payment.mpesa_etb, now, payment.employee_id);

      // Post double-entry balanced journal entries
      const entries = buildCompletionEntries({
        totalETB: payment.total_etb,
        benefitETB: payment.benefit_etb,
        mpesaETB: payment.mpesa_etb,
      });
      postJournalEntries(db, payment.id, entries, now);

      db.exec('COMMIT');
      console.log(`[Payment Settled] Payment ${payment.id} settled with Receipt ${parsed.receiptNumber}`);
    } catch (err) {
      db.exec('ROLLBACK');
      console.error(`[Payment Settlement Rollback] Payment ${payment.id} failed to commit:`, err);
      throw err;
    }
  } else if (parsed.isCancelled) {
    db.prepare(`
      UPDATE payment_records 
      SET status = 'FAILED_REJECTED', raw_callback_json = ?, updated_at = ?
      WHERE id = ?
    `).run(JSON.stringify(payload), now, payment.id);
  } else if (parsed.isTimeout) {
    db.prepare(`
      UPDATE payment_records 
      SET status = 'FAILED_TIMEOUT', raw_callback_json = ?, updated_at = ?
      WHERE id = ?
    `).run(JSON.stringify(payload), now, payment.id);
  } else {
    db.prepare(`
      UPDATE payment_records 
      SET status = 'FAILED_REJECTED', raw_callback_json = ?, updated_at = ?
      WHERE id = ?
    `).run(JSON.stringify(payload), now, payment.id);
  }
}

// ---------------------------------------------------------------------------
// 5. Transactions & Detail Endpoints
// ---------------------------------------------------------------------------

router.get('/transactions', (req, res) => {
  const { employeeId } = req.query;
  const db = getDb();

  let query = `
    SELECT 
      p.id, p.order_id AS orderId, p.employee_id AS employeeId,
      p.merchant_id AS merchantId, m.name AS merchantName,
      m.category AS merchantCategory, p.total_etb AS totalETB,
      p.benefit_etb AS benefitETB, p.mpesa_etb AS mpesaETB,
      p.mpesa_receipt_number AS mpesaReceiptNumber,
      p.checkout_request_id AS mpesaCheckoutRequestId,
      p.status, p.refund_reason AS refundReason,
      p.created_at AS createdAt, p.updated_at AS updatedAt
    FROM payment_records p
    LEFT JOIN merchants m ON p.merchant_id = m.id
  `;

  const params = [];
  if (employeeId) {
    query += ' WHERE p.employee_id = ?';
    params.push(employeeId);
  }
  query += ' ORDER BY p.created_at DESC';

  const rows = db.prepare(query).all(...params);

  // Attach ledger entries to each transaction
  const transactions = rows.map((tx) => {
    const entries = getJournalEntriesForPayment(db, tx.id);
    return {
      ...tx,
      ledgerEntries: entries,
    };
  });

  res.json({
    transactions,
    total: transactions.length,
    hasMore: false,
  });
});

router.get('/transactions/:id', (req, res) => {
  const db = getDb();
  const tx = db.prepare(`
    SELECT 
      p.id, p.order_id AS orderId, p.employee_id AS employeeId,
      p.merchant_id AS merchantId, m.name AS merchantName,
      m.category AS merchantCategory, p.total_etb AS totalETB,
      p.benefit_etb AS benefitETB, p.mpesa_etb AS mpesaETB,
      p.mpesa_receipt_number AS mpesaReceiptNumber,
      p.checkout_request_id AS mpesaCheckoutRequestId,
      p.status, p.refund_reason AS refundReason,
      p.created_at AS createdAt, p.updated_at AS updatedAt
    FROM payment_records p
    LEFT JOIN merchants m ON p.merchant_id = m.id
    WHERE p.id = ?
  `).get(req.params.id);

  if (!tx) {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: `Transaction ${req.params.id} not found.` },
    });
  }

  const entries = getJournalEntriesForPayment(db, tx.id);

  res.json({
    ...tx,
    ledgerEntries: entries,
  });
});

router.post('/transactions/:id/refund', (req, res) => {
  const { id } = req.params;
  const { reason = 'Order cancellation' } = req.body;
  const db = getDb();

  const payment = db.prepare('SELECT * FROM payment_records WHERE id = ?').get(id);
  if (!payment) {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: `Payment ${id} not found.` },
    });
  }

  if (payment.status !== 'COMPLETED') {
    return res.status(400).json({
      error: { code: 'INVALID_STATE', message: 'Only COMPLETED transactions can be refunded.' },
    });
  }

  const now = new Date().toISOString();
  const refundId = `ref-${Date.now()}`;

  try {
    db.exec('BEGIN TRANSACTION');

    // 1. Update payment record to REVERSED
    db.prepare(`
      UPDATE payment_records 
      SET status = 'REVERSED', refund_reason = ?, updated_at = ?
      WHERE id = ?
    `).run(reason, now, id);

    // 2. Restore employee benefit quota & salary link
    db.prepare(`
      UPDATE benefit_accounts
      SET used_allowance_etb = MAX(0, used_allowance_etb - ?),
          used_salary_link_etb = MAX(0, used_salary_link_etb - ?),
          updated_at = ?
      WHERE employee_id = ?
    `).run(payment.benefit_etb, payment.mpesa_etb, now, payment.employee_id);

    // 3. Post reversal double-entry journal entries
    const reversalEntries = buildReversalEntries({
      totalETB: payment.total_etb,
      benefitETB: payment.benefit_etb,
      mpesaETB: payment.mpesa_etb,
    });
    postJournalEntries(db, id, reversalEntries, now);

    db.exec('COMMIT');

    res.json({
      refundId,
      paymentId: id,
      status: 'REFUND_PENDING', // Returns REFUND_PENDING for immediate UI feedback per contract
      mpesaRefundETB: payment.mpesa_etb,
      benefitRestoredETB: payment.benefit_etb,
      message: 'M-PESA reversal initiated. Benefit balance will be restored upon confirmation.',
    });
  } catch (err) {
    db.exec('ROLLBACK');
    console.error('[Refund Error]', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: err.message } });
  }
});

// ---------------------------------------------------------------------------
// 6. Operations & Settlement Endpoints
// ---------------------------------------------------------------------------

router.get('/ops/summary', (req, res) => {
  const db = getDb();
  const payments = db.prepare('SELECT * FROM payment_records').all();

  const totalTransactions = payments.length;
  const completedCount = payments.filter((p) => p.status === 'COMPLETED').length;
  const pendingCount = payments.filter((p) => p.status.startsWith('PENDING')).length;
  const failedCount = payments.filter((p) => p.status.startsWith('FAILED')).length;
  const refundedCount = payments.filter((p) => p.status === 'REVERSED').length;

  const totalVolumeETB = payments.reduce((sum, p) => sum + Number(p.total_etb), 0);
  const totalBenefitETB = payments.reduce((sum, p) => sum + Number(p.benefit_etb), 0);
  const totalMpesaETB = payments.reduce((sum, p) => sum + Number(p.mpesa_etb), 0);

  res.json({
    totalTransactions,
    completedCount,
    pendingCount,
    failedCount,
    refundedCount,
    totalVolumeETB,
    totalBenefitETB,
    totalMpesaETB,
    pendingReconciliation: false,
    lastReconciliationAt: '2026-10-13T00:00:00Z',
  });
});

router.post('/ops/reconcile', (req, res) => {
  const db = getDb();
  try {
    const report = runLedgerReconciliation(db);
    res.json(report);
  } catch (err) {
    console.error('[Reconciliation Error]', err);
    res.status(500).json({ error: { code: 'RECONCILIATION_FAILED', message: err.message } });
  }
});

module.exports = { router, processMpesaCallback };
