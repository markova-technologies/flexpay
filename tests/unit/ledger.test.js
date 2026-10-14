const test = require('node:test');
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const {
  assertBalanced,
  buildCompletionEntries,
  buildReversalEntries,
  postJournalEntries,
  getJournalEntriesForPayment,
  reconcile,
} = require('../../src/server/ledger/engine.js');

test('Ledger Invariants - Double-Entry Balancing', async (t) => {
  await t.test('accepts strictly balanced debits and credits', () => {
    const entries = [
      { accountType: 'LIABILITY_EMPLOYER_BENEFIT', debitETB: 1500, creditETB: 0 },
      { accountType: 'ASSET_MPESA_CLEARING', debitETB: 500, creditETB: 0 },
      { accountType: 'LIABILITY_MERCHANT_PAYABLE', debitETB: 0, creditETB: 2000 },
    ];
    assert.doesNotThrow(() => assertBalanced(entries));
  });

  await t.test('throws invariant violation error on unbalanced entries', () => {
    const entries = [
      { accountType: 'LIABILITY_EMPLOYER_BENEFIT', debitETB: 1500, creditETB: 0 },
      { accountType: 'ASSET_MPESA_CLEARING', debitETB: 400, creditETB: 0 }, // 100 short!
      { accountType: 'LIABILITY_MERCHANT_PAYABLE', debitETB: 0, creditETB: 2000 },
    ];
    assert.throws(() => assertBalanced(entries), /Double-entry invariant violation/);
  });

  await t.test('generates valid completion journal entries', () => {
    const entries = buildCompletionEntries({
      totalETB: 2000,
      benefitETB: 1500,
      mpesaETB: 500,
    });
    assert.equal(entries.length, 3);
    const debits = entries.reduce((s, e) => s + e.debitETB, 0);
    const credits = entries.reduce((s, e) => s + e.creditETB, 0);
    assert.equal(debits, 2000);
    assert.equal(credits, 2000);
  });

  await t.test('generates valid reversal journal entries for refund', () => {
    const entries = buildReversalEntries({
      totalETB: 2000,
      benefitETB: 1500,
      mpesaETB: 500,
    });
    assert.equal(entries.length, 3);
    const debits = entries.reduce((s, e) => s + e.debitETB, 0);
    const credits = entries.reduce((s, e) => s + e.creditETB, 0);
    assert.equal(debits, 2000);
    assert.equal(credits, 2000);

    // Verify merchant payable is debited and benefit + mpesa credited
    assert.equal(entries[0].accountType, 'LIABILITY_MERCHANT_PAYABLE');
    assert.equal(entries[0].debitETB, 2000);
  });
});

test('Ledger Persistence & Reconciliation (In-Memory Database)', async (t) => {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE payment_records (
      id TEXT PRIMARY KEY,
      order_id TEXT,
      employee_id TEXT,
      merchant_id TEXT,
      total_etb REAL,
      benefit_etb REAL,
      mpesa_etb REAL,
      status TEXT,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE journal_entries (
      id TEXT PRIMARY KEY,
      payment_id TEXT,
      account_type TEXT,
      debit_etb REAL,
      credit_etb REAL,
      label TEXT,
      created_at TEXT
    );
  `);

  // Insert test payment record
  db.prepare(`
    INSERT INTO payment_records (id, order_id, employee_id, merchant_id, total_etb, benefit_etb, mpesa_etb, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run('pay-001', 'ord-001', 'emp-001', 'mer-001', 2000, 1500, 500, 'COMPLETED', new Date().toISOString(), new Date().toISOString());

  // Post completion entries
  const entries = buildCompletionEntries({ totalETB: 2000, benefitETB: 1500, mpesaETB: 500 });
  postJournalEntries(db, 'pay-001', entries);

  await t.test('retrieves posted journal entries for payment', () => {
    const retrieved = getJournalEntriesForPayment(db, 'pay-001');
    assert.equal(retrieved.length, 3);
    assert.equal(retrieved[0].accountType, 'LIABILITY_EMPLOYER_BENEFIT');
    assert.equal(retrieved[0].debitETB, 1500);
  });

  await t.test('reconciles system with zero discrepancies', () => {
    const report = reconcile(db);
    assert.equal(report.status, 'BALANCED');
    assert.equal(report.totalDebits, 2000);
    assert.equal(report.totalCredits, 2000);
    assert.equal(report.mpesaClearingBalance, 500);
    assert.equal(report.mpesaCallbackTotal, 500);
    assert.equal(report.benefitDebitTotal, 1500);
    assert.equal(report.employerBillableTotal, 1500);
  });
});
