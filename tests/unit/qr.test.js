const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { generateQRPayload, verifyQRPayload } = require('../../src/server/shared/crypto/employeeIdGenerator');

const SECRET = 'test-secret-32bytes-xxxxxxxxxxxx';

describe('QR code signing and verification', () => {
  it('verifies a fresh QR payload', () => {
    const payload = generateQRPayload('FP-ETH-2026-A3X9K-Q', 'emp-uuid', 'org-uuid', SECRET);
    const result = verifyQRPayload(payload, SECRET, 300);
    assert.equal(result.valid, true);
    assert.equal(result.fpEmployeeId, 'FP-ETH-2026-A3X9K-Q');
  });

  it('rejects an expired QR payload', () => {
    const payload = generateQRPayload('FP-ETH-2026-A3X9K-Q', 'emp-uuid', 'org-uuid', SECRET);
    const parsed = JSON.parse(payload);
    const stale = JSON.stringify({ ...parsed, ts: parsed.ts - 600 });
    const result = verifyQRPayload(stale, SECRET, 300);
    assert.equal(result.valid, false);
    assert.equal(result.error, 'QR expired');
  });

  it('rejects a tampered QR payload', () => {
    const payload = generateQRPayload('FP-ETH-2026-A3X9K-Q', 'emp-uuid', 'org-uuid', SECRET);
    const parsed = JSON.parse(payload);
    const tampered = JSON.stringify({ ...parsed, sig: 'aaaaaaaaaaaaaaaa' });
    const result = verifyQRPayload(tampered, SECRET, 300);
    assert.equal(result.valid, false);
    assert.equal(result.error, 'Invalid QR signature');
  });
});
