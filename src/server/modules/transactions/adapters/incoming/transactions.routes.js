const { authenticate } = require('../../../../shared/middleware/authenticate');
const { generateReceipt } = require('../../domain/ReceiptEngine');
const { TransactionRepository } = require('../outgoing/TransactionRepository');

async function transactionRoutes(fastify, options) {
  const txnRepo = options.transactionRepo || new TransactionRepository(options.db);

  fastify.get(
    '/transactions/:transactionId/receipt',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { transactionId } = request.params;
      const txn = await txnRepo.findById(transactionId);
      if (!txn) {
        return reply.code(404).send({ error: 'Transaction not found' });
      }

      // Generate receipt PDF buffer
      const pdfBuffer = await generateReceipt(txn);

      reply.header('Content-Type', 'application/pdf');
      reply.header('Content-Disposition', `attachment; filename="flexpay-receipt-${txn.fp_transaction_ref || transactionId}.pdf"`);
      return reply.send(pdfBuffer);
    }
  );

  fastify.get(
    '/transactions/:transactionId',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { transactionId } = request.params;
      const txn = await txnRepo.findById(transactionId);
      if (!txn) {
        return reply.code(404).send({ error: 'Transaction not found' });
      }
      return reply.send({ transaction: txn });
    }
  );
}

module.exports = transactionRoutes;
