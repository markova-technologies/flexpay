const { authenticate } = require('../../../../shared/middleware/authenticate');
const { requireRole } = require('../../../../shared/middleware/requireRole');
const { RunPayrollUseCase } = require('../../ports/incoming/RunPayrollUseCase');
const { PayrollRepository } = require('../outgoing/PayrollRepository');
const { TransactionRepository } = require('../../../transactions/adapters/outgoing/TransactionRepository');
const { EmployeeRepository } = require('../../../employees/adapters/outgoing/EmployeeRepository');
const { z } = require('zod');

const runPayrollSchema = z.object({
  periodStart: z.string().optional(),
  periodEnd: z.string().optional(),
  settlementDate: z.string().optional(),
  employeeSalaries: z
    .array(
      z.object({
        employeeId: z.string().min(1),
        grossSalary: z.number().positive('grossSalary must be a positive number'),
      })
    )
    .optional()
    .default([]),
});

async function payrollRoutes(fastify, options) {
  const payrollRepo = options.payrollRepo || new PayrollRepository(options.db);
  const txnRepo = options.transactionRepo || new TransactionRepository(options.db);
  const employeeRepo = options.employeeRepo || new EmployeeRepository(options.db);
  const mpesaB2CService = options.mpesaB2CService || null;

  const runPayrollUseCase = new RunPayrollUseCase({
    payrollRepository: payrollRepo,
    transactionRepository: txnRepo,
    employeeRepository: employeeRepo,
    mpesaB2CService,
  });

  fastify.addHook('preHandler', authenticate);

  // --------------------------------------------------------------------------
  // 1. Run Automated Payroll Settlement
  // --------------------------------------------------------------------------
  fastify.post(
    '/org/payroll/run',
    { preHandler: [requireRole('ORG_ADMIN')] },
    async (request, reply) => {
      const parse = runPayrollSchema.safeParse(request.body || {});
      if (!parse.success) {
        return reply.code(400).send({ error: 'Validation error', details: parse.error.issues });
      }

      const today = new Date();
      const defaultStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
      const defaultEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10);

      const periodStart = (parse.data.periodStart && /^\d{4}-\d{2}-\d{2}$/.test(parse.data.periodStart))
        ? parse.data.periodStart
        : defaultStart;
      const periodEnd = (parse.data.periodEnd && /^\d{4}-\d{2}-\d{2}$/.test(parse.data.periodEnd))
        ? parse.data.periodEnd
        : defaultEnd;

      const { employeeSalaries } = parse.data;

      const result = await runPayrollUseCase.execute({
        organizationId: request.user.orgId,
        periodStart,
        periodEnd,
        employeeSalaries,
        initiatedBy: request.user.sub,
      });

      return reply.code(201).send({
        message: 'Payroll settlement executed. Automated B2C wire payouts dispatched to merchants and employees.',
        settlementId: result.settlementId,
        settlement: {
          id: result.settlementId,
          status: 'RUNNING',
          totalMerchantDisbursements: result.totalMerchantDisbursements,
          totalEmployeeDisbursements: result.totalEmployeeDisbursements,
          merchantsCount: result.merchantsCount,
          employeesCount: result.employeesCount,
        },
        totalMerchantDisbursements: result.totalMerchantDisbursements,
        totalEmployeeDisbursements: result.totalEmployeeDisbursements,
        merchantsCount: result.merchantsCount,
        employeesCount: result.employeesCount,
        disbursementLines: result.disbursementLines,
      });
    }
  );

  // --------------------------------------------------------------------------
  // 2. Organization Payroll Settlement History
  // --------------------------------------------------------------------------
  fastify.get(
    '/org/payroll/history',
    { preHandler: [requireRole('ORG_ADMIN', 'ORG_CONTROLLER')] },
    async (request, reply) => {
      const settlements = await payrollRepo.listSettlementsByOrg(request.user.orgId);
      return reply.send({ settlements });
    }
  );
}

module.exports = payrollRoutes;
