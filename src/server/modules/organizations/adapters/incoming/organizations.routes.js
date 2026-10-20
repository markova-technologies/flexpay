const { authenticate } = require('../../../../shared/middleware/authenticate');
const { requireRole } = require('../../../../shared/middleware/requireRole');
const { validateUUIDParams } = require('../../../../shared/middleware/validateUUID');
const { CreateEmployeeUseCase } = require('../../../employees/ports/incoming/CreateEmployeeUseCase');
const { EmployeeRepository } = require('../../../employees/adapters/outgoing/EmployeeRepository');
const { TransactionRepository } = require('../../../transactions/adapters/outgoing/TransactionRepository');
const { Employee } = require('../../../employees/domain/Employee');
const { generateCompliantPassword } = require('../../../../shared/crypto/passwordGenerator');
const { hashPassword } = require('../../../../shared/crypto/argon2');
const { phoneSchema } = require('../../../../shared/validation/schemas/auth.schemas');
const { GetOrgMerchantDetailUseCase } = require('../../ports/incoming/GetOrgMerchantDetailUseCase');
const { MerchantRepository } = require('../../../merchants/adapters/outgoing/MerchantRepository');
const { generateStatement } = require('../../domain/StatementEngine');
const { z } = require('zod');

const addEmployeeSchema = z.object({
  fullName: z.string().trim().min(2, 'Full name must be at least 2 characters').max(100),
  phoneNumber: phoneSchema,
  department: z.string().trim().max(50).optional(),
  jobTitle: z.string().trim().max(50).optional(),
  monthlySalary: z.number().min(0).optional(),
  creditLimitOverride: z.number().min(0).optional(),
  creditLimit: z.number().min(0).optional(),
  sendSms: z.boolean().default(false),
});

const updateCreditSchema = z.object({
  creditLimit: z.number().min(0, 'Credit limit must be a positive number').optional(),
  newCreditLimit: z.number().min(0, 'Credit limit must be a positive number').optional(),
});

const resetReviewSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT']),
});

const creditPolicySchema = z.object({
  globalLimit: z.number().min(0).optional(),
  allowedCategories: z.array(z.string()).optional(),
});

const mpesaConfigSchema = z.object({
  mpesaShortcode: z.string().trim().min(3).max(10),
});

