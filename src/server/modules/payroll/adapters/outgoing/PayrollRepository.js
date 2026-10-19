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

  async updateLineConversationId(lineId, mpesaConversationId) {
    return this.db
      .updateTable('payroll_disbursement_lines')
      .set({
        mpesa_conversation_id: mpesaConversationId,
        dispatched_at: new Date(),
      })
      .where('id', '=', lineId)
      .returningAll()
      .executeTakeFirst();
  }

  async listLinesBySettlementId(settlementId) {
    return this.db
      .selectFrom('payroll_disbursement_lines')
      .selectAll()
      .where('settlement_id', '=', settlementId)
      .orderBy('created_at', 'asc')
      .execute();
  }

  async linkTransactionsToSettlement(settlementId, transactionIds = []) {
    if (!Array.isArray(transactionIds) || transactionIds.length === 0) return;
    try {
      await this.db
        .updateTable('transactions')
        .set({
          settlement_id: settlementId,
          settled_at: new Date(),
        })
        .where('id', 'in', transactionIds)
        .execute();
    } catch (err) {
      console.warn('[PayrollRepository] linkTransactionsToSettlement note:', err.message);
    }
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

  async completeSettlementImmediately(settlementId) {
    const settlement = await this.findSettlementById(settlementId);
    if (!settlement) throw new Error(`Settlement ${settlementId} not found`);

    const lines = await this.listLinesBySettlementId(settlementId);
    const completedLines = [];

    for (const line of lines) {
      if (line.status !== 'COMPLETED') {
        const receipt = line.mpesa_receipt || `MP_B2C_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
        const updated = await this.markLineCompleted(line.id, receipt);
        completedLines.push(updated);
      } else {
        completedLines.push(line);
      }
    }

    // Reset employee credit accounts
    await this.resetCreditForSettlement(settlementId);

    // Mark master settlement COMPLETED
    const updatedSettlement = await this.markSettlementCompleted(settlementId);

    // Mark transactions for this org as settled
    try {
      await this.db
        .updateTable('transactions')
        .set({
          settlement_id: settlementId,
          settled_at: new Date(),
        })
        .where('organization_id', '=', settlement.organization_id)
        .where('status', '=', 'COMPLETED')
        .where('settlement_id', 'is', null)
        .execute();
    } catch (err) {
      console.warn('[PayrollRepository] Auto-settle transactions note:', err.message);
    }

    return {
      settlement: updatedSettlement,
      lines: completedLines,
    };
  }
}

module.exports = { PayrollRepository };
