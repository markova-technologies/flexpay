/**
 * FlexPay Mock API Adapter
 * ========================
 * Deterministic demo data. All async methods resolve with realistic delays.
 * Used when VITE_USE_MOCK=true or when no backend is reachable.
 *
 * ⚠ SIMULATION — no real M-PESA calls are made.
 */

import { DEMO_SCENARIO, DEMO_EMPLOYEES, DEMO_MERCHANTS } from './scenarios.js';

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// Seed data
// ---------------------------------------------------------------------------

const EMPLOYEES = {
  'emp-001': {
    id: 'emp-001',
    name: 'Abebe Kebede',
    phone: '251912345678',
    employerId: 'emp-eth-telecom',
    employerName: 'Ethio Telecom',
  },
  'emp-002': {
    id: 'emp-002',
    name: 'Sara Haile',
    phone: '251911987654',
    employerId: 'emp-cbe',
    employerName: 'Commercial Bank of Ethiopia',
  },
};

const MERCHANTS = {
  'mer-001': {
    id: 'mer-001', name: 'Yod Abyssinia Market',
    category: 'GROCERY', status: 'ACTIVE',
    allowedCategories: ['GROCERY', 'MEAL'],
  },
  'mer-002': {
    id: 'mer-002', name: 'Electronics Paradise',
    category: 'ELECTRONICS', status: 'ACTIVE',
    allowedCategories: ['GROCERY', 'MEAL'],
  },
  'mer-003': {
    id: 'mer-003', name: 'Addis Café',
    category: 'MEAL', status: 'ACTIVE',
    allowedCategories: ['GROCERY', 'MEAL'],
  },
};

const BENEFIT_ACCOUNTS = {
  'emp-001': {
    employeeId: 'emp-001',
    employerName: 'Ethio Telecom',
    totalAllowanceETB:     3000,
    usedAllowanceETB:      1500,
    availableBalanceETB:   1500,
    salaryLinkLimitETB:    2000,
    usedSalaryLinkETB:     500,
    availableSalaryLinkETB:1500,
    expiresAt: '2026-10-31T23:59:59Z',
  },
  'emp-002': {
    employeeId: 'emp-002',
    employerName: 'Commercial Bank of Ethiopia',
    totalAllowanceETB:     2000,
    usedAllowanceETB:      2000,
    availableBalanceETB:   0,       // ← "insufficient benefit" scenario seed
    salaryLinkLimitETB:    1500,
    usedSalaryLinkETB:     0,
    availableSalaryLinkETB:1500,
    expiresAt: '2026-10-31T23:59:59Z',
  },
};

// In-memory transaction store (grows during demo session)
let _transactions = [
  {
    id: 'pay-hist-001',
    orderId: 'ord-hist-001',
    employeeId: 'emp-001',
    merchantId: 'mer-001',
    merchantName: 'Yod Abyssinia Market',
    merchantCategory: 'GROCERY',
    totalETB: 2000,
    benefitETB: 1500,
    mpesaETB: 500,
    mpesaReceiptNumber: 'SD9876EFGH',
    status: 'COMPLETED',
    createdAt: '2026-10-12T10:30:00Z',
    updatedAt: '2026-10-12T10:30:45Z',
    ledgerEntries: [
      { accountType: 'LIABILITY_EMPLOYER_BENEFIT',  debitETB: 1500, creditETB: 0,    label: 'Employer Benefit Debit' },
      { accountType: 'ASSET_MPESA_CLEARING',         debitETB: 500,  creditETB: 0,    label: 'M-PESA Clearing Debit' },
      { accountType: 'LIABILITY_MERCHANT_PAYABLE',   debitETB: 0,    creditETB: 2000, label: 'Merchant Payable Credit' },
    ],
  },
  {
    id: 'pay-hist-002',
    orderId: 'ord-hist-002',
    employeeId: 'emp-001',
    merchantId: 'mer-003',
    merchantName: 'Addis Café',
    merchantCategory: 'MEAL',
    totalETB: 450,
    benefitETB: 450,
    mpesaETB: 0,
    mpesaReceiptNumber: null,
    status: 'COMPLETED',
    createdAt: '2026-10-11T08:15:00Z',
    updatedAt: '2026-10-11T08:15:10Z',
    ledgerEntries: [
      { accountType: 'LIABILITY_EMPLOYER_BENEFIT',  debitETB: 450, creditETB: 0,   label: 'Employer Benefit Debit' },
      { accountType: 'LIABILITY_MERCHANT_PAYABLE',  debitETB: 0,   creditETB: 450, label: 'Merchant Payable Credit' },
    ],
  },
  {
    id: 'pay-hist-003',
    orderId: 'ord-hist-003',
    employeeId: 'emp-001',
    merchantId: 'mer-001',
    merchantName: 'Yod Abyssinia Market',
    merchantCategory: 'GROCERY',
    totalETB: 1200,
    benefitETB: 1050,
    mpesaETB: 150,
    mpesaReceiptNumber: null,
    status: 'FAILED_REJECTED',
    createdAt: '2026-10-10T14:22:00Z',
    updatedAt: '2026-10-10T14:23:05Z',
    ledgerEntries: [],
  },
  {
    id: 'pay-hist-004',
    orderId: 'ord-hist-004',
    employeeId: 'emp-001',
    merchantId: 'mer-001',
    merchantName: 'Yod Abyssinia Market',
    merchantCategory: 'GROCERY',
    totalETB: 800,
    benefitETB: 800,
    mpesaETB: 0,
    mpesaReceiptNumber: 'SD1111AAAA',
    status: 'REVERSED',
    refundReason: 'Merchant could not fulfill order',
    createdAt: '2026-10-09T16:00:00Z',
    updatedAt: '2026-10-09T17:30:00Z',
    ledgerEntries: [
      { accountType: 'LIABILITY_EMPLOYER_BENEFIT',  debitETB: 800, creditETB: 0,   label: 'Employer Benefit Debit' },
      { accountType: 'LIABILITY_MERCHANT_PAYABLE',  debitETB: 0,   creditETB: 800, label: 'Merchant Payable Credit' },
      // Reversal entries
      { accountType: 'LIABILITY_MERCHANT_PAYABLE',  debitETB: 800, creditETB: 0,   label: 'Reversal: Merchant Payable Debit' },
      { accountType: 'LIABILITY_EMPLOYER_BENEFIT',  debitETB: 0,   creditETB: 800, label: 'Reversal: Benefit Restored' },
    ],
  },
];

