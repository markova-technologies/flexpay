const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { loadConfig } = require('../../src/server/config');
const { buildServer } = require('../../src/server/index');
const { getDb } = require('../../src/server/infrastructure/database/client');

describe('Phase 0: Environment Setup & Project Scaffold', () => {
  test('0.1 Config loads required environment variables without errors', () => {
    const config = loadConfig();
    assert.ok(config.PORT, 'PORT must be set');
    assert.ok(config.DATABASE_URL, 'DATABASE_URL must be set');
    assert.ok(config.JWT_PRIVATE_KEY, 'JWT_PRIVATE_KEY must be loaded');
    assert.ok(config.JWT_PUBLIC_KEY, 'JWT_PUBLIC_KEY must be loaded');
    assert.ok(config.JWT_PRIVATE_KEY.includes('BEGIN'), 'JWT_PRIVATE_KEY format valid');
    assert.ok(config.JWT_PUBLIC_KEY.includes('BEGIN'), 'JWT_PUBLIC_KEY format valid');
  });

  test('0.2 Fastify server boots and GET /health returns { status: "ok" }', async () => {
    const server = await buildServer({ logger: false });
    const response = await server.inject({
      method: 'GET',
      url: '/health',
    });

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.payload);
    assert.equal(body.status, 'ok');
    assert.ok(body.timestamp, 'timestamp must be present');
    await server.close();
  });

  test('0.3 Database client instance initializes properly', () => {
    const db = getDb();
    assert.ok(db, 'Kysely db instance must exist');
    assert.equal(typeof db.selectFrom, 'function', 'db should have selectFrom query builder');
  });
});
