const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

describe('Phase 1: Database Schema Validation', () => {
  const migrationPath = path.resolve(__dirname, '../../supabase/migrations/0001_initial.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');

  test('1.1 Migration file exists and is populated', () => {
    assert.ok(fs.existsSync(migrationPath), '0001_initial.sql must exist');
    assert.ok(sql.length > 1000, 'Migration SQL must not be empty');
  });

  test('1.2 Contains all 13 core tables from blueprint.md', () => {
    const requiredTables = [
      'organizations',
      'merchants',
      'employees',
      'users',
      'refresh_tokens',
      'org_credit_policies',
      'password_reset_requests',
      'transactions',
      'journal_entries',
      'payroll_settlements',
      'payroll_disbursement_lines',
      'audit_log',
      'idempotency_keys',
    ];

    for (const table of requiredTables) {
      const regex = new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`, 'i');
      assert.ok(regex.test(sql), `Table ${table} must be declared in migration`);
    }
  });

  test('1.3 Contains all required ENUM types', () => {
    const requiredEnums = [
      'merchant_category',
      'merchant_status',
      'reset_status',
      'transaction_status',
      'settlement_status',
    ];

    for (const enumType of requiredEnums) {
      assert.ok(sql.includes(`CREATE TYPE ${enumType}`), `Enum ${enumType} must be declared`);
    }
  });

  test('1.4 Contains financial and credit integrity constraints', () => {
    assert.ok(sql.includes('chk_credit_valid'), 'chk_credit_valid constraint must exist');
    assert.ok(sql.includes('chk_amounts_add_up'), 'chk_amounts_add_up constraint must exist');
    assert.ok(sql.includes('NUMERIC(14,2)'), 'Financial numbers must use NUMERIC(14,2)');
  });

  test('1.5 Contains updated_at triggers and functions', () => {
    assert.ok(sql.includes('FUNCTION update_updated_at_column()'), 'Trigger function must exist');
    assert.ok(sql.includes('trg_organizations_updated_at'), 'Organization trigger must exist');
    assert.ok(sql.includes('trg_employees_updated_at'), 'Employees trigger must exist');
    assert.ok(sql.includes('trg_transactions_updated_at'), 'Transactions trigger must exist');
  });
});