let _nextOrderId  = 1;
let _nextPayId    = 1;

// Simulated in-flight payment state
let _pendingPayment = null;

// ---------------------------------------------------------------------------
// Mock methods
// ---------------------------------------------------------------------------

export const mockAdapter = {
  async getEmployee(id) {
    await delay(180);
    const emp = EMPLOYEES[id];
    if (!emp) throw { code: 'NOT_FOUND', message: `Employee ${id} not found.` };
    return emp;
  },

  async getBenefitAccount(employeeId) {
    await delay(200);
    const acct = BENEFIT_ACCOUNTS[employeeId];
    if (!acct) throw { code: 'NOT_FOUND', message: `Benefit account for ${employeeId} not found.` };
    return acct;
  },

  async getMerchants() {
    await delay(150);
    return { merchants: Object.values(MERCHANTS) };
  },

  async getMerchant(id) {
    await delay(150);
    const m = MERCHANTS[id];
    if (!m) throw { code: 'NOT_FOUND', message: `Merchant ${id} not found.` };
    return m;
  },

  async checkout({ employeeId, merchantId, items }) {
    await delay(400);

    const scenario = DEMO_SCENARIO.current;
    const orderId  = `ord-demo-${String(_nextOrderId++).padStart(3, '0')}`;
    const merchant = MERCHANTS[merchantId];
    const benefit  = BENEFIT_ACCOUNTS[employeeId];

    const orderTotalETB = items.reduce((sum, i) => sum + i.unitPriceETB * i.quantity, 0);

    // Ineligible merchant scenario
    if (scenario === 'INELIGIBLE_MERCHANT' ||
        (merchant && !merchant.allowedCategories.includes(merchant.category))) {
      return {
        orderId,
        split: {
          orderTotalETB,
          benefitCoveredETB: 0,
          employeeCoPayETB: 0,
          benefitPercentage: 0,
          isEligible: false,
          rejectionReason: `Category ${merchant?.category ?? 'UNKNOWN'} is not permitted under employer benefit policy.`,
        },
      };
    }

    // Insufficient benefit scenario
    if (scenario === 'INSUFFICIENT_BENEFIT' || (benefit && benefit.availableBalanceETB < orderTotalETB * 0.5)) {
      const coveredETB = Math.min(benefit?.availableBalanceETB ?? 0, orderTotalETB);
      const coPayETB   = orderTotalETB - coveredETB;
      return {
        orderId,
        split: {
          orderTotalETB,
          benefitCoveredETB: coveredETB,
          employeeCoPayETB: coPayETB,
          benefitPercentage: Math.round((coveredETB / orderTotalETB) * 100),
          isEligible: coveredETB > 0,
          rejectionReason: coveredETB === 0
            ? `Benefit balance (ETB 0.00) is insufficient for this purchase.`
            : undefined,
          employerName: benefit?.employerName ?? 'Employer',
          benefitCategory: 'GROCERY',
        },
      };
    }

    // Standard success split (ETB 1,500 / ETB 500 for the demo order)
    const benefitCoveredETB = Math.min(benefit?.availableBalanceETB ?? 1500, Math.floor(orderTotalETB * 0.75));
    const employeeCoPayETB  = orderTotalETB - benefitCoveredETB;
    return {
      orderId,
      split: {
        orderTotalETB,
        benefitCoveredETB,
        employeeCoPayETB,
        benefitPercentage: Math.round((benefitCoveredETB / orderTotalETB) * 100),
        isEligible: true,
        employerName: benefit?.employerName ?? 'Employer',
        benefitCategory: 'GROCERY',
      },
    };
  },

  async authorize({ orderId, employeeId, customerPhone, coPayETB, scenario }) {
    await delay(500);
    const paymentId = `pay-demo-${String(_nextPayId++).padStart(3, '0')}`;
    const checkoutRequestId = `ws_CO_${Date.now()}`;
    const effectiveScenario = scenario || DEMO_SCENARIO.current;
    _pendingPayment = {
      id: paymentId,
      orderId,
      employeeId,
      checkoutRequestId,
      coPayETB,
      createdAt: new Date().toISOString(),
      scenario: effectiveScenario,
      _resolvedAt: null,
    };
    return {
      paymentId,
      checkoutRequestId,
      status: 'PENDING_MPESA_CALLBACK',
      mpesaEtb: coPayETB,
      message: `USSD prompt sent to +${customerPhone}`,
    };
  },

  async getPaymentStatus(paymentId) {
    await delay(200);
    if (!_pendingPayment || _pendingPayment.id !== paymentId) {
      // Look up in history
      const hist = _transactions.find((t) => t.id === paymentId);
      if (hist) return { paymentId, status: hist.status, mpesaReceiptNumber: hist.mpesaReceiptNumber, updatedAt: hist.updatedAt };
      throw { code: 'NOT_FOUND', message: `Payment ${paymentId} not found.` };
    }

    const elapsed = Date.now() - new Date(_pendingPayment.createdAt).getTime();
    const scenario = _pendingPayment.scenario;

    // Return final status based on scenario + elapsed time (>= 2800ms resolves on 2nd poll at ~4s)
    if (elapsed >= 2800) {
      let finalStatus, receiptNumber = null;
      switch (scenario) {
        case 'USER_CANCELLED': finalStatus = 'FAILED_REJECTED'; break;
        case 'TIMEOUT':        finalStatus = 'FAILED_TIMEOUT';  break;
        case 'SUCCESS':
        default:
          finalStatus   = 'COMPLETED';
          receiptNumber = `SD${Math.random().toString(36).substring(2,6).toUpperCase()}DEMO`;
          break;
      }
      // Commit to transaction log
      if (!_pendingPayment._resolvedAt) {
        _pendingPayment._resolvedAt = new Date().toISOString();
        const tx = _buildTransaction(_pendingPayment, finalStatus, receiptNumber);
        _transactions.unshift(tx);
        // Update benefit balance
        if (finalStatus === 'COMPLETED') {
          const ba = BENEFIT_ACCOUNTS[_pendingPayment.employeeId];
          if (ba) {
            const order = _transactions.find((t) => t.orderId === _pendingPayment.orderId);
            if (order) {
              ba.usedAllowanceETB = Math.min(ba.totalAllowanceETB, ba.usedAllowanceETB + order.benefitETB);
              ba.availableBalanceETB = ba.totalAllowanceETB - ba.usedAllowanceETB;
              ba.usedSalaryLinkETB  = ba.usedSalaryLinkETB + _pendingPayment.coPayETB;
              ba.availableSalaryLinkETB = ba.salaryLinkLimitETB - ba.usedSalaryLinkETB;
            }
          }
        }
      }
      return { paymentId, status: finalStatus, mpesaReceiptNumber: receiptNumber, updatedAt: _pendingPayment._resolvedAt };
    }

    return { paymentId, status: 'PENDING_MPESA_CALLBACK', updatedAt: new Date().toISOString() };
  },

  async getTransactions({ employeeId } = {}) {
    await delay(250);
    const list = employeeId
      ? _transactions.filter((t) => t.employeeId === employeeId)
      : _transactions;
    return { transactions: list, total: list.length, hasMore: false };
  },

  async getTransactionDetail(id) {
    await delay(200);
    const tx = _transactions.find((t) => t.id === id);
    if (!tx) throw { code: 'NOT_FOUND', message: `Transaction ${id} not found.` };
    return tx;
  },

  async requestRefund(paymentId, reason) {
    await delay(600);
    const tx = _transactions.find((t) => t.id === paymentId);
    if (!tx) throw { code: 'NOT_FOUND', message: `Payment ${paymentId} not found.` };
    if (tx.status !== 'COMPLETED') throw { code: 'INVALID_STATE', message: 'Only COMPLETED transactions can be refunded.' };
    tx.status       = 'REFUND_PENDING';
    tx.refundReason = reason;
    tx.updatedAt    = new Date().toISOString();
    // Simulate async resolution after 5s
    setTimeout(() => {
      tx.status    = 'REVERSED';
      tx.updatedAt = new Date().toISOString();
      // Restore benefit
      const ba = BENEFIT_ACCOUNTS[tx.employeeId];
      if (ba) {
        ba.usedAllowanceETB    = Math.max(0, ba.usedAllowanceETB - tx.benefitETB);
        ba.availableBalanceETB = ba.totalAllowanceETB - ba.usedAllowanceETB;
      }
    }, 5000);
    return {
      refundId: `ref-${Date.now()}`,
      paymentId,
      status: 'REFUND_PENDING',
      mpesaRefundETB: tx.mpesaETB,
      benefitRestoredETB: tx.benefitETB,
      message: 'M-PESA reversal initiated. Benefit balance will be restored upon confirmation.',
    };
  },

  async getOpsSummary() {
    await delay(300);
    const all = _transactions;
    return {
      totalTransactions:   all.length,
      completedCount:      all.filter((t) => t.status === 'COMPLETED').length,
      pendingCount:        all.filter((t) => t.status.startsWith('PENDING')).length,
      failedCount:         all.filter((t) => t.status.startsWith('FAILED')).length,
      refundedCount:       all.filter((t) => t.status === 'REVERSED').length,
      totalVolumeETB:      all.reduce((s, t) => s + t.totalETB, 0),
      totalBenefitETB:     all.reduce((s, t) => s + t.benefitETB, 0),
      totalMpesaETB:       all.reduce((s, t) => s + t.mpesaETB, 0),
      pendingReconciliation: false,
      lastReconciliationAt: '2026-10-13T00:00:00Z',
    };
  },

  async reconcile() {
    await delay(1200);
    const completed = _transactions.filter((t) => t.status === 'COMPLETED');
    const mpesaTotal   = completed.reduce((s, t) => s + t.mpesaETB, 0);
    const benefitTotal = completed.reduce((s, t) => s + t.benefitETB, 0);
    return {
      status: 'BALANCED',
      mpesaClearingBalance: mpesaTotal,
      mpesaCallbackTotal:   mpesaTotal,
      benefitDebitTotal:    benefitTotal,
      employerBillableTotal:benefitTotal,
      auditedAt: new Date().toISOString(),
    };
  },
};

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

