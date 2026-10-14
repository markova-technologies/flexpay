/**
 * FlexPay Authentication & Token Domain
 * =====================================
 * Zero-dependency HMAC-SHA256 JWT tokens and PIN verification.
 * Standard claims: { userId, email, role, entityId, name, exp, iat }
 */

const crypto = require('node:crypto');
const config = require('../config.js');
const { getDb } = require('../storage/db.js');

const PIN_SALT = 'flexpay_salt_2026';

/**
 * Deterministic secure PIN hash
 */
function hashPin(pin, salt = PIN_SALT) {
  return crypto.createHmac('sha256', salt).update(String(pin)).digest('hex');
}

/**
 * Issues an RFC-compliant HS256 JWT
 */
function signToken(payload, secret = config.jwtSecret, expiresInSeconds = 86400) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const iat = Math.floor(Date.now() / 1000);
  const fullPayload = { ...payload, exp, iat };

  const b64Header = Buffer.from(JSON.stringify(header)).toString('base64url');
  const b64Payload = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${b64Header}.${b64Payload}`)
    .digest('base64url');

  return `${b64Header}.${b64Payload}.${signature}`;
}

/**
 * Validates and decodes an HS256 JWT
 */
function verifyToken(token, secret = config.jwtSecret) {
  if (!token || typeof token !== 'string') {
    throw new Error('Token is required');
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid token structure');
  }

  const [b64Header, b64Payload, signature] = parts;
  const expectedSig = crypto
    .createHmac('sha256', secret)
    .update(`${b64Header}.${b64Payload}`)
    .digest('base64url');

  if (signature !== expectedSig) {
    throw new Error('Invalid token signature');
  }

  const payload = JSON.parse(Buffer.from(b64Payload, 'base64url').toString('utf8'));
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < now) {
    throw new Error('Token has expired');
  }

  return payload;
}

/**
 * Authenticates user credentials (email + 4-digit PIN)
 */
function login(email, pin) {
  if (!email || !pin) {
    throw new Error('Email and PIN are required');
  }

  const db = getDb();
  const normalizedEmail = String(email).trim().toLowerCase();
  const user = db.prepare('SELECT * FROM users WHERE LOWER(email) = ? AND is_active = 1').get(normalizedEmail);

  if (!user) {
    throw new Error('Invalid email or PIN');
  }

  const hashedInput = hashPin(pin);
  if (user.pin_hash !== hashedInput) {
    throw new Error('Invalid email or PIN');
  }

  const payload = {
    userId: user.id,
    email: user.email,
    role: user.role,
    entityId: user.entity_id,
    name: user.name,
  };

  const token = signToken(payload);

  return {
    token,
    user: payload,
  };
}

/**
 * Fetches user profile by ID without sensitive fields
 */
function getUserById(userId) {
  const db = getDb();
  const user = db.prepare('SELECT id, email, role, entity_id, name, is_active, created_at FROM users WHERE id = ?').get(userId);
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    entityId: user.entity_id,
    name: user.name,
  };
}

module.exports = {
  hashPin,
  signToken,
  verifyToken,
  login,
  getUserById,
};
