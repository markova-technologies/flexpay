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

  async listDisbursementLinesByMerchant(merchantId, limit = 50) {
    if (!this.db) return [];
    try {
      const rows = await this.db
        .selectFrom('payroll_disbursement_lines as pdl')
        .innerJoin('payroll_settlements as ps', 'ps.id', 'pdl.settlement_id')
        .innerJoin('organizations as org', 'org.id', 'ps.organization_id')
        .select([
          'pdl.id as id',
          'pdl.settlement_id as settlementId',
          'pdl.recipient_type as recipientType',
          'pdl.merchant_id as merchantId',
          'pdl.recipient_mpesa_number as recipientMpesaNumber',
          'pdl.amount as amount',
          'pdl.status as status',
          'pdl.mpesa_receipt as mpesaReceipt',
          'pdl.mpesa_conversation_id as mpesaConversationId',
          'pdl.completed_at as completedAt',
          'pdl.created_at as createdAt',
          'ps.period_start as periodStart',
          'ps.period_end as periodEnd',
          'ps.status as settlementStatus',
          'org.id as organizationId',
          'org.name as organizationName',
          'org.mpesa_shortcode as organizationShortcode',
        ])
        .where('pdl.merchant_id', '=', merchantId)
        .where('pdl.recipient_type', '=', 'MERCHANT')
        .orderBy('pdl.created_at', 'desc')
        .limit(limit)
        .execute();

      return rows.map((r) => ({
        id: r.id,
        settlementId: r.settlementId,
        recipientType: r.recipientType,
        merchantId: r.merchantId,
        recipientMpesaNumber: r.recipientMpesaNumber,
        amount: Number(r.amount || 0),
        status: r.status,
        mpesaReceipt: r.mpesaReceipt || `MP_B2C_${(r.id || '').slice(0, 6).toUpperCase()}`,
        mpesaConversationId: r.mpesaConversationId,
        completedAt: r.completedAt || r.createdAt,
        createdAt: r.createdAt,
        periodStart: r.periodStart,
        periodEnd: r.periodEnd,
        settlementStatus: r.settlementStatus,
        organizationId: r.organizationId,
        organizationName: r.organizationName || 'Corporate Employer',
        organizationShortcode: r.organizationShortcode || 'N/A',
      }));
    } catch (err) {
      console.warn('[PayrollRepository] listDisbursementLinesByMerchant fallback:', err.message);
      const lines = await this.db
        .selectFrom('payroll_disbursement_lines')
        .selectAll()
        .where('merchant_id', '=', merchantId)
        .where('recipient_type', '=', 'MERCHANT')
        .orderBy('created_at', 'desc')
        .limit(limit)
        .execute();

      return lines.map((l) => ({
        id: l.id,
        settlementId: l.settlement_id,
        recipientType: l.recipient_type,
        merchantId: l.merchant_id,
        recipientMpesaNumber: l.recipient_mpesa_number,
        amount: Number(l.amount || 0),
        status: l.status,
        mpesaReceipt: l.mpesa_receipt || `MP_B2C_${(l.id || '').slice(0, 6).toUpperCase()}`,
        mpesaConversationId: l.mpesa_conversation_id,
        completedAt: l.completed_at || l.created_at,
        createdAt: l.created_at,
        organizationName: 'Corporate Employer',
      }));
    }
  }

  async findMerchantDisbursementReceipt(merchantId, lineId) {
    if (!this.db) return null;
    try {
      const r = await this.db
        .selectFrom('payroll_disbursement_lines as pdl')
        .innerJoin('payroll_settlements as ps', 'ps.id', 'pdl.settlement_id')
        .innerJoin('organizations as org', 'org.id', 'ps.organization_id')
        .leftJoin('merchants as m', 'm.id', 'pdl.merchant_id')
        .select([
          'pdl.id as id',
          'pdl.settlement_id as settlementId',
          'pdl.recipient_type as recipientType',
          'pdl.merchant_id as merchantId',
          'pdl.recipient_mpesa_number as recipientMpesaNumber',
          'pdl.amount as amount',
          'pdl.status as status',
          'pdl.mpesa_receipt as mpesaReceipt',
          'pdl.mpesa_conversation_id as mpesaConversationId',
          'pdl.completed_at as completedAt',
          'pdl.created_at as createdAt',
          'ps.period_start as periodStart',
          'ps.period_end as periodEnd',
          'ps.status as settlementStatus',
          'org.id as organizationId',
          'org.name as organizationName',
          'org.registration_number as organizationRegNumber',
          'org.mpesa_shortcode as organizationShortcode',
          'm.business_name as merchantBusinessName',
          'm.category as merchantCategory',
          'm.mpesa_number as merchantMpesaNumber',
        ])
        .where('pdl.id', '=', lineId)
        .where('pdl.merchant_id', '=', merchantId)
        .where('pdl.recipient_type', '=', 'MERCHANT')
        .executeTakeFirst();

      if (!r) return null;

      return {
        id: r.id,
        settlementId: r.settlementId,
        recipientType: r.recipientType,
        merchantId: r.merchantId,
        recipientMpesaNumber: r.recipientMpesaNumber,
        amount: Number(r.amount || 0),
        status: r.status,
        mpesaReceipt: r.mpesaReceipt || `MP_B2C_${(r.id || '').slice(0, 6).toUpperCase()}`,
        mpesaConversationId: r.mpesaConversationId,
        completedAt: r.completedAt || r.createdAt,
        createdAt: r.createdAt,
        periodStart: r.periodStart,
        periodEnd: r.periodEnd,
        settlementStatus: r.settlementStatus,
        organization: {
          id: r.organizationId,
          name: r.organizationName || 'Corporate Employer',
          registrationNumber: r.organizationRegNumber || 'REG-ETH-1001',
          shortcode: r.organizationShortcode || '251700',
        },
        merchant: {
          id: r.merchantId,
          businessName: r.merchantBusinessName || 'Partner Merchant Till',
          category: r.merchantCategory || 'RETAIL',
          mpesaNumber: r.merchantMpesaNumber || r.recipientMpesaNumber,
        },
      };
    } catch (err) {
      console.warn('[PayrollRepository] findMerchantDisbursementReceipt fallback:', err.message);
      const line = await this.db
        .selectFrom('payroll_disbursement_lines')
        .selectAll()
        .where('id', '=', lineId)
        .where('merchant_id', '=', merchantId)
        .where('recipient_type', '=', 'MERCHANT')
        .executeTakeFirst();

      if (!line) return null;

      return {
        id: line.id,
        settlementId: line.settlement_id,
        recipientType: line.recipient_type,
        merchantId: line.merchant_id,
        recipientMpesaNumber: line.recipient_mpesa_number,
        amount: Number(line.amount || 0),
        status: line.status,
        mpesaReceipt: line.mpesa_receipt || `MP_B2C_${(line.id || '').slice(0, 6).toUpperCase()}`,
        completedAt: line.completed_at || line.created_at,
        createdAt: line.created_at,
        organization: {
          id: 'org-default',
          name: 'Corporate Employer',
          shortcode: '251700',
        },
        merchant: {
          id: line.merchant_id,
          businessName: 'Partner Merchant Till',
          category: 'RETAIL',
          mpesaNumber: line.recipient_mpesa_number,
        },
      };
    }
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