function _buildTransaction(pending, status, receiptNumber) {
  const allTx = _transactions;
  // Find the order split data — we stored it implicitly via coPayETB
  // Estimate benefitETB as (total - coPayETB); total comes from the items sum
  // In a real system this comes from the DB. For the mock, we use a reasonable approximation.
  const totalETB   = pending.coPayETB > 0 ? Math.round(pending.coPayETB / 0.25) : 0; // 500/0.25=2000
  const benefitETB = totalETB - pending.coPayETB;

  const entries = status === 'COMPLETED' ? [
    { accountType: 'LIABILITY_EMPLOYER_BENEFIT',  debitETB: benefitETB, creditETB: 0,          label: 'Employer Benefit Debit' },
    { accountType: 'ASSET_MPESA_CLEARING',         debitETB: pending.coPayETB, creditETB: 0,   label: 'M-PESA Clearing Debit' },
    { accountType: 'LIABILITY_MERCHANT_PAYABLE',   debitETB: 0,          creditETB: totalETB,   label: 'Merchant Payable Credit' },
  ] : [];

  return {
    id: pending.id,
    orderId: pending.orderId,
    employeeId: pending.employeeId,
    merchantId: 'mer-001',
    merchantName: 'Yod Abyssinia Market',
    merchantCategory: 'GROCERY',
    totalETB,
    benefitETB,
    mpesaETB: pending.coPayETB,
    mpesaReceiptNumber: receiptNumber,
    mpesaCheckoutRequestId: pending.checkoutRequestId,
    status,
    createdAt: pending.createdAt,
    updatedAt: pending._resolvedAt ?? new Date().toISOString(),
    ledgerEntries: entries,
  };
}
