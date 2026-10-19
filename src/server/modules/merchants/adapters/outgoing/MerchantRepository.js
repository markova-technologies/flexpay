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

    return {
      totalOutstandingReceivables: Number(totalOutstandingReceivables.toFixed(2)),
      uniqueOrganizations: orgMap.size,
      uniqueEmployees: uniqueEmployees.size,
      totalTransactions: txns.length,
      receivablesByOrg,
    };
  }

  async getKPIs(merchantId, period = 'month') {
    const summary = await this.getReceivablesSummary(merchantId);
    return {
      totalReceivable: summary.totalOutstandingReceivables,
      totalTransactions: summary.totalTransactions,
      uniqueEmployees: summary.uniqueEmployees,
      uniqueOrganizations: summary.uniqueOrganizations,
      avgTicketSize: summary.totalTransactions > 0
        ? Number((summary.totalOutstandingReceivables / summary.totalTransactions).toFixed(2))
        : 0,
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
    const summary = await this.getReceivablesSummary(merchantId);
    return summary.receivablesByOrg;
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
        name: t.employee_name_snapshot,
        orgName: t.org_name_snapshot,
        totalSpent: 0,
        visitCount: 0,
        lastVisit: t.created_at,
      };
      prev.totalSpent = Number((prev.totalSpent + Number(t.credit_portion || 0)).toFixed(2));
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