async function organizationRoutes(fastify, options) {
  const employeeRepo = options.employeeRepo || new EmployeeRepository(options.db);
  const txnRepo = options.transactionRepo || new TransactionRepository(options.db);
  const merchantRepo = options.merchantRepo || new MerchantRepository(options.db);
  const notificationService = options.notificationService || null;

  const createEmployeeUseCase = new CreateEmployeeUseCase({
    employeeRepository: employeeRepo,
    notificationService,
    db: options.db,
  });

  // Guard all organization routes
  fastify.addHook('preHandler', authenticate);

  const resolveOrgId = async (user) => {
    let id = user?.orgId || user?.organizationId || user?.organization_id;
    if (!id && user?.sub && typeof options.authRepo?.findUserById === 'function') {
      try {
        const u = await options.authRepo.findUserById(user.sub);
        id = u?.organization_id;
      } catch {}
    }
    if (!id && user?.sub && options.db) {
      try {
        const userRec = await options.db
          .selectFrom('users')
          .select(['organization_id'])
          .where('id', '=', user.sub)
          .executeTakeFirst();
        if (userRec?.organization_id) id = userRec.organization_id;
      } catch {}
    }
    if (!id && options.db) {
      try {
        const first = await options.db
          .selectFrom('organizations')
          .select(['id'])
          .limit(1)
          .executeTakeFirst();
        if (first?.id) id = first.id;
      } catch {}
    }
    return id;
  };

  // --------------------------------------------------------------------------
  // 1. Organization Executive Dashboard Summary
  // --------------------------------------------------------------------------
  fastify.get(
    '/org/dashboard',
    { preHandler: [requireRole('ORG_ADMIN', 'ORG_CONTROLLER')] },
    async (request, reply) => {
      try {
        const orgId = await resolveOrgId(request.user);
        let employees = [];
        let recentTransactions = [];
        let pendingResets = [];

        if (orgId) {
          [employees, recentTransactions, pendingResets] = await Promise.all([
            employeeRepo.findByOrgId(orgId, { page: 1, limit: 1000 }).catch(() => []),
            txnRepo.listRecentByOrg(orgId, 20).catch(() => []),
            employeeRepo.listPasswordResetRequests(orgId, 'PENDING').catch(() => []),
          ]);
        }

        let totalCreditExtended = 0;
        let totalAvailableCredit = 0;
        let employeesWithBalance = 0;
        let activeCount = 0;

        for (const emp of (employees || [])) {
          if (emp.status === 'ACTIVE') activeCount++;
          const limit = Number(emp.credit_limit || 0);
          const available = Number(emp.available_credit || 0);
          totalCreditExtended += limit;
          totalAvailableCredit += available;
          if (limit > available) employeesWithBalance++;
        }

        // Aggregate top spending categories from transactions
        const categoryMap = new Map();
        for (const txn of (recentTransactions || [])) {
          if (txn && txn.status === 'COMPLETED') {
            const cat = txn.category_snapshot || 'GENERAL';
            const amt = Number(txn.credit_portion || 0);
            categoryMap.set(cat, (categoryMap.get(cat) || 0) + amt);
          }
        }

        const topSpendingCategories = Array.from(categoryMap.entries())
          .map(([category, total]) => ({ category, total: Number(total.toFixed(2)) }))
          .sort((a, b) => b.total - a.total);

        return reply.send({
          org: {
            id: orgId || '',
            name: request.user.orgName || 'Organization',
          },
          stats: {
            totalEmployees: (employees || []).length,
            activeEmployees: activeCount,
            employeesWithOutstandingBalance: employeesWithBalance,
            totalCreditExtended: Number(totalCreditExtended.toFixed(2)),
            totalAvailableCredit: Number(totalAvailableCredit.toFixed(2)),
            totalCreditUtilized: Number((totalCreditExtended - totalAvailableCredit).toFixed(2)),
            pendingPasswordResets: (pendingResets || []).length,
          },
          topSpendingCategories,
          recentTransactions: recentTransactions || [],
        });
      } catch (fatalErr) {
        request.log.error({ fatalErr }, '[Org Dashboard] Unexpected fatal error');
        return reply.send({
          org: { id: '', name: request.user.orgName || 'Organization' },
          stats: {
            totalEmployees: 0,
            activeEmployees: 0,
            employeesWithOutstandingBalance: 0,
            totalCreditExtended: 0,
            totalAvailableCredit: 0,
            totalCreditUtilized: 0,
            pendingPasswordResets: 0,
          },
          topSpendingCategories: [],
          recentTransactions: [],
        });
      }
    }
  );

  // --------------------------------------------------------------------------
  // 2. Organization Payroll Settlement Preview
  // --------------------------------------------------------------------------
  fastify.get(
    '/org/payroll/preview',
    { preHandler: [requireRole('ORG_ADMIN', 'ORG_CONTROLLER')] },
    async (request, reply) => {
      try {
        const orgId = await resolveOrgId(request.user);
        const { periodStart, periodEnd } = request.query || {};

        let transactions = [];
        if (orgId) {
          try {
            transactions = (await txnRepo.listRecentByOrg(orgId, 1000)) || [];
          } catch (tErr) {
            request.log.warn({ err: tErr }, '[Org Payroll Preview] Failed to list recent transactions for org');
          }
        }

        const completedTxns = (transactions || []).filter(
          (t) => t && t.status === 'COMPLETED' && !t.settlement_id
        );

        const merchantMap = new Map();
        const employeeBalanceMap = new Map();
        let totalMerchantDisbursements = 0;

        for (const t of completedTxns) {
          const credit = Number(t.credit_portion || 0);
          if (credit <= 0) continue;

          totalMerchantDisbursements += credit;

          // Group by merchant
          const mKey = t.merchant_id || 'unknown';
          const mData = merchantMap.get(mKey) || {
            merchantId: mKey,
            merchantName: t.merchant_name_snapshot || 'Partner Merchant',
            merchantMpesaNumber: t.merchant_mpesa_snapshot || '',
            mpesaPhone: t.merchant_mpesa_snapshot || '',
            totalOwed: 0,
            totalPayable: 0,
            amount: 0,
            transactionCount: 0,
          };
          const updatedOwed = Number((mData.totalOwed + credit).toFixed(2));
          mData.totalOwed = updatedOwed;
          mData.totalPayable = updatedOwed;
          mData.amount = updatedOwed;
          mData.transactionCount++;
          merchantMap.set(mKey, mData);

          // Group by employee
          const eKey = t.employee_id || 'unknown';
          const eData = employeeBalanceMap.get(eKey) || {
            employeeId: eKey,
            employee_id: eKey,
            fpEmployeeId: t.employee_fp_id_snapshot || '',
            fp_employee_id: t.employee_fp_id_snapshot || '',
            fullName: t.employee_name_snapshot || 'Employee',
            full_name: t.employee_name_snapshot || 'Employee',
            totalCreditUsed: 0,
            credit_used: 0,
            transactionCount: 0,
          };
          eData.totalCreditUsed = Number((eData.totalCreditUsed + credit).toFixed(2));
          eData.credit_used = eData.totalCreditUsed;
          eData.transactionCount++;
          employeeBalanceMap.set(eKey, eData);
        }

        let orgEmployees = [];
        if (orgId) {
          try {
            orgEmployees = (await employeeRepo.findByOrgId(orgId, { limit: 1000 })) || [];
          } catch (eErr) {
            request.log.warn({ err: eErr }, '[Org Payroll Preview] Failed to find employees by orgId');
          }
        }

        const employeeLines = (orgEmployees || []).map((emp) => {
          const bal = employeeBalanceMap.get(emp.id);
          const creditUsed = bal ? bal.totalCreditUsed : 0;
          const salary = Number(emp.monthly_salary || emp.monthlySalary || emp.credit_limit || 0);
          const netToPay = Math.max(0, salary - creditUsed);
          return {
            employeeId: emp.id,
            employee_id: emp.id,
            fpEmployeeId: emp.fp_employee_id,
            fp_employee_id: emp.fp_employee_id,
            fullName: emp.full_name,
            full_name: emp.full_name,
            phoneNumber: emp.phone_number || emp.phoneNumber || '',
            phone_number: emp.phone_number || emp.phoneNumber || '',
            monthlySalary: salary,
            monthly_salary: salary,
            creditUsed,
            credit_used: creditUsed,
            netToPay,
            net_to_pay: netToPay,
          };
        });

        return reply.send({
          period: {
            start: periodStart || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
            end: periodEnd || new Date().toISOString().slice(0, 10),
          },
          merchantDisbursements: Array.from(merchantMap.values()),
          employeeOutstandingBalances: Array.from(employeeBalanceMap.values()),
          employeeLines,
          totalMerchantDisbursements: Number(totalMerchantDisbursements.toFixed(2)),
          totalCreditUsed: Number(totalMerchantDisbursements.toFixed(2)),
          totalEmployeeSettlements: 0,
        });
      } catch (fatalErr) {
        request.log.error({ fatalErr }, '[Org Payroll Preview] Unexpected fatal error');
        return reply.send({
          period: {
            start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
            end: new Date().toISOString().slice(0, 10),
          },
          merchantDisbursements: [],
          employeeOutstandingBalances: [],
          employeeLines: [],
          totalMerchantDisbursements: 0,
          totalCreditUsed: 0,
          totalEmployeeSettlements: 0,
        });
      }
    }
  );

  // --------------------------------------------------------------------------
  // 3. List Organization Employees
  // --------------------------------------------------------------------------
  fastify.get(
    '/org/employees',
    { preHandler: [requireRole('ORG_ADMIN', 'ORG_CONTROLLER')] },
    async (request, reply) => {
      const { orgId } = request.user;
      const page = Number(request.query.page) || 1;
      const limit = Number(request.query.limit) || 20;
      const { search, department } = request.query;

      const rawEmployees = await employeeRepo.findByOrgId(orgId, {
        page,
        limit,
        search,
        department,
      });

      const employees = rawEmployees.map((e) => {
        const entity = new Employee(e);
        return {
          id: entity.id,
          fpEmployeeId: entity.fpEmployeeId,
          fullName: entity.fullName,
          phoneNumber: entity.phoneNumber,
          department: entity.department,
          creditLimit: entity.creditLimit,
          availableCredit: entity.availableCredit,
          spentCredit: entity.spentCredit,
          utilizationPct: entity.creditUtilizationPct,
          status: entity.status,
          createdAt: entity.createdAt,
        };
      });

      return reply.send({
        page,
        limit,
        employees,
      });
    }
  );

  // --------------------------------------------------------------------------
  // 4. Add Employee (Generates FP-ID + 16-char Password)
  // --------------------------------------------------------------------------
  fastify.post(
    '/org/employees',
    { preHandler: [requireRole('ORG_ADMIN', 'ORG_CONTROLLER')] },
    async (request, reply) => {
      const parse = addEmployeeSchema.safeParse(request.body);
      if (!parse.success) {
        return reply.code(400).send({ error: 'Validation error', details: parse.error.issues });
      }

      const { orgId } = request.user;
      const { fullName, phoneNumber, department, jobTitle, monthlySalary, creditLimitOverride, creditLimit, sendSms } = parse.data;
      const effectiveLimit = creditLimitOverride !== undefined ? creditLimitOverride : creditLimit;

      try {
        const result = await createEmployeeUseCase.execute({
          organizationId: orgId,
          fullName,
          phoneNumber,
          department,
          jobTitle,
          monthlySalary,
          creditLimitOverride: effectiveLimit,
          sendSms,
        });

        return reply.code(201).send({
          message: 'Employee successfully created and assigned to organization',
          employee: {
            id: result.employee.id,
            fpEmployeeId: result.employee.fp_employee_id,
            fullName: result.employee.full_name,
            phoneNumber: result.employee.phone_number,
            creditLimit: Number(result.employee.credit_limit),
            availableCredit: Number(result.employee.available_credit),
            monthlySalary: Number(result.employee.monthly_salary || 0),
            department: result.employee.department,
            jobTitle: result.employee.job_title || null,
            status: result.employee.status,
          },
          fpEmployeeId: result.fpEmployeeId,
          plainPassword: result.plainPassword,
        });
      } catch (err) {
        if (err.statusCode === 409) {
          return reply.code(409).send({ error: err.message });
        }
        throw err;
      }
    }
  );

  // --------------------------------------------------------------------------
  // 5. Get Employee Details
  // --------------------------------------------------------------------------
  fastify.get(
    '/org/employees/:fpId',
    { preHandler: [requireRole('ORG_ADMIN', 'ORG_CONTROLLER')] },
    async (request, reply) => {
      const { fpId } = request.params;
      const employeeRaw = await employeeRepo.findByFpId(fpId);

      if (!employeeRaw || employeeRaw.organization_id !== request.user.orgId) {
        return reply.code(404).send({ error: 'Employee not found in your organization' });
      }

      const entity = new Employee(employeeRaw);

      return reply.send({
        employee: {
          id: entity.id,
          fpEmployeeId: entity.fpEmployeeId,
          fullName: entity.fullName,
          phoneNumber: entity.phoneNumber,
          department: entity.department,
          creditLimit: entity.creditLimit,
          availableCredit: entity.availableCredit,
          spentCredit: entity.spentCredit,
          utilizationPct: entity.creditUtilizationPct,
          status: entity.status,
          createdAt: entity.createdAt,
        },
      });
    }
  );

  // --------------------------------------------------------------------------
  // 6. Update Employee Credit Limit (ORG_ADMIN only, PATCH and POST supported)
  // --------------------------------------------------------------------------
  const handleCreditUpdate = async (request, reply) => {
    const { fpId } = request.params;
    const parse = updateCreditSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.code(400).send({ error: 'Validation error', details: parse.error.issues });
    }

    const targetLimit = parse.data.creditLimit !== undefined ? parse.data.creditLimit : parse.data.newCreditLimit;
    if (targetLimit === undefined) {
      return reply.code(400).send({ error: 'creditLimit or newCreditLimit is required' });
    }

    const employeeRaw = await employeeRepo.findByFpId(fpId);

    if (!employeeRaw || employeeRaw.organization_id !== request.user.orgId) {
      return reply.code(404).send({ error: 'Employee not found in your organization' });
    }

    const entity = new Employee(employeeRaw);
    const validation = entity.canUpdateCreditLimit(targetLimit);
    if (!validation.allowed) {
      return reply.code(400).send({ error: validation.reason });
    }

    const updated = await employeeRepo.updateCreditLimit(employeeRaw.id, targetLimit);

    return reply.send({
      message: 'Credit limit updated successfully',
      creditLimit: Number(updated.credit_limit),
      availableCredit: Number(updated.available_credit),
    });
  };

  fastify.patch('/org/employees/:fpId/credit', { preHandler: [requireRole('ORG_ADMIN')] }, handleCreditUpdate);
  fastify.post('/org/employees/:fpId/credit', { preHandler: [requireRole('ORG_ADMIN')] }, handleCreditUpdate);
  fastify.patch('/org/employees/:fpId/credit-limit', { preHandler: [requireRole('ORG_ADMIN')] }, handleCreditUpdate);
  fastify.post('/org/employees/:fpId/credit-limit', { preHandler: [requireRole('ORG_ADMIN')] }, handleCreditUpdate);

  // --------------------------------------------------------------------------
  // 7. List Pending Password Reset Requests
  // --------------------------------------------------------------------------
  fastify.get(
    '/org/password-reset-requests',
    { preHandler: [requireRole('ORG_ADMIN', 'ORG_CONTROLLER')] },
    async (request, reply) => {
      const { orgId } = request.user;
      const requests = await employeeRepo.listPasswordResetRequests(orgId, 'PENDING');
      return reply.send({ requests });
    }
  );

  // --------------------------------------------------------------------------
  // 8. Review Password Reset Request (Supports both PATCH and POST)
  // --------------------------------------------------------------------------
  const handleResetReview = async (request, reply) => {
    const { id } = request.params;
    if (!id || id === 'undefined' || id.trim() === '') {
      return reply.code(400).send({ error: 'Valid password reset request ID is required' });
    }

    const parse = resetReviewSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.code(400).send({ error: 'Validation error', details: parse.error.issues });
    }

    const resetReq = await employeeRepo.findPasswordResetRequestById(id);
    if (!resetReq || resetReq.organizationId !== request.user.orgId) {
      return reply.code(404).send({ error: 'Password reset request not found' });
    }

    if (resetReq.status !== 'PENDING') {
      return reply.code(400).send({ error: `Request is already ${resetReq.status}` });
    }

    const { action } = parse.data;
    const reviewerId = request.user.sub || request.user.id || null;

    if (action === 'APPROVE') {
      const newPassword = generateCompliantPassword(16);
      const newHash = await hashPassword(newPassword);

      await employeeRepo.approvePasswordReset(id, reviewerId, newHash);

      if (resetReq.deliveryMethod === 'SMS' && notificationService && typeof notificationService.sendPasswordResetApprovedSms === 'function') {
        try {
          await notificationService.sendPasswordResetApprovedSms({
            to: resetReq.phoneNumber,
            newPassword,
          });
        } catch (err) {
          console.warn(`[SMS delivery warning]: ${err.message}`);
        }
      }

      return reply.send({
        approved: true,
        message: 'Password reset approved. Provide this new 16-character password to the employee.',
        newPassword,
        deliveryMethod: resetReq.deliveryMethod,
      });
    } else {
      await employeeRepo.rejectPasswordReset(id, reviewerId);
      return reply.send({
        approved: false,
        message: 'Password reset request was rejected.',
      });
    }
  };

  fastify.patch('/org/password-reset-requests/:id', { preHandler: [requireRole('ORG_ADMIN'), validateUUIDParams(['id'])] }, handleResetReview);
  fastify.post('/org/password-reset-requests/:id', { preHandler: [requireRole('ORG_ADMIN'), validateUUIDParams(['id'])] }, handleResetReview);

  // --------------------------------------------------------------------------
  // 9. Organization Credit Policy (GET / PATCH)
  // --------------------------------------------------------------------------
  fastify.get(
    '/org/credit-policy',
    { preHandler: [requireRole('ORG_ADMIN', 'ORG_CONTROLLER')] },
    async (request, reply) => {
      const policy = await employeeRepo.getOrgCreditPolicy(request.user.orgId);
      return reply.send({
        policy: policy || {
          global_credit_limit: 0,
          allowed_categories: ['FOOD', 'TRANSPORT', 'HEALTH', 'GROCERY', 'FUEL'],
        },
      });
    }
  );

  fastify.patch(
    '/org/credit-policy',
    { preHandler: [requireRole('ORG_ADMIN')] },
    async (request, reply) => {
      const parse = creditPolicySchema.safeParse(request.body);
      if (!parse.success) {
        return reply.code(400).send({ error: 'Validation error', details: parse.error.issues });
      }

      const policy = await employeeRepo.updateOrgCreditPolicy(request.user.orgId, parse.data);
      return reply.send({
        message: 'Credit policy updated successfully',
        policy,
      });
    }
  );

  // --------------------------------------------------------------------------
  // 10. Configure M-PESA Shortcode
  // --------------------------------------------------------------------------
  fastify.post(
    '/org/mpesa-config',
    { preHandler: [requireRole('ORG_ADMIN')] },
    async (request, reply) => {
      const parse = mpesaConfigSchema.safeParse(request.body);
      if (!parse.success) {
        return reply.code(400).send({ error: 'Validation error', details: parse.error.issues });
      }

      const { mpesaShortcode } = parse.data;
      await employeeRepo.updateOrgMpesaShortcode(request.user.orgId, mpesaShortcode);

      return reply.send({
        message: 'M-PESA shortcode updated successfully',
        mpesaShortcode,
      });
    }
  );

  // --------------------------------------------------------------------------
  // 11. Organization Merchant Detail (for MerchantDetailDrawer)
  // --------------------------------------------------------------------------
  const getOrgMerchantDetailUseCase = new GetOrgMerchantDetailUseCase(txnRepo);

  fastify.get(
    '/org/merchants/:merchantId',
    { preHandler: [requireRole('ORG_ADMIN', 'ORG_CONTROLLER'), validateUUIDParams(['merchantId'])] },
    async (request, reply) => {
      const { orgId } = request.user;
      const { merchantId } = request.params;
      const { page, limit } = request.query;

      const result = await getOrgMerchantDetailUseCase.execute({
        orgId,
        merchantId,
        page: page ? Number(page) : 1,
        limit: limit ? Number(limit) : 20,
      });

      return reply.send(result);
    }
  );

  fastify.get(
    '/org/merchants/:merchantId/statement',
    { preHandler: [requireRole('ORG_ADMIN', 'ORG_CONTROLLER'), validateUUIDParams(['merchantId'])] },
    async (request, reply) => {
      const { orgId } = request.user;
      const { merchantId } = request.params;

      const detail = await getOrgMerchantDetailUseCase.execute({
        orgId,
        merchantId,
        limit: 100,
      });

      const merchant = (await merchantRepo.findById(merchantId)) || { id: merchantId, business_name: 'Merchant' };

      const pdfBuffer = await generateStatement({
        merchant,
        summary: detail.summary,
        transactions: detail.transactions,
        byEmployee: detail.byEmployee,
      });

      reply.header('Content-Type', 'application/pdf');
      reply.header('Content-Disposition', `attachment; filename="flexpay-statement-${merchant.business_name || merchantId}.pdf"`);
      return reply.send(pdfBuffer);
    }
  );
}

module.exports = organizationRoutes;
