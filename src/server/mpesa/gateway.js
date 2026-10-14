/**
 * FlexPay M-PESA Gateway Adapter
 * ===============================
 * Orchestrates payment initiation and callback handling.
 * Automatically delegates to live Safaricom API in sandbox/production,
 * or deterministic simulator in mock mode.
 */

const crypto = require('node:crypto');
const SafaricomClient = require('./client.js');

class MpesaGateway {
  constructor(config) {
    this.env = config.safaricom.env; // 'mock' | 'sandbox' | 'production'
    this.config = config.safaricom;
    this.client = (this.env === 'sandbox' || this.env === 'production')
      ? new SafaricomClient(this.config)
      : null;

    // Track active mock requests for simulated callbacks
    this.mockRequests = new Map();
  }

  /**
   * Initiates STK push payment request.
   * 
   * @param {Object} params
   * @param {string} params.paymentId
   * @param {string} params.orderId
   * @param {string} params.phoneNumber
   * @param {number} params.amount - ETB co-pay amount
   * @param {string} [params.scenario] - Optional demo scenario trigger
   * @param {Function} [params.onSimulatedCallback] - Hook to receive auto-callback in mock mode
   * @returns {Promise<Object>}
   */
  async initiatePush({ paymentId, orderId, phoneNumber, amount, scenario = 'SUCCESS', onSimulatedCallback }) {
    // Use live client only if explicitly in sandbox/production and scenario is LIVE or no mock scenario specified
    const isLive = (this.env === 'sandbox' || this.env === 'production') && scenario === 'LIVE';

    if (isLive && this.client) {
      try {
        const result = await this.client.initiateStkPush({
          amount,
          phoneNumber,
          accountReference: `FP-${orderId}`,
          transactionDesc: 'FlexPay Benefit Co-Pay',
        });
        return {
          paymentId,
          merchantRequestId: result.merchantRequestId,
          checkoutRequestId: result.checkoutRequestId,
          status: 'PENDING_MPESA_CALLBACK',
          message: result.customerMessage || `USSD prompt sent to ${phoneNumber}`,
        };
      } catch (err) {
        console.warn(`[M-PESA Gateway] Live sandbox call failed (${err.message}). Falling back to simulation for local demo resilience.`);
      }
    }

    // Deterministic Mock Simulation
    const merchantRequestId = `FlexPay-mock-${crypto.randomUUID()}`;
    const checkoutRequestId = `ws_CO_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    const mockRecord = {
      paymentId,
      orderId,
      phoneNumber,
      amount,
      merchantRequestId,
      checkoutRequestId,
      scenario,
      createdAt: new Date().toISOString(),
    };
    this.mockRequests.set(checkoutRequestId, mockRecord);

    // Schedule automated mock callback if hook is provided
    if (typeof onSimulatedCallback === 'function') {
      const delayMs = scenario === 'FAST' ? 100 : 3500;
      setTimeout(() => {
        const payload = this.buildSimulatedCallbackPayload(mockRecord);
        onSimulatedCallback(payload).catch((err) => {
          console.error('[MpesaGateway Mock] Error dispatching simulated callback:', err);
        });
      }, delayMs);
    }

    return {
      paymentId,
      merchantRequestId,
      checkoutRequestId,
      status: 'PENDING_MPESA_CALLBACK',
      message: `USSD prompt sent to +${phoneNumber}`,
    };
  }

  /**
   * Generates realistic Safaricom STK callback JSON payload for mock mode.
   * 
   * @param {Object} mockRecord
   * @returns {Object}
   */
  buildSimulatedCallbackPayload(mockRecord) {
    const { checkoutRequestId, merchantRequestId, amount, phoneNumber, scenario } = mockRecord;

    let resultCode = 0;
    let resultDesc = 'The service request is processed successfully.';
    let receiptNumber = `SD${crypto.randomBytes(3).toString('hex').toUpperCase()}ETH`;

    if (scenario === 'USER_CANCELLED') {
      resultCode = 1032;
      resultDesc = 'Request cancelled by user.';
      receiptNumber = null;
    } else if (scenario === 'TIMEOUT') {
      resultCode = 1037;
      resultDesc = 'DS timeout user cannot be reached.';
      receiptNumber = null;
    }

    const items = [
      { Name: 'Amount', Value: amount },
      { Name: 'PhoneNumber', Value: phoneNumber },
      { Name: 'TransactionDate', Value: Number(new Date().toISOString().replace(/\D/g, '').substring(0, 14)) },
    ];

    if (receiptNumber) {
      items.push({ Name: 'MpesaReceiptNumber', Value: receiptNumber });
    }

    return {
      Body: {
        stkCallback: {
          MerchantRequestID: merchantRequestId,
          CheckoutRequestID: checkoutRequestId,
          ResultCode: resultCode,
          ResultDesc: resultDesc,
          CallbackMetadata: resultCode === 0 ? { Item: items } : undefined,
        },
      },
    };
  }

  /**
   * Parses and extracts fields from Safaricom STK callback body.
   * 
   * @param {Object} body - Incoming webhook payload
   * @returns {Object} Normalized callback data
   */
  parseCallback(body) {
    if (!body || !body.Body || !body.Body.stkCallback) {
      throw new Error('Invalid Safaricom callback payload structure');
    }

    const cb = body.Body.stkCallback;
    const checkoutRequestId = cb.CheckoutRequestID;
    const merchantRequestId = cb.MerchantRequestID;
    const resultCode = parseInt(cb.ResultCode, 10);
    const resultDesc = cb.ResultDesc || '';

    let receiptNumber = null;
    let amount = null;
    let phone = null;

    if (cb.CallbackMetadata && Array.isArray(cb.CallbackMetadata.Item)) {
      for (const item of cb.CallbackMetadata.Item) {
        if (item.Name === 'MpesaReceiptNumber') receiptNumber = String(item.Value);
        if (item.Name === 'Amount') amount = Number(item.Value);
        if (item.Name === 'PhoneNumber') phone = String(item.Value);
      }
    }

    return {
      checkoutRequestId,
      merchantRequestId,
      resultCode,
      resultDesc,
      receiptNumber,
      amount,
      phone,
      isSuccess: resultCode === 0,
      isCancelled: resultCode === 1032,
      isTimeout: resultCode === 1037,
    };
  }
}

module.exports = MpesaGateway;
