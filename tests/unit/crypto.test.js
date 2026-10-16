const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { generateCompliantPassword, generateSecurePassword } = require('../../src/server/shared/crypto/passwordGenerator');
const { generateEmployeeId, validateEmployeeId, computeChecksum } = require('../../src/server/shared/crypto/employeeIdGenerator');
const { hashPassword, verifyPassword } = require('../../src/server/shared/crypto/argon2');
const { signAccessToken, verifyAccessToken } = require('../../src/server/shared/crypto/jwt');
const { authenticate } = require('../../src/server/shared/middleware/authenticate');
const { requireRole } = require('../../src/server/shared/middleware/requireRole');

describe('Phase 2: Shared Infrastructure & Crypto Utilities', () => {
  describe('2.1 CSPRNG Password Generator', () => {
    test('Generates 16-character compliant passwords', () => {
      const p = generateCompliantPassword(16);
      assert.equal(p.length, 16, 'Password must be exactly 16 characters');
      assert.ok(/[a-z]/.test(p), 'Must contain lowercase');
      assert.ok(/[A-Z]/.test(p), 'Must contain uppercase');
      assert.ok(/[0-9]/.test(p), 'Must contain digits');
      assert.ok(/[!@#$%^&*()]/.test(p), 'Must contain special symbols');
    });

    test('Never contains excluded SMS-breaking characters', () => {
      for (let i = 0; i < 500; i++) {
        const p = generateCompliantPassword(16);
        assert.ok(!/['"`\\]/.test(p), 'Must not contain single quotes, backticks, double quotes, or backslashes');
      }
    });

    test('Passes uniqueness test across 5,000 samples', () => {
      const samples = new Set();
      for (let i = 0; i < 5000; i++) {
        samples.add(generateCompliantPassword(16));
      }
      assert.equal(samples.size, 5000, 'All 5,000 samples must be strictly unique');
    });
  });

  describe('2.2 FlexPay Employee ID Generator', () => {
    test('Generates valid FP-ETH-YYYY-XXXXX-C employee IDs', () => {
      const id = generateEmployeeId('ETH');
      const year = new Date().getFullYear();
      assert.match(id, new RegExp(`^FP-ETH-${year}-[0-9A-Z]{5}-[A-Z]$`));
      const validation = validateEmployeeId(id);
      assert.equal(validation.valid, true, 'Generated ID must pass validation');
    });

    test('Detects single-character substitution tampering via checksum', () => {
      const id = generateEmployeeId('ETH');
      const parts = id.split('-');
      const correctChecksum = parts[4];
      const tamperedChecksum = correctChecksum === 'A' ? 'B' : 'A';
      const tamperedId = `${parts[0]}-${parts[1]}-${parts[2]}-${parts[3]}-${tamperedChecksum}`;

      const validation = validateEmployeeId(tamperedId);
      assert.equal(validation.valid, false, 'Tampered ID must fail checksum validation');
    });

    test('Uniqueness across 1,000 generated IDs', () => {
      const ids = new Set();
      for (let i = 0; i < 1000; i++) {
        ids.add(generateEmployeeId('ETH'));
      }
      assert.equal(ids.size, 1000, 'All 1,000 IDs must be unique');
    });
  });

  describe('2.3 Argon2id Password Hashing', () => {
    test('Hashes and verifies matching password', async () => {
      const plain = generateCompliantPassword();
      const hash = await hashPassword(plain);
      assert.ok(hash.startsWith('$argon2id$'), 'Must be argon2id format');

      const matches = await verifyPassword(hash, plain);
      assert.equal(matches, true, 'Matching password must return true');

      const wrong = await verifyPassword(hash, 'WrongPassword123!');
      assert.equal(wrong, false, 'Mismatched password must return false');
    });
  });

  describe('2.4 JWT RS256 Asymmetric Signing & Verification', () => {
    test('Signs payload and verifies with public key', () => {
      const payload = { sub: 'usr-123', role: 'ORG_ADMIN', orgId: 'org-456' };
      const token = signAccessToken(payload);
      assert.ok(typeof token === 'string', 'Token must be a string');

      const decoded = verifyAccessToken(token);
      assert.equal(decoded.sub, 'usr-123');
      assert.equal(decoded.role, 'ORG_ADMIN');
      assert.equal(decoded.orgId, 'org-456');
    });

    test('Rejects tampered token', () => {
      const token = signAccessToken({ sub: 'user-1' });
      const tampered = token.slice(0, -5) + 'xxxxx';
      assert.throws(() => verifyAccessToken(tampered), 'Tampered token must throw');
    });
  });

  describe('2.5 Authentication & RBAC Middleware', () => {
    test('authenticate middleware blocks missing or malformed header', async () => {
      let codeCalled = null;
      let bodySent = null;
      const fakeReply = {
        code: (c) => {
          codeCalled = c;
          return {
            send: (b) => {
              bodySent = b;
            },
          };
        },
      };

      await authenticate({ headers: {} }, fakeReply);
      assert.equal(codeCalled, 401);
      assert.ok(bodySent.error.includes('Missing or invalid'));

      await authenticate({ headers: { authorization: 'Basic 12345' } }, fakeReply);
      assert.equal(codeCalled, 401);
    });

    test('authenticate middleware sets request.user on valid Bearer token', async () => {
      const token = signAccessToken({ sub: 'emp-999', role: 'EMPLOYEE' });
      const fakeReq = { headers: { authorization: `Bearer ${token}` } };
      let codeCalled = null;
      const fakeReply = {
        code: (c) => {
          codeCalled = c;
          return { send: () => {} };
        },
      };

      await authenticate(fakeReq, fakeReply);
      assert.equal(codeCalled, null, 'Must not return error code for valid token');
      assert.equal(fakeReq.user.sub, 'emp-999');
      assert.equal(fakeReq.user.role, 'EMPLOYEE');
    });

    test('requireRole middleware enforces authorized roles', async () => {
      const adminOnly = requireRole('ORG_ADMIN');
      let codeCalled = null;
      const fakeReply = {
        code: (c) => {
          codeCalled = c;
          return { send: () => {} };
        },
      };

      // Denied for EMPLOYEE
      await adminOnly({ user: { role: 'EMPLOYEE' } }, fakeReply);
      assert.equal(codeCalled, 403);

      // Allowed for ORG_ADMIN
      codeCalled = null;
      await adminOnly({ user: { role: 'ORG_ADMIN' } }, fakeReply);
      assert.equal(codeCalled, null);
    });
  });
});
