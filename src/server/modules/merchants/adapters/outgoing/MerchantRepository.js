const { getDb } = require('../../../../infrastructure/database/client');

class MerchantRepository {
  constructor(db) {
    this.db = db || getDb();
  }

  async findById(merchantId) {
    return this.db
      .selectFrom('merchants')
      .selectAll()
      .where('id', '=', merchantId)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();
  }

  async findByMpesaNumber(mpesaNumber) {
    return this.db
      .selectFrom('merchants')
      .selectAll()
      .where('mpesa_number', '=', mpesaNumber)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();
  }

  async getReceivablesSummary(merchantId) {
    // Aggregates receivables from transactions
    const txns = await this.db
      .selectFrom('transactions')
      .selectAll()
      .where('merchant_id', '=', merchantId)
      .where('status', '=', 'COMPLETED')
      .execute();

    const pendingTxns = txns.filter((t) => !t.settlement_id);
    const settledTxns = txns.filter((t) => !!t.settlement_id);

    let totalOutstandingReceivables = 0;
    const orgMap = new Map();
    const uniqueEmployees = new Set();

    for (const t of pendingTxns) {
      const credit = Number(t.credit_portion || 0);
      totalOutstandingReceivables += credit;
      uniqueEmployees.add(t.employee_id);

      const existingOrg = orgMap.get(t.organization_id) || {
        orgId: t.organization_id,
        orgName: t.org_name_snapshot,
        totalOwed: 0,
        employees: new Set(),
      };
      existingOrg.totalOwed += credit;
      existingOrg.employees.add(t.employee_id);
      orgMap.set(t.organization_id, existingOrg);
    }

    const receivablesByOrg = Array.from(orgMap.values()).map((o) => ({
      orgId: o.orgId,
      orgName: o.orgName,
      totalOwed: Number(o.totalOwed.toFixed(2)),
      employeeCount: o.employees.size,
    }));

    // Calculate total settled payout amounts
    const settledTxnSum = settledTxns.reduce((acc, t) => acc + Number(t.credit_portion || 0), 0);
    let totalSettledDisbursements = 0;
    try {
      const settledLines = await this.db
        .selectFrom('payroll_disbursement_lines')
        .select(['amount', 'status'])
        .where('merchant_id', '=', merchantId)
        .where('recipient_type', '=', 'MERCHANT')
        .where('status', '=', 'COMPLETED')
        .execute();
      totalSettledDisbursements = settledLines.reduce((acc, l) => acc + Number(l.amount || 0), 0);
    } catch {
      totalSettledDisbursements = settledTxnSum;
    }

    const totalSettledAmount = Number((totalSettledDisbursements > 0 ? totalSettledDisbursements : settledTxnSum).toFixed(2));

    // Calculate today's sales
    const todayStr = new Date().toISOString().split('T')[0];
    const todayTxns = txns.filter((t) => {
      const d = t.created_at ? new Date(t.created_at).toISOString().split('T')[0] : '';
      return d === todayStr;
    });
    const todaySales = Number(todayTxns.reduce((acc, t) => acc + Number(t.total_amount || 0), 0).toFixed(2));

    return {
      totalOutstandingReceivables: Number(totalOutstandingReceivables.toFixed(2)),
      totalSettledAmount,
      uniqueOrganizations: orgMap.size,
      uniqueEmployees: uniqueEmployees.size,
      totalTransactions: txns.length,
      todaySales,
      receivablesByOrg,
      // Compatibility aliases:
      totalReceivables: Number(totalOutstandingReceivables.toFixed(2)),
      totalDue: Number(totalOutstandingReceivables.toFixed(2)),
      totalSettled: totalSettledAmount,
      partnerOrgCount: orgMap.size,
      breakdownByOrg: receivablesByOrg,
    };
  }

  async getKPIs(merchantId, period = 'month') {
    const summary = await this.getReceivablesSummary(merchantId);

    // Fetch all completed transactions for this merchant to compute accurate analytics
    const txns = await this.db
      .selectFrom('transactions')
      .selectAll()
      .where('merchant_id', '=', merchantId)
      .where('status', '=', 'COMPLETED')
      .execute();

    const totalVolume = Number(txns.reduce((acc, t) => acc + Number(t.total_amount || 0), 0).toFixed(2));
    const totalCredit = Number(txns.reduce((acc, t) => acc + Number(t.credit_portion || 0), 0).toFixed(2));
    const totalCopay = Number(txns.reduce((acc, t) => acc + Number(t.copay_portion || 0), 0).toFixed(2));
    const count = txns.length;
    const avgTicket = count > 0 ? Number((totalVolume / count).toFixed(2)) : 0;
    const splitRatioPercent = totalVolume > 0 ? Math.round((totalCredit / totalVolume) * 100) : 100;

    return {
      // Primary Volume & Ticket Metrics
      totalVolume: totalVolume > 0 ? totalVolume : Number(summary.totalOutstandingReceivables || 0),
      totalCredit,
      totalCopay,
      avgTicket,
      avgTicketSize: avgTicket,
      splitRatio: `${splitRatioPercent}%`,
      splitPercent: splitRatioPercent,

      // Receivables & Settled Balances
      totalReceivable: summary.totalOutstandingReceivables,
      totalReceivables: summary.totalOutstandingReceivables,
      totalSettled: summary.totalSettledAmount,
      totalSettledAmount: summary.totalSettledAmount,

      // Activity & Entity Metrics
      totalTransactions: count,
      transactionCount: count,
      uniqueEmployees: summary.uniqueEmployees,
      uniqueOrganizations: summary.uniqueOrganizations,
    };
  }

