/**
 * Safaricom Ethiopia M-PESA Cryptographic & Utility Helpers
 * ==========================================================
 * Implements Ethiopia-specific password hashing and formatting algorithms.
 * Note: Differs from Kenya Daraja by computing Base64 of SHA-256 Hex Digest.
 */

const crypto = require('node:crypto');

/**
 * Generates Safaricom formatted timestamp: YYYYMMDDHHmmss
 * 
 * @param {Date} [date]
 * @returns {string}
 */
function generateTimestamp(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  const year = date.getUTCFullYear();
  const month = pad(date.getUTCMonth() + 1);
  const day = pad(date.getUTCDate());
  const hours = pad(date.getUTCHours());
  const minutes = pad(date.getUTCMinutes());
  const seconds = pad(date.getUTCSeconds());
  return `${year}${month}${day}${hours}${minutes}${seconds}`;
}

/**
 * Generates password for Safaricom Ethiopia STK Push request.
 * Algorithm: Base64(SHA256_HEX(ShortCode + PassKey + Timestamp))
 * 
 * @param {string} shortCode - Business short code (e.g. "2005")
 * @param {string} passKey - Gateway PassKey
 * @param {string} timestamp - Strict YYYYMMDDHHmmss timestamp
 * @returns {string} Base64 encoded SHA256 hex string
 */
function generatePassword(shortCode, passKey, timestamp) {
  const concatenated = String(shortCode) + String(passKey) + String(timestamp);
  const sha256Hex = crypto.createHash('sha256').update(concatenated).digest('hex');
  return Buffer.from(sha256Hex).toString('base64');
}

/**
 * Normalizes phone numbers to Ethiopian format (251XXXXXXXXX).
 * 
 * @param {string} phone
 * @returns {string} Normalized 12-digit string
 */
function formatPhoneNumber(phone) {
  if (!phone) return '';
  let cleaned = String(phone).replace(/\D/g, '');

  // Handle leading 0 (e.g., 0912345678 -> 251912345678)
  if (cleaned.startsWith('0') && cleaned.length === 10) {
    cleaned = '251' + cleaned.substring(1);
  }

  // Handle 912345678 -> 251912345678
  if (cleaned.startsWith('9') && cleaned.length === 9) {
    cleaned = '251' + cleaned;
  }

  // Handle 712345678 -> 251712345678 (Safaricom prefix)
  if (cleaned.startsWith('7') && cleaned.length === 9) {
    cleaned = '251' + cleaned;
  }

  return cleaned;
}

module.exports = {
  generateTimestamp,
  generatePassword,
  formatPhoneNumber,
};
