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
      .select([
        'organization_id',
        'org_name_snapshot',
        'credit_portion',
        'employee_id',
      ])
      .where('merchant_id', '=', merchantId)
      .where('status', '=', 'COMPLETED')
      .execute();

    let totalOutstandingReceivables = 0;
    const orgMap = new Map();
    const uniqueEmployees = new Set();

    for (const t of txns) {
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
}

module.exports = { MerchantRepository };
