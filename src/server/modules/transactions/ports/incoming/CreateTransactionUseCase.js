const { randomBytes } = require('node:crypto');
const { SplitEngine } = require('../../domain/SplitEngine');
const { LedgerEngine } = require('../../domain/LedgerEngine');
const { validateEmployeeId } = require('../../../../shared/crypto/employeeIdGenerator');

class CreateTransactionUseCase {
  constructor({
    transactionRepository,
    employeeRepository,
    merchantRepository,
    mpesaStkService,
    notificationService,
  } = {}) {
    this.txnRepo = transactionRepository;
    this.empRepo = employeeRepository;
    this.mchRepo = merchantRepository;
    this.mpesa = mpesaStkService;
    this.notifications = notificationService;
  }

  async execute({ merchantId, fpEmployeeId, totalAmount }) {
    if (!merchantId) throw new Error('merchantId is required');
    if (!fpEmployeeId) throw new Error('fpEmployeeId is required');

    const amount = Number(totalAmount);
    if (isNaN(amount) || amount <= 0) {
      const err = new Error('Transaction amount must be greater than zero');
      err.statusCode = 400;
      throw err;
    }

    // 1. Check format of Employee ID
    const idCheck = validateEmployeeId(fpEmployeeId);
    if (!idCheck.valid) {
      const err = new Error('Invalid FlexPay Employee ID format or checksum');
      err.statusCode = 400;
      throw err;
    }

    // 2. Fetch employee
    const employee = await this.empRepo.findByFpId(fpEmployeeId);
    if (!employee || employee.status !== 'ACTIVE') {
      const err = new Error('Employee account is inactive or not found');
      err.statusCode = 404;
      throw err;
    }

    // 3. Fetch merchant
    const merchant = await this.mchRepo.findById(merchantId);
    if (!merchant || merchant.status !== 'ACTIVE') {
      const err = new Error('Merchant is not active or verified');
      err.statusCode = 403;
      throw err;
    }

    // 4. Validate organization category policy
    const policy = await this.empRepo.getOrgCreditPolicy(employee.organization_id);
    if (policy && Array.isArray(policy.allowed_categories) && policy.allowed_categories.length > 0) {
      const isAllowed = policy.allowed_categories.includes(merchant.category);
      if (!isAllowed) {
        const err = new Error(
          `Merchant category '${merchant.category}' is not eligible under this organization's credit policy`
        );
        err.statusCode = 403;
        throw err;
      }
    }

    // 5. Check max single transaction limit
    if (policy && policy.max_single_transaction && amount > Number(policy.max_single_transaction)) {
      const err = new Error(
        `Transaction exceeds maximum single spend limit of ETB ${policy.max_single_transaction}`
      );
      err.statusCode = 400;
      throw err;
    }

    // 6. Calculate Split
    const split = SplitEngine.calculate(amount, Number(employee.available_credit));

    // 7. Generate reference
    const suffix = randomBytes(4).toString('hex').toUpperCase();
    const fpTxnRef = `FP-TXN-${Date.now()}-${suffix}`;

    // 8. Generate double-entry ledger entries for credit portion
    const journalEntries = LedgerEngine.generateCreditEntries(
      fpTxnRef,
      split.creditPortion,
      merchant.mpesa_number,
      employee.fp_employee_id
    );

    // Initial status
    const initialStatus = split.requiresStkPush ? 'STK_SENT' : 'COMPLETED';

    // 9. Atomically record transaction and debit credit
    const txn = await this.txnRepo.createTransactionWithEntries(
      {
        fp_transaction_ref: fpTxnRef,
        employee_id: employee.id,
        merchant_id: merchant.id,
        organization_id: employee.organization_id,
        employee_fp_id_snapshot: employee.fp_employee_id,
        employee_name_snapshot: employee.full_name,
        employee_phone_snapshot: employee.phone_number,
        org_name_snapshot: employee.organization_name || 'Organization',
        merchant_name_snapshot: merchant.business_name,
        merchant_mpesa_snapshot: merchant.mpesa_number,
        category_snapshot: merchant.category,
        total_amount: split.totalAmount,
        credit_portion: split.creditPortion,
        copay_portion: split.copayPortion,
        status: initialStatus,
      },
      journalEntries
    );

    // 10. If co-pay required, trigger M-PESA STK Push
    let stkPushInitiated = false;
    let checkoutRequestId = null;

    if (split.requiresStkPush) {
      if (this.mpesa && typeof this.mpesa.initiateStkPush === 'function') {
        try {
          const stkRes = await this.mpesa.initiateStkPush({
            phoneNumber: employee.phone_number,
            amount: split.copayPortion,
            transactionRef: fpTxnRef,
            description: `FlexPay co-pay for ${merchant.business_name}`,
          });
          checkoutRequestId = stkRes.checkoutRequestId;
          stkPushInitiated = true;
          // Update transaction with checkoutRequestId
          await this.txnRepo.updateStatus(txn.id, 'STK_SENT', null);
        } catch (err) {
          // If STK push immediately fails to dispatch, reverse credit reservation
          await this.txnRepo.reverseCreditReservation(txn.id);
          const dispatchErr = new Error(`Failed to initiate M-PESA co-pay STK push: ${err.message}`);
          dispatchErr.statusCode = 502;
          throw dispatchErr;
        }
      } else {
        // Mock fallback for testing
        checkoutRequestId = `ws_CO_MOCK_${Date.now()}`;
        stkPushInitiated = true;
      }
    }

    return {
      transaction: txn,
      fpTransactionRef: fpTxnRef,
      totalAmount: split.totalAmount,
      creditPortion: split.creditPortion,
      copayPortion: split.copayPortion,
      requiresStkPush: split.requiresStkPush,
      stkPushInitiated,
      checkoutRequestId,
      status: initialStatus,
    };
  }
}

module.exports = { CreateTransactionUseCase };
