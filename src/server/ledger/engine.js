/**
 * FlexPay Double-Entry Ledger Engine
 * ===================================
 * Implements strict financial invariants and double-entry bookkeeping.
 * Invariant: Every journal entry batch MUST balance: SUM(debits) === SUM(credits).
 */

const crypto = require('node:crypto');

const ACCOUNT_TYPES = {
  ASSET_MPESA_CLEARING: 'ASSET_MPESA_CLEARING',
  LIABILITY_EMPLOYER_BENEFIT: 'LIABILITY_EMPLOYER_BENEFIT',
  LIABILITY_MERCHANT_PAYABLE: 'LIABILITY_MERCHANT_PAYABLE',
};

/**
 * Validates that a set of ledger entries is strictly balanced.
 * 
 * @param {Array<{ debitETB: number, creditETB: number }>} entries
 * @throws {Error} If entries are unbalanced
 */
function assertBalanced(entries) {
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error('Ledger transaction must contain at least one entry');
  }

  const sumDebits = entries.reduce((s, e) => s + (Number(e.debitETB) || 0), 0);
  const sumCredits = entries.reduce((s, e) => s + (Number(e.creditETB) || 0), 0);

  // Use 2 decimal place precision comparison to prevent floating-point drift
  const diff = Math.abs(sumDebits - sumCredits);
  if (diff > 0.001) {
    throw new Error(`Double-entry invariant violation: SUM(Debits) [ETB ${sumDebits.toFixed(2)}] !== SUM(Credits) [ETB ${sumCredits.toFixed(2)}]`);
  }

  return { sumDebits, sumCredits };
}

/**
 * Builds standard journal entries for a completed purchase.
 * 
 * @param {Object} params
 * @param {number} params.totalETB
 * @param {number} params.benefitETB
 * @param {number} params.mpesaETB
 * @returns {Array<Object>}
 */
function buildCompletionEntries({ totalETB, benefitETB, mpesaETB }) {
  const entries = [];

  if (benefitETB > 0) {
    entries.push({
      accountType: ACCOUNT_TYPES.LIABILITY_EMPLOYER_BENEFIT,
      debitETB: benefitETB,
      creditETB: 0,
      label: 'Employer Benefit Debit',
    });
  }

  if (mpesaETB > 0) {
    entries.push({
      accountType: ACCOUNT_TYPES.ASSET_MPESA_CLEARING,
      debitETB: mpesaETB,
      creditETB: 0,
      label: 'M-PESA Clearing Debit',
    });
  }

  entries.push({
    accountType: ACCOUNT_TYPES.LIABILITY_MERCHANT_PAYABLE,
    debitETB: 0,
    creditETB: totalETB,
    label: 'Merchant Payable Credit',
  });

  assertBalanced(entries);
  return entries;
}

/**
 * Builds standard reversal entries for a refund.
 * 
 * @param {Object} params
 * @param {number} params.totalETB
 * @param {number} params.benefitETB
 * @param {number} params.mpesaETB
 * @returns {Array<Object>}
 */
function buildReversalEntries({ totalETB, benefitETB, mpesaETB }) {
  const entries = [];

  entries.push({
    accountType: ACCOUNT_TYPES.LIABILITY_MERCHANT_PAYABLE,
    debitETB: totalETB,
    creditETB: 0,
    label: 'Reversal: Merchant Payable Debit',
  });

  if (benefitETB > 0) {
    entries.push({
      accountType: ACCOUNT_TYPES.LIABILITY_EMPLOYER_BENEFIT,
      debitETB: 0,
      creditETB: benefitETB,
      label: 'Reversal: Benefit Restored',
    });
  }

  if (mpesaETB > 0) {
    entries.push({
      accountType: ACCOUNT_TYPES.ASSET_MPESA_CLEARING,
      debitETB: 0,
      creditETB: mpesaETB,
      label: 'Reversal: M-PESA Clearing Credit',
    });
  }

  assertBalanced(entries);
  return entries;
}

/**
 * Atomically persists journal entries into the database.
 * 
 * @param {Object} db - SQLite database instance
 * @param {string} paymentId - Associated payment record ID
 * @param {Array<Object>} entries - Pre-balanced journal entries
 * @param {string} [timestamp] - ISO timestamp
 */
