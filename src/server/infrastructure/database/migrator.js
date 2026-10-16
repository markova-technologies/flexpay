const fs = require('node:fs');
const path = require('node:path');
const { getPool } = require('./client');

/**
 * Ensures the PostgreSQL database has the authoritative v2 schema.
 * If legacy v1 tables (missing tin_number) or empty database is detected,
 * runs the comprehensive v2 DDL definitions from supabase/schema.sql.
 */
async function ensureSchema() {
  let pool;
  try {
    pool = getPool();
  } catch (err) {
    console.warn('[Migrator] Unable to initialize database pool for schema verification:', err.message);
    return;
  }

  try {
    // Check if the organizations table exists and has the required v2 'tin_number' column
    const checkRes = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'organizations' AND column_name = 'tin_number';
    `);

    if (checkRes.rows.length > 0) {
      console.log('[Migrator] FlexPay v2 schema is verified and up-to-date.');
      return;
    }

    console.log('[Migrator] Missing or legacy database schema detected. Migrating to authoritative v2 schema...');

    // Drop conflicting legacy tables if they exist from v1
    const legacyDropSql = `
      DROP TABLE IF EXISTS journal_entries CASCADE;
      DROP TABLE IF EXISTS webhook_events CASCADE;
      DROP TABLE IF EXISTS payment_records CASCADE;
      DROP TABLE IF EXISTS orders CASCADE;
      DROP TABLE IF EXISTS benefit_policies CASCADE;
      DROP TABLE IF EXISTS benefit_wallets CASCADE;
      DROP TABLE IF EXISTS benefit_accounts CASCADE;
      DROP TABLE IF EXISTS refresh_tokens CASCADE;
      DROP TABLE IF EXISTS password_reset_requests CASCADE;
      DROP TABLE IF EXISTS settlement_lines CASCADE;
      DROP TABLE IF EXISTS settlement_runs CASCADE;
      DROP TABLE IF EXISTS split_transactions CASCADE;
      DROP TABLE IF EXISTS stk_push_records CASCADE;
      DROP TABLE IF EXISTS transactions CASCADE;
      DROP TABLE IF EXISTS org_credit_policies CASCADE;
      DROP TABLE IF EXISTS users CASCADE;
      DROP TABLE IF EXISTS employees CASCADE;
      DROP TABLE IF EXISTS merchants CASCADE;
      DROP TABLE IF EXISTS organizations CASCADE;
      DROP TABLE IF EXISTS audit_log CASCADE;
      DROP TABLE IF EXISTS idempotency_keys CASCADE;
    `;
    await pool.query(legacyDropSql);

    // Locate and execute supabase/schema.sql
    const possiblePaths = [
      path.resolve(__dirname, '../../../../supabase/schema.sql'),
      path.resolve(process.cwd(), 'supabase/schema.sql'),
      path.resolve(__dirname, '../../../../supabase/migrations/0001_initial.sql'),
      path.resolve(process.cwd(), 'supabase/migrations/0001_initial.sql'),
    ];

    let applied = false;
    for (const schemaPath of possiblePaths) {
      if (fs.existsSync(schemaPath)) {
        const sql = fs.readFileSync(schemaPath, 'utf8');
        await pool.query(sql);
        console.log(`[Migrator] Applied authoritative schema from ${schemaPath}`);
        applied = true;
        break;
      }
    }

    if (!applied) {
      console.error('[Migrator] Could not locate supabase/schema.sql to apply schema.');
    }
  } catch (err) {
    console.error('[Migrator] Database schema verification or migration failed:', err.message);
  }
}

module.exports = { ensureSchema };
