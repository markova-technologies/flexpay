const { authenticate } = require('../../../../shared/middleware/authenticate');
const { requireRole } = require('../../../../shared/middleware/requireRole');
const { EmployeeRepository } = require('../outgoing/EmployeeRepository');
const { TransactionRepository } = require('../../../transactions/adapters/outgoing/TransactionRepository');
const { Employee } = require('../../domain/Employee');
const QRCode = require('qrcode');

async function employeeRoutes(fastify, options) {
  const employeeRepo = options.employeeRepo || new EmployeeRepository(options.db);
  const txnRepo = options.transactionRepo || new TransactionRepository(options.db);

  fastify.addHook('preHandler', authenticate);

  // --------------------------------------------------------------------------
  // 1. Employee Dashboard Overview
  // --------------------------------------------------------------------------
  fastify.get(
    '/employee/dashboard',
    { preHandler: [requireRole('EMPLOYEE')] },
    async (request, reply) => {
      const employeeId = request.user.employeeId;
      const employeeRaw = await employeeRepo.findById(employeeId);

      if (!employeeRaw || employeeRaw.status !== 'ACTIVE') {
        return reply.code(404).send({ error: 'Employee account not found or inactive' });
      }

      const entity = new Employee(employeeRaw);
      const recentTransactions = await txnRepo.listRecentByEmployee(employeeId, 20);

      // Compute spending by category
      const categoryMap = new Map();
      for (const txn of recentTransactions) {
        if (txn.status === 'COMPLETED') {
          const cat = txn.category_snapshot || 'GENERAL';
          const amt = Number(txn.credit_portion || 0);
          categoryMap.set(cat, (categoryMap.get(cat) || 0) + amt);
        }
      }

      const spendingByCategory = Array.from(categoryMap.entries()).map(([category, total]) => ({
        category,
        total: Number(total.toFixed(2)),
      }));

      return reply.send({
        creditLimit: entity.creditLimit,
        availableCredit: entity.availableCredit,
        spentCredit: entity.spentCredit,
        spentThisMonth: entity.spentCredit,
        fpEmployeeId: entity.fpEmployeeId,
        fullName: entity.fullName,
        organizationName: employeeRaw.organization_name || 'Organization',
        employee: {
          fpEmployeeId: entity.fpEmployeeId,
          fullName: entity.fullName,
          organizationName: employeeRaw.organization_name || 'Organization',
          creditLimit: entity.creditLimit,
          availableCredit: entity.availableCredit,
          spentCredit: entity.spentCredit,
          spentThisMonth: entity.spentCredit,
          utilizationPct: entity.creditUtilizationPct,
        },
        recentTransactions,
        spendingByCategory,
      });
    }
  );

  // --------------------------------------------------------------------------
  // 2. Employee QR Code for Merchant POS Scanning
  // --------------------------------------------------------------------------
  fastify.get(
    '/employee/qr-code',
    { preHandler: [requireRole('EMPLOYEE')] },
    async (request, reply) => {
      const employeeId = request.user.employeeId;
      const employeeRaw = await employeeRepo.findById(employeeId);

      if (!employeeRaw) {
        return reply.code(404).send({ error: 'Employee account not found' });
      }

      const fpEmployeeId = employeeRaw.fp_employee_id;
      const qrDataUrl = await QRCode.toDataURL(fpEmployeeId, {
        errorCorrectionLevel: 'H',
        width: 320,
        margin: 2,
        color: {
          dark: '#0a0b0d',
          light: '#ffffff',
        },
      });

      return reply.send({
        fpEmployeeId,
        fullName: employeeRaw.full_name,
        qrDataUrl,
        qrCodeDataUrl: qrDataUrl,
      });
    }
  );
}

module.exports = employeeRoutes;
