/**
 * Safaricom Ethiopia M-PESA Live REST Client
 * ===========================================
 * Handles OAuth 2.0 token caching and API communications with Safaricom Ethiopia.
 */

const crypto = require('node:crypto');
const { generateTimestamp, generatePassword, formatPhoneNumber } = require('./crypto.js');

class SafaricomClient {
  constructor(config) {
    this.baseUrl = config.baseUrl || 'https://apisandbox.safaricom.et';
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.passkey = config.passkey;
    this.shortCode = config.shortCode || '2005';
    this.callbackUrl = config.callbackUrl;
    
    // In-memory token cache
    this.cachedToken = null;
    this.tokenExpiresAt = 0;
  }

  /**
   * Retrieves or refreshes OAuth 2.0 bearer token.
   * Caches token with 60-second safety window.
   * 
   * @returns {Promise<string>} Access token
   */
  async getAccessToken() {
    const now = Date.now();
    if (this.cachedToken && this.tokenExpiresAt - now > 60000) {
      return this.cachedToken;
    }

    if (!this.clientId || !this.clientSecret) {
      throw new Error('Missing Safaricom OAuth credentials (clientId or clientSecret)');
    }

    const authHeader = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
    const tokenUrl = `${this.baseUrl}/v1/token/generate?grant_type=client_credentials`;

    const response = await fetch(tokenUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${authHeader}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Safaricom OAuth authentication failed: HTTP ${response.status} - ${errText}`);
    }

    const data = await response.json();
    const expiresInSeconds = parseInt(data.expires_in, 10) || 3599;

    this.cachedToken = data.access_token;
    this.tokenExpiresAt = now + (expiresInSeconds * 1000);

    return this.cachedToken;
  }

  /**
   * Dispatches USSD Push / STK Push request to Safaricom Ethiopia.
   * 
   * @param {Object} params
   * @param {number} params.amount
   * @param {string} params.phoneNumber
   * @param {string} params.accountReference
   * @param {string} [params.transactionDesc]
   * @returns {Promise<Object>} Safaricom response
   */
  async initiateStkPush({ amount, phoneNumber, accountReference, transactionDesc = 'FlexPay Benefit Co-Pay' }) {
    const token = await this.getAccessToken();
    const timestamp = generateTimestamp();
    const password = generatePassword(this.shortCode, this.passkey, timestamp);
    const formattedPhone = formatPhoneNumber(phoneNumber);
    const merchantRequestId = `FlexPay-${crypto.randomUUID()}`;

    const payload = {
      MerchantRequestID: merchantRequestId,
      BusinessShortCode: this.shortCode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: Math.round(amount),
      PartyA: formattedPhone,
      PartyB: this.shortCode,
      PhoneNumber: formattedPhone,
      CallBackURL: this.callbackUrl,
      AccountReference: accountReference,
      TransactionDesc: transactionDesc,
      ReferenceData: [
        {
          Key: 'ThirdPartyReference',
          Value: merchantRequestId,
        },
      ],
    };

    const response = await fetch(`${this.baseUrl}/mpesa/stkpush/v3/processrequest`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Safaricom STK push failed: HTTP ${response.status} - ${errText}`);
    }

    const data = await response.json();
    return {
      merchantRequestId: data.MerchantRequestID || merchantRequestId,
      checkoutRequestId: data.CheckoutRequestID,
      responseCode: data.ResponseCode,
      responseDescription: data.ResponseDescription,
      customerMessage: data.CustomerMessage,
    };
  }

  /**
   * Queries transaction status by M-PESA receipt number.
   * 
   * @param {Object} params
   * @param {string} params.receiptNumber
   * @param {string} [params.initiator]
   * @param {string} [params.securityCredential]
   * @returns {Promise<Object>}
   */
  async queryTransactionStatus({ receiptNumber, initiator, securityCredential }) {
    const token = await this.getAccessToken();

    const payload = {
      Initiator: initiator,
      SecurityCredential: securityCredential,
      CommandID: 'TransactionStatusQuery',
      TransactionID: receiptNumber,
      PartyA: this.shortCode,
      IdentifierType: '4',
      ResultURL: `${this.callbackUrl}/status-result`,
      QueueTimeOutURL: `${this.callbackUrl}/timeout`,
      Remarks: 'FlexPay Status Audit',
      Occasion: 'Audit',
    };

    const response = await fetch(`${this.baseUrl}/mpesa/transactionstatus/v1/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Safaricom status query failed: HTTP ${response.status} - ${errText}`);
    }

    return await response.json();
  }
}

module.exports = SafaricomClient;
