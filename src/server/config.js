require('dotenv').config();

const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  dbPath: process.env.DB_PATH || 'data/flexpay.sqlite',

  jwtSecret: process.env.JWT_SECRET || 'flexpay_secret_addis_key_2026',

  // Safaricom Ethiopia M-PESA parameters
  safaricom: {
    env: process.env.SAFARICOM_ENV || 'mock', // 'sandbox' | 'production' | 'mock'
    baseUrl: process.env.SAFARICOM_BASE_URL || 'https://apisandbox.safaricom.et',
    clientId: process.env.SAFARICOM_CLIENT_ID || '',
    clientSecret: process.env.SAFARICOM_CLIENT_SECRET || '',
    passkey: process.env.SAFARICOM_PASSKEY || '',
    shortCode: process.env.SAFARICOM_SHORTCODE || '2005',
    initiator: process.env.SAFARICOM_INITIATOR || 'YellowBusinessInit',
    securityCredential: process.env.SAFARICOM_SECURITY_CREDENTIAL || '',
    callbackUrl: process.env.SAFARICOM_CALLBACK_URL || 'http://localhost:4000/api/mpesa/callback',
  },
};

module.exports = config;
