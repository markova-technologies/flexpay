/**
 * Returns all transactions at a specific merchant from this org's employees.
 * Used by the MerchantDetailDrawer on the org dashboard.
 */
class GetOrgMerchantDetailUseCase {
  constructor(transactionRepo) {
    this.transactionRepo = transactionRepo;
  }

  async execute({ orgId, merchantId, page = 1, limit = 20 }) {
    const offset = (Math.max(1, page) - 1) * limit;

    const [summary, transactions, byEmployee] = await Promise.all([
      this.transactionRepo.getMerchantSummaryForOrg
        ? this.transactionRepo.getMerchantSummaryForOrg(orgId, merchantId)
        : Promise.resolve({ totalCredit: 0, employeeCount: 0, transactionCount: 0 }),
      this.transactionRepo.getTransactionsByOrgAndMerchant
        ? this.transactionRepo.getTransactionsByOrgAndMerchant(orgId, merchantId, limit, offset)
        : Promise.resolve([]),
      this.transactionRepo.getTransactionsByEmployeeForMerchant
        ? this.transactionRepo.getTransactionsByEmployeeForMerchant(orgId, merchantId)
        : Promise.resolve([]),
    ]);

    return { summary, transactions, byEmployee };
  }
}

module.exports = { GetOrgMerchantDetailUseCase };