  async getCreditByCategory(merchantId, period = 'month') {
    const txns = await this.db
      .selectFrom('transactions')
      .select(['category_snapshot', 'credit_portion', 'total_amount'])
      .where('merchant_id', '=', merchantId)
      .where('status', '=', 'COMPLETED')
      .execute();

    const catMap = new Map();
    for (const t of txns) {
      const cat = t.category_snapshot || 'GENERAL';
      const prev = catMap.get(cat) || { category: cat, totalCredit: 0, count: 0 };
      prev.totalCredit = Number((prev.totalCredit + Number(t.credit_portion || 0)).toFixed(2));
      prev.count++;
      catMap.set(cat, prev);
    }
    return Array.from(catMap.values());
  }

  async getCreditByOrg(merchantId, period = 'month') {
    const txns = await this.db
      .selectFrom('transactions')
      .select([
        'organization_id',
        'org_name_snapshot',
        'credit_portion',
        'total_amount',
        'employee_id',
      ])
      .where('merchant_id', '=', merchantId)
      .where('status', '=', 'COMPLETED')
      .execute();

    const orgMap = new Map();
    for (const t of txns) {
      const orgId = t.organization_id || 'UNKNOWN';
      const prev = orgMap.get(orgId) || {
        orgId,
        orgName: t.org_name_snapshot || 'Employer Organization',
        org_name: t.org_name_snapshot || 'Employer Organization',
        totalCredit: 0,
        total_credit: 0,
        totalVolume: 0,
        amount: 0,
        totalOwed: 0,
        employees: new Set(),
      };
      const credit = Number(t.credit_portion || 0);
      const total = Number(t.total_amount || credit);
      prev.totalCredit = Number((prev.totalCredit + credit).toFixed(2));
      prev.total_credit = prev.totalCredit;
      prev.totalVolume = Number((prev.totalVolume + total).toFixed(2));
      prev.amount = prev.totalCredit;
      prev.totalOwed = prev.totalCredit;
      if (t.employee_id) prev.employees.add(t.employee_id);
      orgMap.set(orgId, prev);
    }

    if (orgMap.size > 0) {
      return Array.from(orgMap.values())
        .map((o) => ({
          ...o,
          employeeCount: o.employees.size,
        }))
        .sort((a, b) => b.totalCredit - a.totalCredit);
    }

    const summary = await this.getReceivablesSummary(merchantId);
    return (summary.receivablesByOrg || []).map((o) => ({
      ...o,
      org_name: o.orgName,
      total_credit: o.totalOwed,
      amount: o.totalOwed,
      totalCredit: o.totalOwed,
    }));
  }

  async getDailyVolume(merchantId, days = 30) {
    const txns = await this.db
      .selectFrom('transactions')
      .select(['created_at', 'total_amount', 'credit_portion'])
      .where('merchant_id', '=', merchantId)
      .where('status', '=', 'COMPLETED')
      .orderBy('created_at', 'asc')
      .execute();

    const dayMap = new Map();
    for (const t of txns) {
      const day = new Date(t.created_at).toISOString().split('T')[0];
      const prev = dayMap.get(day) || { date: day, volume: 0, count: 0 };
      prev.volume = Number((prev.volume + Number(t.total_amount || 0)).toFixed(2));
      prev.count++;
      dayMap.set(day, prev);
    }
    return Array.from(dayMap.values());
  }

  async getTopEmployees(merchantId, period = 'month', limit = 10) {
    const txns = await this.db
      .selectFrom('transactions')
      .select([
        'employee_id',
        'employee_fp_id_snapshot',
        'employee_name_snapshot',
        'org_name_snapshot',
        'credit_portion',
        'total_amount',
        'created_at',
      ])
      .where('merchant_id', '=', merchantId)
      .where('status', '=', 'COMPLETED')
      .execute();

    const empMap = new Map();
    for (const t of txns) {
      const key = t.employee_id;
      const prev = empMap.get(key) || {
        employeeId: key,
        fpEmployeeId: t.employee_fp_id_snapshot,
        fp_employee_id: t.employee_fp_id_snapshot,
        fpId: t.employee_fp_id_snapshot,
        name: t.employee_name_snapshot || 'Customer',
        employee_name: t.employee_name_snapshot || 'Customer',
        orgName: t.org_name_snapshot,
        totalSpent: 0,
        total_amount: 0,
        spent: 0,
        visitCount: 0,
        lastVisit: t.created_at,
      };
      const credit = Number(t.credit_portion || t.total_amount || 0);
      prev.totalSpent = Number((prev.totalSpent + credit).toFixed(2));
      prev.total_amount = prev.totalSpent;
      prev.spent = prev.totalSpent;
      prev.visitCount++;
      if (new Date(t.created_at) > new Date(prev.lastVisit)) {
        prev.lastVisit = t.created_at;
      }
      empMap.set(key, prev);
    }
    return Array.from(empMap.values())
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, limit);
  }
}

module.exports = { MerchantRepository };
