const { MpesaClient } = require('./MpesaClient');
const { loadConfig } = require('../../config');

const client = new MpesaClient();

/**
 * Dispatches an M-PESA B2C payout request (SalaryPayment or BusinessPayment).
 */
async function sendB2C({
  commandId = 'SalaryPayment',
  amount,
  recipientPhone,
  remarks = 'FlexPay Payroll Settlement',
  queueTimeOutUrl,
  resultUrl,
  occasion = 'Payroll',
}) {
  const config = loadConfig();

  const formattedPhone = String(recipientPhone).replace(/\D/g, '');
  const timeoutUrl = queueTimeOutUrl || `${config.MPESA_CALLBACK_BASE}/api/v1/webhooks/mpesa/b2c-timeout`;
  const resUrl = resultUrl || `${config.MPESA_CALLBACK_BASE}/api/v1/webhooks/mpesa/b2c-result`;

  const payload = {
    InitiatorName: config.MPESA_INITIATOR_NAME || 'YellowBusinessInit',
    SecurityCredential: config.MPESA_SECURITY_CREDENTIAL || 'MOCK_CREDENTIAL',
    CommandID: commandId,
    Amount: Math.round(Number(amount)), // M-PESA requires integer ETB
    PartyA: config.MPESA_SHORTCODE || '2005',
    PartyB: formattedPhone,
    Remarks: String(remarks).slice(0, 100),
    QueueTimeOutURL: timeoutUrl,
    ResultURL: resUrl,
    Occasion: String(occasion).slice(0, 100),
  };

  try {
    const res = await client.post('/mpesa/b2c/v1/paymentrequest', payload);
    return {
      success: res.status >= 200 && res.status < 300,
      data: res.data,
      conversationId: res.data?.ConversationID || `CONV_${Date.now()}`,
    };
  } catch (err) {
    if (config.NODE_ENV !== 'production') {
      return {
        success: true,
        data: { ResponseDescription: 'Accept the service request successfully.' },
        conversationId: `CONV_MOCK_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      };
    }
    throw err;
  }
}

module.exports = { sendB2C };
