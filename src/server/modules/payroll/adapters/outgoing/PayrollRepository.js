const { randomUUID } = require('node:crypto');
const { getDb } = require('../../../../infrastructure/database/client');

class PayrollRepository {
  constructor(db) {
    this.db = db || getDb();
  }

  async createSettlement({
    organizationId,
    periodStart,
    periodEnd,
    totalMerchantDisbursements,
    totalEmployeeDisbursements,
    initiatedBy,
  }) {
    return this.db
      .insertInto('payroll_settlements')
      .values({
        id: randomUUID(),
        organization_id: organizationId,
        period_start: periodStart,
        period_end: periodEnd,
        status: 'RUNNING',
        total_merchant_disbursements: totalMerchantDisbursements,
        total_employee_disbursements: totalEmployeeDisbursements,
        initiated_by: initiatedBy || null,
        initiated_at: new Date(),
      })
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async createDisbursementLines(lines) {
    if (!Array.isArray(lines) || lines.length === 0) return [];

    const inserted = [];
    for (const line of lines) {
      const res = await this.db
        .insertInto('payroll_disbursement_lines')
        .values({
          id: randomUUID(),
          settlement_id: line.settlement_id,
          recipient_type: line.recipient_type,
          merchant_id: line.merchant_id || null,
          employee_id: line.employee_id || null,
          recipient_mpesa_number: line.recipient_mpesa_number,
          amount: line.amount,
          status: line.status || 'PENDING',
          mpesa_conversation_id: line.mpesa_conversation_id || null,
          dispatched_at: line.dispatched_at || new Date(),
        })
        .returningAll()
        .executeTakeFirstOrThrow();
      inserted.push(res);
    }
    return inserted;
  }

  async findSettlementById(settlementId) {
    return this.db
      .selectFrom('payroll_settlements')
      .selectAll()
      .where('id', '=', settlementId)
      .executeTakeFirst();
  }

  async listSettlementsByOrg(organizationId) {
    return this.db
      .selectFrom('payroll_settlements')
      .selectAll()
      .where('organization_id', '=', organizationId)
      .orderBy('created_at', 'desc')
      .execute();
  }

  async findLineByConversationId(conversationId) {
    return this.db
      .selectFrom('payroll_disbursement_lines')
      .selectAll()
      .where('mpesa_conversation_id', '=', conversationId)
      .executeTakeFirst();
  }

  async markLineCompleted(lineId, mpesaReceipt) {
    return this.db
      .updateTable('payroll_disbursement_lines')
      .set({
        status: 'COMPLETED',
        mpesa_receipt: mpesaReceipt || null,
        completed_at: new Date(),
      })
      .where('id', '=', lineId)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async markLineFailed(lineId, failureReason) {
    return this.db
      .updateTable('payroll_disbursement_lines')
      .set({
        status: 'FAILED',
        completed_at: new Date(),
      })
      .where('id', '=', lineId)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async checkAllLinesComplete(settlementId) {
    const lines = await this.db
      .selectFrom('payroll_disbursement_lines')
      .select(['status'])
      .where('settlement_id', '=', settlementId)
      .execute();

    if (lines.length === 0) return false;
    return lines.every((l) => l.status === 'COMPLETED');
  }

  async markSettlementCompleted(settlementId) {
    return this.db
      .updateTable('payroll_settlements')
      .set({
        status: 'COMPLETED',
        completed_at: new Date(),
      })
      .where('id', '=', settlementId)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async resetCreditForSettlement(settlementId) {
    return this.db.transaction().execute(async (trx) => {
      const settlement = await trx
        .selectFrom('payroll_settlements')
        .selectAll()
        .where('id', '=', settlementId)
        .executeTakeFirstOrThrow();

      // Reset all employee credit accounts belonging to this organization to their maximum limit
      await trx
        .updateTable('employees')
        .set((eb) => ({
          available_credit: eb.ref('credit_limit'),
          updated_at: new Date(),
        }))
        .where('organization_id', '=', settlement.organization_id)
        .where('status', '=', 'ACTIVE')
        .execute();
    });
  }
}

module.exports = { PayrollRepository };
