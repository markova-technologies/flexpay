const { PayrollRepository } = require('../outgoing/PayrollRepository');

async function b2cWebhookRoutes(fastify, options) {
  const payrollRepo = options.payrollRepo || new PayrollRepository(options.db);
  const notificationService = options.notificationService || null;

  // --------------------------------------------------------------------------
  // M-PESA B2C Payout Result Webhook
  // --------------------------------------------------------------------------
  fastify.post('/webhooks/mpesa/b2c-result', async (request, reply) => {
    try {
      const { Result } = request.body || {};
      if (!Result) {
        return reply.code(200).send({ ResultCode: 0, ResultDesc: 'Accepted' });
      }

      const conversationId = Result.ConversationID;
      const resultCode = Result.ResultCode;
      const resultDesc = Result.ResultDesc;

      const line = await payrollRepo.findLineByConversationId(conversationId);
      if (!line) {
        console.warn(`[M-PESA B2C Webhook] No matching disbursement line for ConversationID: ${conversationId}`);
        return reply.code(200).send({ ResultCode: 0, ResultDesc: 'Accepted' });
      }

      if (resultCode === 0) {
        // Payout successful
        let receiptNo = null;
        const params = Result.ResultParameters?.ResultParameter;
        if (Array.isArray(params)) {
          const p = params.find((item) => item.Key === 'TransactionReceipt');
          if (p) receiptNo = String(p.Value);
        }

        await payrollRepo.markLineCompleted(line.id, receiptNo);

        // Check if all disbursement lines for this payroll cycle are finished
        const allCompleted = await payrollRepo.checkAllLinesComplete(line.settlement_id);
        if (allCompleted) {
          console.log(`[Payroll Settlement] All disbursement lines succeeded for settlement ${line.settlement_id}. Resetting employee credit accounts.`);
          // 1. Reset employee credit accounts
          await payrollRepo.resetCreditForSettlement(line.settlement_id);
          // 2. Mark master settlement record as COMPLETED
          await payrollRepo.markSettlementCompleted(line.settlement_id);
          // 3. Notify org admin
          if (notificationService && typeof notificationService.sendSettlementCompleted === 'function') {
            await notificationService.sendSettlementCompleted(line.settlement_id);
          }
        }
      } else {
        console.error(`[M-PESA B2C Webhook] Disbursement line ${line.id} failed: ${resultDesc}`);
        await payrollRepo.markLineFailed(line.id, resultDesc);
      }
    } catch (err) {
      console.error('[M-PESA B2C Webhook Processing Error]', err);
    }

    return reply.code(200).send({ ResultCode: 0, ResultDesc: 'Accepted' });
  });

  // --------------------------------------------------------------------------
  // M-PESA B2C Timeout Webhook
  // --------------------------------------------------------------------------
  fastify.post('/webhooks/mpesa/b2c-timeout', async (request, reply) => {
    reply.code(200).send({ ResultCode: 0, ResultDesc: 'Timeout acknowledged' });
  });
}

module.exports = b2cWebhookRoutes;
