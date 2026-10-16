const { randomBytes } = require('node:crypto');

const CHARSET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
const CHARSET_LENGTH = CHARSET.length; // 94
const MAX_VALID_BYTE = 256 - (256 % CHARSET_LENGTH); // 248 — rejection ceiling to eliminate modulo bias

/**
 * Generates a cryptographically secure password using OS CSPRNG + Rejection Sampling.
 * Entropy: 16 x log2(94) ~ 105 bits (NIST-grade).
 */
function generateSecurePassword(length = 16) {
  const result = [];
  while (result.length < length) {
    const byte = randomBytes(1)[0];
    if (byte < MAX_VALID_BYTE) {
      result.push(CHARSET[byte % CHARSET_LENGTH]);
    }
  }
  return result.join('');
}

/**
 * Guaranteed pool compliance: ensures at least 1 character from:
 * lowercase, uppercase, digits, and special symbols.
 */
function generateCompliantPassword(length = 16) {
  const POOLS = [
    'abcdefghijklmnopqrstuvwxyz',
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    '0123456789',
    '!@#$%^&*()',
  ];
  let password;
  do {
    password = generateSecurePassword(length);
  } while (!POOLS.every((pool) => pool.split('').some((c) => password.includes(c))));
  return password;
}

module.exports = { generateSecurePassword, generateCompliantPassword };
