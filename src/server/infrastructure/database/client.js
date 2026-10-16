const { Kysely, PostgresDialect } = require('kysely');
const { Pool } = require('pg');
const { loadConfig } = require('../../config');

let db = null;
let pool = null;

function getDb() {
  if (!db) {
    const config = loadConfig();
    const isLocal = config.DATABASE_URL.includes('localhost') || config.DATABASE_URL.includes('127.0.0.1');
    pool = new Pool({
      connectionString: config.DATABASE_URL,
      ssl: isLocal ? false : { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    db = new Kysely({
      dialect: new PostgresDialect({ pool }),
    });
  }
  return db;
}

function getPool() {
  if (!pool) getDb();
  return pool;
}

async function closeDb() {
  if (pool) {
    await pool.end();
    pool = null;
    db = null;
  }
}

module.exports = { getDb, getPool, closeDb };
