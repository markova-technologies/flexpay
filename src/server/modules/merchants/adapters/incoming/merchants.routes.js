const { authenticate } = require('../../../../shared/middleware/authenticate');
const { requireRole } = require('../../../../shared/middleware/requireRole');
const { validateEmployeeId } = require('../../../../shared/crypto/employeeIdGenerator');
const { VerifyEmployeeQRUseCase } = require('../../ports/incoming/VerifyEmployeeQRUseCase');
const { GetMerchantAnalyticsUseCase } = require('../../ports/incoming/GetMerchantAnalyticsUseCase');
const { CreateTransactionUseCase } = require('../../../transactions/ports/incoming/CreateTransactionUseCase');
const { TransactionRepository } = require('../../../transactions/adapters/outgoing/TransactionRepository');
const { EmployeeRepository } = require('../../../employees/adapters/outgoing/EmployeeRepository');
const { MerchantRepository } = require('../outgoing/MerchantRepository');
const { z } = require('zod');

const verifyEmployeeSchema = z.object({
  qrPayload: z.string().optional(),
  fpEmployeeId: z.string().trim().optional(),
  fpId: z.string().trim().optional(),
});

const createTransactionSchema = z.object({
  fpEmployeeId: z.string().trim().optional(),
  fpId: z.string().trim().optional(),
  totalAmount: z.number().positive('Total amount must be greater than zero').optional(),
  amount: z.number().positive('Amount must be greater than zero').optional(),
  idempotencyKey: z.string().optional(),
});

