class RunPayrollUseCase {
  constructor({ payrollRepository, transactionRepository, employeeRepository, mpesaB2CService } = {}) {
    this.payrollRepo = payrollRepository;
    this.txnRepo = transactionRepository;
    this.empRepo = employeeRepository;
    this.mpesa = mpesaB2CService;
  }

  async execute({
    organizationId,
    periodStart,
    periodEnd,
    employeeSalaries = [],
    initiatedBy,
    autoComplete = false,
  } = {}) {
    if (!organizationId) throw new Error('organizationId is required');
    if (!periodStart || !periodEnd) throw new Error('periodStart and periodEnd are required');

    // 1. Fetch completed, unsettled transactions for this organization
    const allTxns = await this.txnRepo.listRecentByOrg(organizationId, 5000);
    const completedTxns = allTxns.filter((t) => t.status === 'COMPLETED' && !t.settlement_id);

    // 2. Aggregate owed amounts by merchant
    const merchantMap = new Map();
    const employeeCreditMap = new Map();

    let totalMerchantDisbursements = 0;

    for (const t of completedTxns) {
      const credit = Number(t.credit_portion || 0);
      if (credit <= 0) continue;

      totalMerchantDisbursements += credit;

      // Group merchant
      const mKey = t.merchant_id;
      const mData = merchantMap.get(mKey) || {
        merchantId: mKey,
        merchantName: t.merchant_name_snapshot,
        merchantMpesaNumber: t.merchant_mpesa_snapshot,
        amount: 0,
      };
      mData.amount = Number((mData.amount + credit).toFixed(2));
      merchantMap.set(mKey, mData);

      // Group employee
      const eKey = t.employee_id;
      employeeCreditMap.set(eKey, (employeeCreditMap.get(eKey) || 0) + credit);
    }

    // 3. Compute employee net salaries
    const employeeDisbursements = [];
    let totalEmployeeDisbursements = 0;

    let salariesToProcess = employeeSalaries;
    if ((!salariesToProcess || salariesToProcess.length === 0) && typeof this.empRepo?.findByOrgId === 'function') {
      try {
        const activeEmps = await this.empRepo.findByOrgId(organizationId, { limit: 1000 });
        salariesToProcess = (activeEmps || []).map((e) => ({
          employeeId: e.id,
          grossSalary: Number(e.monthly_salary || e.monthlySalary || e.credit_limit || 0),
          phoneNumber: e.phone_number || e.phoneNumber,
          fullName: e.full_name || e.fullName,
        }));
      } catch (err) {
        console.warn('[RunPayrollUseCase] findByOrgId error:', err.message);
      }
    }

    for (const sal of (salariesToProcess || [])) {
      let empRecord = null;
      if (typeof this.empRepo?.findById === 'function') {
        try {
          empRecord = await this.empRepo.findById(sal.employeeId);
        } catch {}
      }

      const gross = Number(
        sal.grossSalary !== undefined
          ? sal.grossSalary
          : (empRecord?.monthly_salary ?? empRecord?.monthlySalary ?? empRecord?.credit_limit ?? 0)
      );
      const creditUsed = Number(employeeCreditMap.get(sal.employeeId) || 0);
      const netSalary = Math.max(0, Number((gross - creditUsed).toFixed(2)));

      totalEmployeeDisbursements += netSalary;

      const recipientPhone =
        sal.phoneNumber ||
        sal.recipientMpesaNumber ||
        empRecord?.phone_number ||
        empRecord?.phoneNumber ||
        '251700000000';

      const fullName =
        sal.fullName ||
        empRecord?.full_name ||
        empRecord?.fullName ||
        'Enrolled Employee';

      employeeDisbursements.push({
        employeeId: sal.employeeId,
        recipientMpesaNumber: recipientPhone,
        fullName,
        grossSalary: gross,
        creditDeducted: creditUsed,
        amount: netSalary,
      });
    }

    // 4. Create master settlement record
    const settlement = await this.payrollRepo.createSettlement({
      organizationId,
      periodStart,
      periodEnd,
      totalMerchantDisbursements: Number(totalMerchantDisbursements.toFixed(2)),
      totalEmployeeDisbursements: Number(totalEmployeeDisbursements.toFixed(2)),
      initiatedBy,
    });

    // 5. Prepare disbursement line items
    const linesToCreate = [];

    // Merchant lines (B2C BusinessPayment)
    for (const m of merchantMap.values()) {
      linesToCreate.push({
        settlement_id: settlement.id,
        recipient_type: 'MERCHANT',
        merchant_id: m.merchantId,
        recipient_mpesa_number: m.merchantMpesaNumber,
        amount: m.amount,
        status: 'PENDING',
      });
    }

    // Employee net salary lines (B2C SalaryPayment)
    for (const e of employeeDisbursements) {
      if (e.amount > 0) {
        linesToCreate.push({
          settlement_id: settlement.id,
          recipient_type: 'EMPLOYEE',
          employee_id: e.employeeId,
          recipient_mpesa_number: e.recipientMpesaNumber,
          amount: e.amount,
          status: 'PENDING',
        });
      }
    }

    const createdLines = await this.payrollRepo.createDisbursementLines(linesToCreate);

    // 6. Dispatch B2C calls (async or in batch)
    for (const line of createdLines) {
      if (this.mpesa && typeof this.mpesa.sendB2C === 'function') {
        try {
          const res = await this.mpesa.sendB2C({
            commandId: line.recipient_type === 'MERCHANT' ? 'BusinessPayment' : 'SalaryPayment',
            amount: line.amount,
            recipientPhone: line.recipient_mpesa_number,
            remarks: `Payroll disbursement [${settlement.id}]`,
          });
          line.mpesa_conversation_id = res.conversationId;
          if (typeof this.payrollRepo.updateLineConversationId === 'function') {
            await this.payrollRepo.updateLineConversationId(line.id, res.conversationId);
          }
        } catch (err) {
          console.warn(`[Payroll B2C Dispatch Warning]: ${err.message}`);
        }
      } else {
        const mockConv = `MOCK_CONV_${Date.now()}_${line.id}`;
        line.mpesa_conversation_id = mockConv;
        if (typeof this.payrollRepo.updateLineConversationId === 'function') {
          await this.payrollRepo.updateLineConversationId(line.id, mockConv);
        }
      }
    }

    // 7. Associate settled transactions with settlement
    if (typeof this.payrollRepo.linkTransactionsToSettlement === 'function' && completedTxns.length > 0) {
      await this.payrollRepo.linkTransactionsToSettlement(
        settlement.id,
        completedTxns.map((t) => t.id)
      );
    }

    // 8. Auto-completion handling (for instant settlement / simulation mode)
    if (autoComplete) {
      for (const line of createdLines) {
        const mockReceipt = `MP-REC-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
        line.status = 'COMPLETED';
        line.mpesa_receipt = mockReceipt;
        line.completed_at = new Date();
        if (typeof this.payrollRepo.markLineCompleted === 'function') {
          await this.payrollRepo.markLineCompleted(line.id, mockReceipt);
        }
      }

      if (typeof this.payrollRepo.resetCreditForSettlement === 'function') {
        await this.payrollRepo.resetCreditForSettlement(settlement.id);
      }
      if (typeof this.payrollRepo.markSettlementCompleted === 'function') {
        const completedRecord = await this.payrollRepo.markSettlementCompleted(settlement.id);
        if (completedRecord) {
          settlement.status = completedRecord.status || 'COMPLETED';
          settlement.completed_at = completedRecord.completed_at || new Date();
        } else {
          settlement.status = 'COMPLETED';
          settlement.completed_at = new Date();
        }
      }
    }

    return {
      settlement,
      settlementId: settlement.id,
      totalMerchantDisbursements: Number(totalMerchantDisbursements.toFixed(2)),
      totalEmployeeDisbursements: Number(totalEmployeeDisbursements.toFixed(2)),
      merchantsCount: merchantMap.size,
      employeesCount: employeeDisbursements.length,
      disbursementLines: createdLines,
    };
  }
}

module.exports = { RunPayrollUseCase };
