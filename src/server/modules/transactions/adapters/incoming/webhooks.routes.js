const { TransactionRepository } = require('../outgoing/TransactionRepository');

async function webhooksRoutes(fastify, options) {
  const txnRepo = options.transactionRepo || new TransactionRepository(options.db);
  const notificationService = options.notificationService || null;

  // IMPORTANT: M-PESA webhooks are called directly by Safaricom servers.
  // We must return HTTP 200 within seconds to prevent retry storms.

  // --------------------------------------------------------------------------
  // 1. M-PESA STK Push Callback (C2B Co-Pay)
  // --------------------------------------------------------------------------
  fastify.post('/webhooks/mpesa/stk', async (request, reply) => {
    // 1. Immediately acknowledge Safaricom
    reply.code(200).send({ ResultCode: 0, ResultDesc: 'Accepted' });

    try {
      const body = request.body;
      const callback = body?.Body?.stkCallback;
      if (!callback) return;

      const checkoutRequestId = callback.CheckoutRequestID;
      const resultCode = callback.ResultCode;
      const resultDesc = callback.ResultDesc;

      const txn = await txnRepo.findByStkCheckoutRequestId(checkoutRequestId);
      if (!txn) {
        console.warn(`[M-PESA Webhook] No matching transaction for CheckoutRequestID: ${checkoutRequestId}`);
        return;
      }

      if (resultCode === 0) {
        // Payment successful
        let mpesaReceipt = null;
        const items = callback.CallbackMetadata?.Item;
        if (Array.isArray(items)) {
          const receiptItem = items.find((i) => i.Name === 'MpesaReceiptNumber');
          if (receiptItem) mpesaReceipt = String(receiptItem.Value);
        }

        await txnRepo.updateStatus(txn.id, 'COMPLETED', mpesaReceipt);

        if (notificationService && typeof notificationService.sendPurchaseConfirmation === 'function') {
          await notificationService.sendPurchaseConfirmation(txn);
        }
      } else {
        // Payment failed or cancelled by customer: reverse the credit deduction!
        console.log(`[M-PESA Webhook] Payment failed: ${resultDesc}. Reversing credit reservation for ${txn.id}`);
        await txnRepo.reverseCreditReservation(txn.id);
      }
    } catch (err) {
      console.error('[M-PESA Webhook Error]', err);
    }
  });

  // --------------------------------------------------------------------------
  // 2. M-PESA C2B Validation Callback
  // --------------------------------------------------------------------------
  fastify.post('/webhooks/mpesa/c2b-validate', async (request, reply) => {
    // Validates if payment should be accepted
    return reply.send({
      ResultCode: 0,
      ResultDesc: 'Accepted',
    });
  });

  // --------------------------------------------------------------------------
  // 3. M-PESA C2B Confirmation Callback
  // --------------------------------------------------------------------------
  fastify.post('/webhooks/mpesa/c2b-confirm', async (request, reply) => {
    return reply.send({
      ResultCode: 0,
      ResultDesc: 'Confirmation received',
    });
  });
}

module.exports = webhooksRoutes;
