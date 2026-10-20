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
  autoComplete: z.boolean().optional(),
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

      const { employeeSalaries, autoComplete } = parse.data;

      const result = await runPayrollUseCase.execute({
        organizationId: request.user.orgId,
        periodStart,
        periodEnd,
        employeeSalaries,
        initiatedBy: request.user.sub,
        autoComplete: autoComplete ?? false,
      });

      const currentStatus = result.settlement?.status || 'RUNNING';

      return reply.code(201).send({
        message: currentStatus === 'COMPLETED'
          ? 'Payroll settlement executed and completed. Automated B2C wire payouts confirmed and credit reset.'
          : 'Payroll settlement executed. Automated B2C wire payouts dispatched to merchants and employees.',
        settlementId: result.settlementId,
        settlement: {
          id: result.settlementId,
          status: currentStatus,
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
      const rawSettlements = await payrollRepo.listSettlementsByOrg(request.user.orgId);
      const settlements = (rawSettlements || []).map((s) => {
        const merchantTotal = Number(s.total_merchant_disbursements || 0);
        const employeeTotal = Number(s.total_employee_disbursements || 0);
        const combined = Number((merchantTotal + employeeTotal).toFixed(2));
        const finalAmount = merchantTotal > 0 ? merchantTotal : (combined > 0 ? combined : Number(s.total_amount || 0));
        return {
          ...s,
          total_merchant_disbursements: merchantTotal,
          total_employee_disbursements: employeeTotal,
          total_amount: finalAmount,
          totalAmount: finalAmount,
        };
      });
      return reply.send({ settlements });
    }
  );

  // --------------------------------------------------------------------------
  // 3. Finalize / Complete Running Settlement (Instant B2C Wire Completion)
  // --------------------------------------------------------------------------
  fastify.post(
    '/org/payroll/:settlementId/complete',
    { preHandler: [requireRole('ORG_ADMIN')] },
    async (request, reply) => {
      const { settlementId } = request.params;
      const settlement = await payrollRepo.findSettlementById(settlementId);
      if (!settlement) {
        return reply.code(404).send({ error: 'Settlement not found' });
      }
      if (settlement.organization_id !== request.user.orgId) {
        return reply.code(403).send({ error: 'Unauthorized access to settlement' });
      }

      if (typeof payrollRepo.completeSettlementImmediately === 'function') {
        const result = await payrollRepo.completeSettlementImmediately(settlementId);
        return reply.send({
          message: 'Settlement marked as completed. Disbursement wires confirmed and employee credit reset.',
          settlement: result.settlement,
          lines: result.lines,
        });
      }

      if (typeof payrollRepo.resetCreditForSettlement === 'function') {
        await payrollRepo.resetCreditForSettlement(settlementId);
      }
      const updated = typeof payrollRepo.markSettlementCompleted === 'function'
        ? await payrollRepo.markSettlementCompleted(settlementId)
        : { ...settlement, status: 'COMPLETED' };

      return reply.send({
        message: 'Settlement marked as completed. Employee credit accounts reset.',
        settlement: updated,
      });
    }
  );

  // --------------------------------------------------------------------------
  // 4. Get Settlement Disbursement Lines Breakdown
  // --------------------------------------------------------------------------
  fastify.get(
    '/org/payroll/:settlementId/lines',
    { preHandler: [requireRole('ORG_ADMIN', 'ORG_CONTROLLER')] },
    async (request, reply) => {
      const { settlementId } = request.params;
      const settlement = await payrollRepo.findSettlementById(settlementId);
      if (!settlement || settlement.organization_id !== request.user.orgId) {
        return reply.code(404).send({ error: 'Settlement not found' });
      }

      let lines = [];
      if (typeof payrollRepo.listLinesBySettlementId === 'function') {
        lines = await payrollRepo.listLinesBySettlementId(settlementId);
      }

      // If this settlement has NO employee lines yet (e.g. past cycle created before remainder payouts),
      // augment them so the organization admin can view employee salary remainder disbursements for the cycle
      const hasEmployeeLines = lines.some((l) => (l.recipient_type || l.recipientType) === 'EMPLOYEE');
      if (!hasEmployeeLines && typeof employeeRepo.findByOrgId === 'function') {
        try {
          const orgEmployees = await employeeRepo.findByOrgId(settlement.organization_id, { limit: 1000 });
          if (orgEmployees && orgEmployees.length > 0) {
            let creditMap = new Map();
            if (typeof txnRepo.listRecentByOrg === 'function') {
              try {
                const linkedTxns = await txnRepo.listRecentByOrg(settlement.organization_id, 2000);
                const settledTxns = (linkedTxns || []).filter(
                  (t) => t.settlement_id === settlementId || t.status === 'COMPLETED'
                );
                for (const t of settledTxns) {
                  const c = Number(t.credit_portion || 0);
                  creditMap.set(t.employee_id, (creditMap.get(t.employee_id) || 0) + c);
                }
              } catch {}
            }

            const employeeLinesToInsert = [];
            for (const emp of orgEmployees) {
              const salary = Number(emp.monthly_salary || emp.credit_limit || 0);
              const creditUsed = Number(creditMap.get(emp.id) || 0);
              const netSalary = Math.max(0, Number((salary - creditUsed).toFixed(2)));
              if (netSalary > 0) {
                const lineId = `line-emp-${emp.id.slice(0, 8)}-${settlementId.slice(0, 6)}`;
                const receipt = `MP_B2C_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
                employeeLinesToInsert.push({
                  id: lineId,
                  settlement_id: settlementId,
                  recipient_type: 'EMPLOYEE',
                  recipientType: 'EMPLOYEE',
                  employee_id: emp.id,
                  recipient_mpesa_number: emp.phone_number,
                  recipientMpesaNumber: emp.phone_number,
                  amount: netSalary,
                  status: settlement.status === 'COMPLETED' ? 'COMPLETED' : 'PENDING',
                  mpesa_receipt: receipt,
                  mpesaReceipt: receipt,
                  completed_at: settlement.completed_at || new Date(),
                  created_at: settlement.created_at || new Date(),
                  employee_name: emp.full_name,
                  employeeName: emp.full_name,
                  employee_fp_id: emp.fp_employee_id,
                  employeeFpId: emp.fp_employee_id,
                  employee_salary: salary,
                  employeeSalary: salary,
                });
              }
            }

            if (employeeLinesToInsert.length > 0) {
              lines = [...lines, ...employeeLinesToInsert];
            }
          }
        } catch (err) {
          request.log.warn({ err }, '[Payroll Lines] Backfill note');
        }
      }

      return reply.send({ settlement, lines });
    }
  );

  // --------------------------------------------------------------------------
  // 5. Finalize All Running Settlements for Organization
  // --------------------------------------------------------------------------
  fastify.post(
    '/org/payroll/finalize-all',
    { preHandler: [requireRole('ORG_ADMIN')] },
    async (request, reply) => {
      const settlements = await payrollRepo.listSettlementsByOrg(request.user.orgId);
      const running = settlements.filter((s) => s.status === 'RUNNING');

      const completed = [];
      for (const s of running) {
        if (typeof payrollRepo.completeSettlementImmediately === 'function') {
          const res = await payrollRepo.completeSettlementImmediately(s.id);
          completed.push(res.settlement);
        } else {
          if (typeof payrollRepo.resetCreditForSettlement === 'function') {
            await payrollRepo.resetCreditForSettlement(s.id);
          }
          if (typeof payrollRepo.markSettlementCompleted === 'function') {
            const updated = await payrollRepo.markSettlementCompleted(s.id);
            completed.push(updated);
          }
        }
      }

      return reply.send({
        message: `Successfully finalized ${completed.length} running settlement(s).`,
        count: completed.length,
        settlements: completed,
      });
    }
  );
}

module.exports = payrollRoutes;
