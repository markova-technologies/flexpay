class GetMerchantAnalyticsUseCase {
  constructor(merchantRepo) {
    this.merchantRepo = merchantRepo;
  }

  async execute({ merchantId, period = 'month' }) {
    const [
      kpis,
      creditByCategory,
      creditByOrg,
      dailyVolume,
      topEmployees,
    ] = await Promise.all([
      this.merchantRepo.getKPIs ? this.merchantRepo.getKPIs(merchantId, period) : this.merchantRepo.getReceivablesSummary(merchantId),
      this.merchantRepo.getCreditByCategory ? this.merchantRepo.getCreditByCategory(merchantId, period) : Promise.resolve([]),
      this.merchantRepo.getCreditByOrg ? this.merchantRepo.getCreditByOrg(merchantId, period) : Promise.resolve([]),
      this.merchantRepo.getDailyVolume ? this.merchantRepo.getDailyVolume(merchantId, 30) : Promise.resolve([]),
      this.merchantRepo.getTopEmployees ? this.merchantRepo.getTopEmployees(merchantId, period, 10) : Promise.resolve([]),
    ]);

    return { kpis, creditByCategory, creditByOrg, dailyVolume, topEmployees };
  }
}

module.exports = { GetMerchantAnalyticsUseCase };
