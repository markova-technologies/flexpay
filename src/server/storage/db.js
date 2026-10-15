const { DatabaseSync } = require('node:sqlite');
const { Pool } = require('pg');
const path = require('node:path');
const fs = require('node:fs');
const config = require('../config.js');

let instance = null;

function isPostgres(url = config.databaseUrl) {
  return typeof url === 'string' && (url.startsWith('postgres://') || url.startsWith('postgresql://'));
}

function toPgSql(sql) {
  let paramIndex = 1;
  return sql.replace(/\?/g, () => `$${paramIndex++}`);
}

function createPostgresAdapter(connString) {
  const pool = new Pool({
    connectionString: connString,
    ssl: { rejectUnauthorized: false },
  });

  return {
    _type: 'postgres',
    pool,
    prepare(sql) {
      const pgSql = toPgSql(sql);
      return {
        get: async (...params) => {
          const res = await pool.query(pgSql, params.flat());
          return res.rows[0];
        },
        all: async (...params) => {
          const res = await pool.query(pgSql, params.flat());
          return res.rows;
        },
        run: async (...params) => {
          const res = await pool.query(pgSql, params.flat());
          return { changes: res.rowCount };
        },
      };
    },
    exec: async (sql) => {
      return pool.query(sql);
    },
  };
}

