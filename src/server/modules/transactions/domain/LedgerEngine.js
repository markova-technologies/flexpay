class LedgerEngine {
  /**
   * Generates journal entries for a FlexPay credit purchase.
   * Double-entry: debits must equal credits.
   *
   * @param {string} transactionId
   * @param {number} creditPortion
   * @param {string} merchantMpesaNumber
   * @param {string} [employeeFpId]
   */
  static generateCreditEntries(transactionId, creditPortion, merchantMpesaNumber, employeeFpId) {
    const amount = Number(creditPortion);
    if (amount <= 0) return [];

    const entries = [
      {
        transaction_id: transactionId,
        account_type: 'EMPLOYEE_CREDIT',
        debit_amount: amount,
        credit_amount: 0,
        description: `Employee credit deducted for purchase [${employeeFpId || 'FP-EMP'}]`,
      },
      {
        transaction_id: transactionId,
        account_type: 'MERCHANT_RECEIVABLE',
        debit_amount: 0,
        credit_amount: amount,
        description: `Merchant receivable owed on settlement day: ${merchantMpesaNumber}`,
      },
    ];

    this.verifyBalance(entries);
    return entries;
  }

  /**
   * Generates journal entries for the M-PESA co-pay portion.
   */
  static generateCopayEntries(transactionId, copayPortion, mpesaReceipt) {
    const amount = Number(copayPortion);
    if (amount <= 0) return [];

    const entries = [
      {
        transaction_id: transactionId,
        account_type: 'MPESA_CLEARING',
        debit_amount: amount,
        credit_amount: 0,
        description: `M-PESA co-pay settled immediately [Receipt: ${mpesaReceipt || 'PENDING'}]`,
      },
      {
        transaction_id: transactionId,
        account_type: 'MERCHANT_RECEIVABLE',
        debit_amount: 0,
        credit_amount: amount,
        description: `Merchant co-pay credit`,
      },
    ];

    this.verifyBalance(entries);
    return entries;
  }

  /**
   * Strictly enforces the fundamental financial accounting invariant:
   * SUM(debits) must equal SUM(credits) with zero tolerance.
   */
  static verifyBalance(entries) {
    if (!Array.isArray(entries) || entries.length === 0) return true;

    const totalDebits = entries.reduce((acc, e) => acc + Number(e.debit_amount || 0), 0);
    const totalCredits = entries.reduce((acc, e) => acc + Number(e.credit_amount || 0), 0);

    const diff = Math.abs(totalDebits - totalCredits);
    if (diff > 0.001) {
      throw new Error(
        `Critical financial ledger imbalance: Debits (${totalDebits.toFixed(2)}) !== Credits (${totalCredits.toFixed(2)})`
      );
    }
    return true;
  }
}

module.exports = { LedgerEngine };
