const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
require('dotenv').config();

let cachedConfig = null;

function loadConfig() {
  if (cachedConfig) {
    return cachedConfig;
  }

  const rootDir = path.resolve(__dirname, '../..');

  let privateKey = process.env.JWT_PRIVATE_KEY
    ? process.env.JWT_PRIVATE_KEY.replace(/\\n/g, '\n').replace(/^"|"$/g, '').trim()
    : null;
  let publicKey = process.env.JWT_PUBLIC_KEY
    ? process.env.JWT_PUBLIC_KEY.replace(/\\n/g, '\n').replace(/^"|"$/g, '').trim()
    : null;

  // Check project root or current working directory for PEM files
  const searchDirs = [rootDir, process.cwd()];
  for (const dir of searchDirs) {
    if (!privateKey && fs.existsSync(path.join(dir, 'jwt_private.pem'))) {
      privateKey = fs.readFileSync(path.join(dir, 'jwt_private.pem'), 'utf8').trim();
    }
    if (!publicKey && fs.existsSync(path.join(dir, 'jwt_public.pem'))) {
      publicKey = fs.readFileSync(path.join(dir, 'jwt_public.pem'), 'utf8').trim();
    }
  }

  // If RS256 keys are not provided via environment or files (e.g. initial cloud deploy),
  // automatically generate a compliant 2048-bit RS256 keypair so the server boots cleanly
  if (!privateKey || !publicKey) {
    console.warn('[Config] JWT_PRIVATE_KEY / JWT_PUBLIC_KEY not set. Auto-generating 2048-bit RS256 keypair for session security.');
    const { privateKey: genPriv, publicKey: genPub } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    privateKey = genPriv;
    publicKey = genPub;
  }

  const required = ['DATABASE_URL'];
  const missing = required.filter((k) => !process.env[k]);

  if (missing.length > 0) {
    throw new Error(`Missing required configuration: ${missing.join(', ')}`);
  }

  cachedConfig = {
    PORT: Number(process.env.PORT) || 3001,
    NODE_ENV: process.env.NODE_ENV || 'development',
    CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:5173',
    LOG_LEVEL: process.env.LOG_LEVEL || 'info',
    DATABASE_URL: process.env.DATABASE_URL,
    JWT_PRIVATE_KEY: privateKey,
    JWT_PUBLIC_KEY: publicKey,
    JWT_ACCESS_EXPIRY: Number(process.env.JWT_ACCESS_EXPIRY) || 900,
    JWT_REFRESH_EXPIRY: Number(process.env.JWT_REFRESH_EXPIRY) || 604800,
    MPESA_ENV: process.env.MPESA_ENV || 'sandbox',
    MPESA_BASE_URL: process.env.MPESA_BASE_URL || 'https://apisandbox.safaricom.et',
    MPESA_CONSUMER_KEY: process.env.MPESA_CONSUMER_KEY || '',
    MPESA_CONSUMER_SECRET: process.env.MPESA_CONSUMER_SECRET || '',
    MPESA_SHORTCODE: process.env.MPESA_SHORTCODE || '2005',
    MPESA_PASSKEY: process.env.MPESA_PASSKEY || '',
    MPESA_INITIATOR_NAME: process.env.MPESA_INITIATOR_NAME || 'YellowBusinessInit',
    MPESA_SECURITY_CREDENTIAL: process.env.MPESA_SECURITY_CREDENTIAL || '',
    MPESA_CALLBACK_BASE: process.env.MPESA_CALLBACK_BASE || 'http://localhost:3001',
    AT_API_KEY: process.env.AT_API_KEY || '',
    AT_USERNAME: process.env.AT_USERNAME || 'sandbox',
  };

  return cachedConfig;
}

function clearConfigCache() {
  cachedConfig = null;
}

module.exports = { loadConfig, clearConfigCache };