function postJournalEntries(db, paymentId, entries, timestamp = new Date().toISOString()) {
  assertBalanced(entries);

  const insertStmt = db.prepare(`
    INSERT INTO journal_entries (id, payment_id, account_type, debit_etb, credit_etb, label, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  for (const entry of entries) {
    const entryId = `j-${crypto.randomUUID()}`;
    insertStmt.run(
      entryId,
      paymentId,
      entry.accountType,
      entry.debitETB,
      entry.creditETB,
      entry.label,
      timestamp
    );
  }
}

/**
 * Fetches all journal entries associated with a payment record.
 * 
 * @param {Object} db
 * @param {string} paymentId
 * @returns {Array<Object>}
 */
function getJournalEntriesForPayment(db, paymentId) {
  const stmt = db.prepare(`
    SELECT 
      account_type AS accountType,
      debit_etb AS debitETB,
      credit_etb AS creditETB,
      label,
      created_at AS createdAt
    FROM journal_entries
    WHERE payment_id = ?
    ORDER BY rowid ASC
  `);
  return stmt.all(paymentId);
}

/**
 * Performs full system reconciliation across all ledger accounts.
 * 
 * @param {Object} db
 * @returns {Object} Reconciliation report
 */
function reconcile(db) {
  // 1. Audit all journal entries for total debits vs total credits
  const totalAudit = db.prepare(`
    SELECT 
      ROUND(SUM(debit_etb), 2) AS totalDebits,
      ROUND(SUM(credit_etb), 2) AS totalCredits
    FROM journal_entries
  `).get();

  const totalDebits = Number(totalAudit.totalDebits || 0);
  const totalCredits = Number(totalAudit.totalCredits || 0);

  // 2. Audit M-PESA Clearing account
  const mpesaClearing = db.prepare(`
    SELECT 
      ROUND(SUM(debit_etb - credit_etb), 2) AS balance
    FROM journal_entries
    WHERE account_type = 'ASSET_MPESA_CLEARING'
  `).get();
  const mpesaClearingBalance = Number(mpesaClearing.balance || 0);

  // 3. Audit M-PESA payment records (COMPLETED minus REVERSED)
  const mpesaPayments = db.prepare(`
    SELECT 
      ROUND(SUM(
        CASE 
          WHEN status = 'COMPLETED' THEN mpesa_etb
          WHEN status = 'REVERSED' THEN 0
          ELSE 0 
        END
      ), 2) AS total
    FROM payment_records
  `).get();
  const mpesaCallbackTotal = Number(mpesaPayments.total || 0);

  // 4. Audit Employer Benefit account
  const benefitJournal = db.prepare(`
    SELECT 
      ROUND(SUM(debit_etb - credit_etb), 2) AS balance
    FROM journal_entries
    WHERE account_type = 'LIABILITY_EMPLOYER_BENEFIT'
  `).get();
  const benefitDebitTotal = Number(benefitJournal.balance || 0);

  // 5. Audit Employer Billable from payment records
  const benefitPayments = db.prepare(`
    SELECT 
      ROUND(SUM(
        CASE 
          WHEN status = 'COMPLETED' THEN benefit_etb
          WHEN status = 'REVERSED' THEN 0
          ELSE 0 
        END
      ), 2) AS total
    FROM payment_records
  `).get();
  const employerBillableTotal = Number(benefitPayments.total || 0);

  const isBalanced = Math.abs(totalDebits - totalCredits) < 0.01 &&
                     Math.abs(mpesaClearingBalance - mpesaCallbackTotal) < 0.01 &&
                     Math.abs(benefitDebitTotal - employerBillableTotal) < 0.01;

  return {
    status: isBalanced ? 'BALANCED' : 'DISCREPANCY',
    totalDebits,
    totalCredits,
    mpesaClearingBalance,
    mpesaCallbackTotal,
    benefitDebitTotal,
    employerBillableTotal,
    auditedAt: new Date().toISOString(),
  };
}

module.exports = {
  ACCOUNT_TYPES,
  assertBalanced,
  buildCompletionEntries,
  buildReversalEntries,
  postJournalEntries,
  getJournalEntriesForPayment,
  reconcile,
};