function getDb(dbPath = config.dbPath) {
  if (instance) return instance;

  if (isPostgres()) {
    console.log('[Database] Connecting to Supabase PostgreSQL...');
    instance = createPostgresAdapter(config.databaseUrl);
    return instance;
  }

  // Ensure data directory exists if writing to file
  if (dbPath !== ':memory:') {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  const db = new DatabaseSync(dbPath);

  // Configure pragmas
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
  `);

  initSchema(db);
  seedInitialData(db);

  instance = db;
  return db;
}

function initSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS merchants (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      allowed_categories TEXT NOT NULL,
      short_code TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS employees (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT NOT NULL UNIQUE,
      employer_id TEXT NOT NULL,
      employer_name TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS benefit_accounts (
      employee_id TEXT PRIMARY KEY REFERENCES employees(id),
      employer_name TEXT NOT NULL,
      total_allowance_etb REAL NOT NULL,
      used_allowance_etb REAL NOT NULL DEFAULT 0,
      salary_link_limit_etb REAL NOT NULL DEFAULT 0,
      used_salary_link_etb REAL NOT NULL DEFAULT 0,
      expires_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      employee_id TEXT NOT NULL REFERENCES employees(id),
      merchant_id TEXT NOT NULL REFERENCES merchants(id),
      customer_phone TEXT NOT NULL,
      total_etb REAL NOT NULL,
      benefit_covered_etb REAL NOT NULL,
      employee_copay_etb REAL NOT NULL,
      is_eligible INTEGER NOT NULL,
      rejection_reason TEXT,
      items_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS payment_records (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL REFERENCES orders(id),
      employee_id TEXT NOT NULL REFERENCES employees(id),
      merchant_id TEXT NOT NULL REFERENCES merchants(id),
      total_etb REAL NOT NULL,
      benefit_etb REAL NOT NULL,
      mpesa_etb REAL NOT NULL,
      status TEXT NOT NULL,
      merchant_request_id TEXT UNIQUE,
      checkout_request_id TEXT UNIQUE,
      mpesa_receipt_number TEXT,
      refund_reason TEXT,
      raw_callback_json TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS journal_entries (
      id TEXT PRIMARY KEY,
      payment_id TEXT NOT NULL REFERENCES payment_records(id),
      account_type TEXT NOT NULL,
      debit_etb REAL NOT NULL DEFAULT 0,
      credit_etb REAL NOT NULL DEFAULT 0,
      label TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS webhook_events (
      id TEXT PRIMARY KEY,
      checkout_request_id TEXT NOT NULL,
      result_code INTEGER NOT NULL,
      payload_json TEXT NOT NULL,
      processed_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS organizations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      benefit_pool_etb REAL NOT NULL DEFAULT 0,
      used_pool_etb REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      pin_hash TEXT NOT NULL,
      role TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      name TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS benefit_wallets (
      id TEXT PRIMARY KEY,
      employee_id TEXT NOT NULL REFERENCES employees(id),
      category TEXT NOT NULL,
      monthly_limit_etb REAL NOT NULL,
      used_etb REAL NOT NULL DEFAULT 0,
      cycle_reset_date TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(employee_id, category)
    );

    CREATE TABLE IF NOT EXISTS benefit_policies (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL REFERENCES organizations(id),
      category TEXT NOT NULL,
      monthly_limit_etb REAL NOT NULL,
      eligible_merchant_categories TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      UNIQUE(org_id, category)
    );

    CREATE TABLE IF NOT EXISTS auth_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      token_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  try {
    db.exec(`ALTER TABLE payment_records ADD COLUMN benefit_breakdown_json TEXT;`);
  } catch (e) {
    // Column already exists
  }
}

const crypto = require('node:crypto');
function hashPin(pin, salt = 'flexpay_salt_2026') {
  return crypto.createHmac('sha256', salt).update(String(pin)).digest('hex');
}

function seedInitialData(db) {
  const now = new Date().toISOString();

  // 1. Seed merchants if empty
  const merchantCheck = db.prepare('SELECT COUNT(*) AS count FROM merchants').get();
  if (merchantCheck.count === 0) {
    const insertMerchant = db.prepare(`
      INSERT INTO merchants (id, name, category, status, allowed_categories, short_code, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    insertMerchant.run('mer-001', 'Yod Abyssinia Market', 'GROCERY', 'ACTIVE', JSON.stringify(['GROCERY', 'MEAL']), '2005', now);
    insertMerchant.run('mer-002', 'Electronics Paradise', 'ELECTRONICS', 'ACTIVE', JSON.stringify(['GROCERY', 'MEAL']), '2006', now);
    insertMerchant.run('mer-003', 'Addis Café', 'MEAL', 'ACTIVE', JSON.stringify(['GROCERY', 'MEAL']), '2007', now);
  }

  // 2. Seed organizations if empty
  const orgCheck = db.prepare('SELECT COUNT(*) AS count FROM organizations').get();
  if (orgCheck.count === 0) {
    const insertOrg = db.prepare(`
      INSERT INTO organizations (id, name, benefit_pool_etb, used_pool_etb, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    insertOrg.run('org-001', 'Ethio Telecom', 500000, 145000, now);
    insertOrg.run('org-002', 'Commercial Bank of Ethiopia', 350000, 82000, now);
  }

  // 3. Seed employees if empty
  const employeeCheck = db.prepare('SELECT COUNT(*) AS count FROM employees').get();
  if (employeeCheck.count === 0) {
    const insertEmployee = db.prepare(`
      INSERT INTO employees (id, name, phone, employer_id, employer_name, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    insertEmployee.run('emp-001', 'Abebe Kebede', '251912345678', 'org-001', 'Ethio Telecom', now);
    insertEmployee.run('emp-002', 'Sara Haile', '251911987654', 'org-002', 'Commercial Bank of Ethiopia', now);
  }

  // 4. Seed benefit accounts (PayLater credit limit & overall link) if empty
  const baCheck = db.prepare('SELECT COUNT(*) AS count FROM benefit_accounts').get();
  if (baCheck.count === 0) {
    const insertBenefit = db.prepare(`
      INSERT INTO benefit_accounts (employee_id, employer_name, total_allowance_etb, used_allowance_etb, salary_link_limit_etb, used_salary_link_etb, expires_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertBenefit.run('emp-001', 'Ethio Telecom', 3000, 1500, 2000, 500, '2026-10-31T23:59:59Z', now);
    insertBenefit.run('emp-002', 'Commercial Bank of Ethiopia', 2000, 2000, 1500, 0, '2026-10-31T23:59:59Z', now);
  }

  // 5. Seed benefit policies (Org-level) if empty
  const polCheck = db.prepare('SELECT COUNT(*) AS count FROM benefit_policies').get();
  if (polCheck.count === 0) {
    const insertPolicy = db.prepare(`
      INSERT INTO benefit_policies (id, org_id, category, monthly_limit_etb, eligible_merchant_categories, is_active, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    // Ethio Telecom policies
    insertPolicy.run('pol-001', 'org-001', 'FOOD', 2000, JSON.stringify(['MEAL', 'GROCERY']), 1, now);
    insertPolicy.run('pol-002', 'org-001', 'TRANSPORT', 800, JSON.stringify(['TRANSPORT']), 1, now);
    insertPolicy.run('pol-003', 'org-001', 'HEALTH', 500, JSON.stringify(['PHARMACY', 'CLINIC']), 1, now);

    // CBE policies
    insertPolicy.run('pol-004', 'org-002', 'FOOD', 1500, JSON.stringify(['MEAL', 'GROCERY']), 1, now);
    insertPolicy.run('pol-005', 'org-002', 'TRANSPORT', 600, JSON.stringify(['TRANSPORT']), 1, now);
    insertPolicy.run('pol-006', 'org-002', 'HEALTH', 400, JSON.stringify(['PHARMACY', 'CLINIC']), 1, now);
  }

  // 6. Seed benefit wallets (per-category per-employee) if empty
  const walletCheck = db.prepare('SELECT COUNT(*) AS count FROM benefit_wallets').get();
  if (walletCheck.count === 0) {
    const insertWallet = db.prepare(`
      INSERT INTO benefit_wallets (id, employee_id, category, monthly_limit_etb, used_etb, cycle_reset_date, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const resetDate = '2026-10-31T23:59:59Z';
    // Abebe Kebede: Food 1,500 available (2000 - 500), Transport 300 available (800 - 500), Health 500 available (500 - 0)
    insertWallet.run('wal-001', 'emp-001', 'FOOD', 2000, 500, resetDate, now);
    insertWallet.run('wal-002', 'emp-001', 'TRANSPORT', 800, 500, resetDate, now);
    insertWallet.run('wal-003', 'emp-001', 'HEALTH', 500, 0, resetDate, now);

    // Sara Haile: Food 0 available (1500 - 1500), Transport 400 available (600 - 200), Health 300 available (400 - 100)
    insertWallet.run('wal-004', 'emp-002', 'FOOD', 1500, 1500, resetDate, now);
    insertWallet.run('wal-005', 'emp-002', 'TRANSPORT', 600, 200, resetDate, now);
    insertWallet.run('wal-006', 'emp-002', 'HEALTH', 400, 100, resetDate, now);
  }

  // 7. Seed demo users for all 4 roles if empty
  const userCheck = db.prepare('SELECT COUNT(*) AS count FROM users').get();
  if (userCheck.count === 0) {
    const insertUser = db.prepare(`
      INSERT INTO users (id, email, pin_hash, role, entity_id, name, is_active, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertUser.run('usr-001', 'abebe@ethiotelecom.et', hashPin('1234'), 'EMPLOYEE', 'emp-001', 'Abebe Kebede', 1, now);
    insertUser.run('usr-002', 'sara@cbe.et', hashPin('1234'), 'EMPLOYEE', 'emp-002', 'Sara Haile', 1, now);
    insertUser.run('usr-003', 'hr@ethiotelecom.et', hashPin('5678'), 'EMPLOYER_ADMIN', 'org-001', 'Ethio Telecom HR', 1, now);
    insertUser.run('usr-004', 'hr@cbe.et', hashPin('5678'), 'EMPLOYER_ADMIN', 'org-002', 'CBE Benefits Admin', 1, now);
    insertUser.run('usr-005', 'yod@abyssinia.et', hashPin('9012'), 'MERCHANT', 'mer-001', 'Yod Abyssinia Manager', 1, now);
    insertUser.run('usr-006', 'addiscafe@addis.et', hashPin('9012'), 'MERCHANT', 'mer-003', 'Addis Café Cashier', 1, now);
    insertUser.run('usr-007', 'ops@flexpay.et', hashPin('0000'), 'FLEXPAY_ADMIN', 'admin-001', 'FlexPay Ops Officer', 1, now);
  }

  // 8. Seed historical orders & payment records if empty
  const orderCheck = db.prepare('SELECT COUNT(*) AS count FROM orders').get();
  if (orderCheck.count === 0) {
    const insertOrder = db.prepare(`
      INSERT INTO orders (id, employee_id, merchant_id, customer_phone, total_etb, benefit_covered_etb, employee_copay_etb, is_eligible, rejection_reason, items_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertPayment = db.prepare(`
      INSERT INTO payment_records (id, order_id, employee_id, merchant_id, total_etb, benefit_etb, mpesa_etb, status, mpesa_receipt_number, refund_reason, benefit_breakdown_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertJournal = db.prepare(`
      INSERT INTO journal_entries (id, payment_id, account_type, debit_etb, credit_etb, label, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    // Historical 1: Completed co-pay (ETB 2,000 -> 1,500 Benefit + 500 M-PESA)
    const splitBreakdown1 = JSON.stringify([{ category: 'FOOD', amount: 1500 }]);
    insertOrder.run('ord-hist-001', 'emp-001', 'mer-001', '251912345678', 2000, 1500, 500, 1, null, '[]', '2026-10-12T10:30:00Z');
    insertPayment.run('pay-hist-001', 'ord-hist-001', 'emp-001', 'mer-001', 2000, 1500, 500, 'COMPLETED', 'SD9876EFGH', null, splitBreakdown1, '2026-10-12T10:30:00Z', '2026-10-12T10:30:45Z');
    insertJournal.run('j-001', 'pay-hist-001', 'LIABILITY_EMPLOYER_BENEFIT', 1500, 0, 'Employer Benefit Debit', '2026-10-12T10:30:45Z');
    insertJournal.run('j-002', 'pay-hist-001', 'ASSET_MPESA_CLEARING', 500, 0, 'M-PESA Clearing Debit', '2026-10-12T10:30:45Z');
    insertJournal.run('j-003', 'pay-hist-001', 'LIABILITY_MERCHANT_PAYABLE', 0, 2000, 'Merchant Payable Credit', '2026-10-12T10:30:45Z');

    // Historical 2: 100% Benefit covered (ETB 450)
    const splitBreakdown2 = JSON.stringify([{ category: 'FOOD', amount: 450 }]);
    insertOrder.run('ord-hist-002', 'emp-001', 'mer-003', '251912345678', 450, 450, 0, 1, null, '[]', '2026-10-11T08:15:00Z');
    insertPayment.run('pay-hist-002', 'ord-hist-002', 'emp-001', 'mer-003', 450, 450, 0, 'COMPLETED', null, null, splitBreakdown2, '2026-10-11T08:15:00Z', '2026-10-11T08:15:10Z');
    insertJournal.run('j-004', 'pay-hist-002', 'LIABILITY_EMPLOYER_BENEFIT', 450, 0, 'Employer Benefit Debit', '2026-10-11T08:15:10Z');
    insertJournal.run('j-005', 'pay-hist-002', 'LIABILITY_MERCHANT_PAYABLE', 0, 450, 'Merchant Payable Credit', '2026-10-11T08:15:10Z');

    // Historical 3: Declined payment (ETB 1,200)
    insertOrder.run('ord-hist-003', 'emp-001', 'mer-001', '251912345678', 1200, 1050, 150, 1, null, '[]', '2026-10-10T14:22:00Z');
    insertPayment.run('pay-hist-003', 'ord-hist-003', 'emp-001', 'mer-001', 1200, 1050, 150, 'FAILED_REJECTED', null, null, null, '2026-10-10T14:22:00Z', '2026-10-10T14:23:05Z');

    // Historical 4: Reversed / Refunded payment (ETB 800)
    const splitBreakdown4 = JSON.stringify([{ category: 'FOOD', amount: 800 }]);
    insertOrder.run('ord-hist-004', 'emp-001', 'mer-001', '251912345678', 800, 800, 0, 1, null, '[]', '2026-10-09T16:00:00Z');
    insertPayment.run('pay-hist-004', 'ord-hist-004', 'emp-001', 'mer-001', 800, 800, 0, 'REVERSED', 'SD1111AAAA', 'Merchant could not fulfill order', splitBreakdown4, '2026-10-09T16:00:00Z', '2026-10-09T17:30:00Z');
    insertJournal.run('j-006', 'pay-hist-004', 'LIABILITY_EMPLOYER_BENEFIT', 800, 0, 'Employer Benefit Debit', '2026-10-09T16:00:00Z');
    insertJournal.run('j-007', 'pay-hist-004', 'LIABILITY_MERCHANT_PAYABLE', 0, 800, 'Merchant Payable Credit', '2026-10-09T16:00:00Z');
    insertJournal.run('j-008', 'pay-hist-004', 'LIABILITY_MERCHANT_PAYABLE', 800, 0, 'Reversal: Merchant Payable Debit', '2026-10-09T17:30:00Z');
    insertJournal.run('j-009', 'pay-hist-004', 'LIABILITY_EMPLOYER_BENEFIT', 0, 800, 'Reversal: Benefit Restored', '2026-10-09T17:30:00Z');
  }
}

function resetDbForTesting(db) {
  instance = null;
}

module.exports = {
  getDb,
  resetDbForTesting,
};