async function merchantRoutes(fastify, options) {
  const merchantRepo = options.merchantRepo || new MerchantRepository(options.db);
  const employeeRepo = options.employeeRepo || new EmployeeRepository(options.db);
  const txnRepo = options.transactionRepo || new TransactionRepository(options.db);
  const mpesaStkService = options.mpesaStkService || null;
  const notificationService = options.notificationService || null;

  const createTxnUseCase = new CreateTransactionUseCase({
    transactionRepository: txnRepo,
    employeeRepository: employeeRepo,
    merchantRepository: merchantRepo,
    mpesaStkService,
    notificationService,
  });

  const verifyEmployeeQRUseCase = new VerifyEmployeeQRUseCase({
    employeeRepository: employeeRepo,
    merchantRepository: merchantRepo,
  });

  // Guard all merchant routes
  fastify.addHook('preHandler', authenticate);

  // --------------------------------------------------------------------------
  // 1. Verify Employee at POS (Instant Check: <200ms)
  // --------------------------------------------------------------------------
  fastify.post(
    '/merchant/verify-employee',
    { preHandler: [requireRole('MERCHANT_OWNER', 'MERCHANT_STAFF')] },
    async (request, reply) => {
      const parse = verifyEmployeeSchema.safeParse(request.body);
      if (!parse.success) {
        return reply.code(400).send({ error: 'Validation error', details: parse.error.issues });
      }

      if (parse.data.qrPayload) {
        const qrResult = await verifyEmployeeQRUseCase.execute({
          qrPayload: parse.data.qrPayload,
          merchantId: request.user.merchantId,
        });
        if (!qrResult.verified) {
          return reply.code(400).send({ error: qrResult.error, verified: false, eligible: false });
        }
        return reply.send({
          verified: true,
          eligible: true,
          ...qrResult.employee,
          employee: qrResult.employee,
        });
      }

      const fpEmployeeId = parse.data.fpEmployeeId || parse.data.fpId;
      if (!fpEmployeeId) {
        return reply.code(400).send({ error: 'Either qrPayload or fpEmployeeId/fpId is required', verified: false, eligible: false });
      }

      const validation = validateEmployeeId(fpEmployeeId);
      if (!validation.valid) {
        return reply.code(400).send({ error: 'Invalid Employee ID checksum or format', verified: false, eligible: false });
      }

      const employee = await employeeRepo.findByFpId(fpEmployeeId);
      if (!employee || employee.status !== 'ACTIVE') {
        return reply.code(404).send({ error: 'Employee not found or inactive', verified: false, eligible: false });
      }

      const merchant = await merchantRepo.findById(request.user.merchantId);
      if (!merchant || merchant.status !== 'ACTIVE') {
        return reply.code(403).send({ error: 'Merchant terminal is inactive', verified: false, eligible: false });
      }

      // Check organization credit policy for merchant category eligibility
      const policy = await employeeRepo.getOrgCreditPolicy(employee.organization_id);
      let eligible = true;
      let ineligibilityReason = null;

      if (policy && Array.isArray(policy.allowed_categories) && policy.allowed_categories.length > 0) {
        if (!policy.allowed_categories.includes(merchant.category)) {
          eligible = false;
          ineligibilityReason = `Category '${merchant.category}' is not approved by employee organization`;
        }
      }

      if (!eligible) {
        return reply.code(403).send({
          verified: false,
          eligible: false,
          error: ineligibilityReason,
          ineligibilityReason,
        });
      }

      const availableCredit = Number(employee.available_credit);
      const creditLimit = Number(employee.credit_limit);
      const fullName = employee.full_name;
      const orgName = employee.organization_name || 'Corporate Partner';

      return reply.send({
        verified: true,
        eligible: true,
        fullName,
        employeeName: fullName,
        fpEmployeeId: employee.fp_employee_id,
        availableCredit,
        creditLimit,
        organizationName: orgName,
        employee: {
          fullName,
          employeeName: fullName,
          fpEmployeeId: employee.fp_employee_id,
          availableCredit,
          creditLimit,
          organizationId: employee.organization_id,
          organizationName: orgName,
        },
        merchant: {
          name: merchant.business_name || merchant.name,
          category: merchant.category,
        },
      });
    }
  );

  // --------------------------------------------------------------------------
  // 2. Process Purchase Transaction
  // --------------------------------------------------------------------------
  fastify.post(
    '/merchant/transaction',
    { preHandler: [requireRole('MERCHANT_OWNER', 'MERCHANT_STAFF')] },
    async (request, reply) => {
      const parse = createTransactionSchema.safeParse(request.body);
      if (!parse.success) {
        return reply.code(400).send({ error: 'Validation error', details: parse.error.issues });
      }

      const fpEmployeeId = parse.data.fpEmployeeId || parse.data.fpId;
      const totalAmount = parse.data.totalAmount !== undefined ? parse.data.totalAmount : parse.data.amount;

      if (!fpEmployeeId || totalAmount === undefined) {
        return reply.code(400).send({ error: 'fpEmployeeId (or fpId) and totalAmount (or amount) are required' });
      }

      try {
        const result = await createTxnUseCase.execute({
          merchantId: request.user.merchantId,
          fpEmployeeId,
          totalAmount,
        });

        return reply.code(201).send({
          message: result.requiresStkPush
            ? 'Transaction initiated. M-PESA STK Push prompt sent to employee mobile device for co-pay portion.'
            : 'Transaction completed successfully with 100% FlexPay benefit credit.',
          transaction: result.transaction,
          fpTransactionRef: result.fpTransactionRef,
          fpRef: result.fpTransactionRef,
          totalAmount: result.totalAmount,
          creditPortion: result.creditPortion,
          copayPortion: result.copayPortion,
          requiresStkPush: result.requiresStkPush,
          stkPushInitiated: result.stkPushInitiated,
          checkoutRequestId: result.checkoutRequestId,
          status: result.status,
        });
      } catch (err) {
        request.log.error(err, `[Merchant POS] Failed to process transaction for FP-ID ${fpEmployeeId}`);
        const statusCode = err.statusCode || (err.name === 'ValidationError' ? 400 : 500);
        return reply.code(statusCode).send({
          error: err.message || 'Transaction authorization failed',
          message: err.message || 'Transaction authorization failed',
        });
      }
    }
  );

  // --------------------------------------------------------------------------
  // 3. List Recent Transactions
  // --------------------------------------------------------------------------
  fastify.get(
    '/merchant/transactions',
    { preHandler: [requireRole('MERCHANT_OWNER', 'MERCHANT_STAFF')] },
    async (request, reply) => {
      const limit = Number(request.query.limit) || 20;
      const transactions = await txnRepo.listRecentByMerchant(request.user.merchantId, limit);
      return reply.send({ transactions });
    }
  );

  // --------------------------------------------------------------------------
  // 4. Merchant Dashboard Summary
  // --------------------------------------------------------------------------
  fastify.get(
    '/merchant/dashboard',
    { preHandler: [requireRole('MERCHANT_OWNER', 'MERCHANT_STAFF')] },
    async (request, reply) => {
      const merchant = await merchantRepo.findById(request.user.merchantId);
      const summary = await merchantRepo.getReceivablesSummary(request.user.merchantId);
      const recentTransactions = await txnRepo.listRecentByMerchant(request.user.merchantId, 10);

      return reply.send({
        merchant: {
          businessName: merchant.business_name,
          mpesaNumber: merchant.mpesa_number,
          category: merchant.category,
        },
        stats: {
          totalOutstandingReceivables: summary.totalOutstandingReceivables,
          uniqueOrganizations: summary.uniqueOrganizations,
          uniqueEmployees: summary.uniqueEmployees,
          totalTransactions: summary.totalTransactions,
        },
        receivablesByOrg: summary.receivablesByOrg,
        recentTransactions,
      });
    }
  );

  // --------------------------------------------------------------------------
  // 5. Merchant Detailed Analytics (for Merchant Analytics Tab)
  // --------------------------------------------------------------------------
  const getMerchantAnalyticsUseCase = new GetMerchantAnalyticsUseCase(merchantRepo);

  fastify.get(
    '/merchant/analytics',
    { preHandler: [requireRole('MERCHANT_OWNER', 'MERCHANT_STAFF')] },
    async (request, reply) => {
      const period = request.query.period || 'month';
      const analytics = await getMerchantAnalyticsUseCase.execute({
        merchantId: request.user.merchantId,
        period,
      });
      return reply.send(analytics);
    }
  );
}

module.exports = merchantRoutes;
