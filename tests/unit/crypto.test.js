const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { generateTimestamp, generatePassword, formatPhoneNumber } = require('../../src/server/mpesa/crypto.js');

test('Safaricom Ethiopia Cryptographic Functions', async (t) => {
  await t.test('formats timestamp as YYYYMMDDHHmmss string with 14 characters', () => {
    const d = new Date(Date.UTC(2026, 9, 13, 14, 30, 45)); // Month is 0-indexed: 9 = October
    const ts = generateTimestamp(d);
    assert.equal(ts, '20261013143045');
    assert.equal(ts.length, 14);
  });

  await t.test('calculates Base64(SHA256_HEX(ShortCode + PassKey + Timestamp))', () => {
    const shortCode = '2005';
    const passKey = 'test_passkey_123';
    const timestamp = '20261013143045';

    const pwd = generatePassword(shortCode, passKey, timestamp);

    // Verify step-by-step
    const raw = shortCode + passKey + timestamp;
    const shaHex = crypto.createHash('sha256').update(raw).digest('hex');
    const expected = Buffer.from(shaHex).toString('base64');

    assert.equal(pwd, expected);
  });

  await t.test('normalizes various Ethiopian phone number formats to 251XXXXXXXXX', () => {
    assert.equal(formatPhoneNumber('0912345678'), '251912345678');
    assert.equal(formatPhoneNumber('+251912345678'), '251912345678');
    assert.equal(formatPhoneNumber('251912345678'), '251912345678');
    assert.equal(formatPhoneNumber('912345678'), '251912345678');
    assert.equal(formatPhoneNumber('0712345678'), '251712345678');
    assert.equal(formatPhoneNumber('712345678'), '251712345678');
  });
});
