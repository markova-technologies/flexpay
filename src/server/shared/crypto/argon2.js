const argon2 = require('argon2');

const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 65536, // 64MB memory cost
  timeCost: 3, // 3 iterations
  parallelism: 4, // 4 threads
};

async function hashPassword(plaintext) {
  if (!plaintext || typeof plaintext !== 'string') {
    throw new Error('Password to hash must be a non-empty string');
  }
  return argon2.hash(plaintext, ARGON2_OPTIONS);
}

async function verifyPassword(hash, plaintext) {
  if (!hash || !plaintext) return false;
  try {
    return await argon2.verify(hash, plaintext);
  } catch {
    return false;
  }
}

module.exports = { hashPassword, verifyPassword };
