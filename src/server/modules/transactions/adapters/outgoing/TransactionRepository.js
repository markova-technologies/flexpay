const { getDb } = require('../../../../infrastructure/database/client');

class TransactionRepository {
  constructor(db) {
    this.db = db || getDb();
  }

  async createTransactionWithEntries(transactionData, journalEntries = []) {
    return this.db.transaction().execute(async (trx) => {
      // 1. SELECT employee FOR UPDATE to lock row against concurrent double-spend
      const employee = await trx
        .selectFrom('employees')
        .selectAll()
        .where('id', '=', transactionData.employee_id)
        .forUpdate()
        .executeTakeFirstOrThrow();

      const creditPortion = Number(transactionData.credit_portion || 0);

      if (creditPortion > 0) {
        const available = Number(employee.available_credit);
        if (available < creditPortion) {
          const err = new Error(
            `Insufficient available credit: Required ETB ${creditPortion}, Available ETB ${available}`
          );
          err.statusCode = 400;
          throw err;
        }

        // 2. Atomically deduct credit
        await trx
          .updateTable('employees')
          .set({
            available_credit: Number((available - creditPortion).toFixed(2)),
            updated_at: new Date(),
          })
          .where('id', '=', transactionData.employee_id)
          .execute();
      }

      // Ensure organization_id is resolved and never null
      let organizationId = transactionData.organization_id || employee.organization_id;
      if (!organizationId) {
        const firstOrg = await trx.selectFrom('organizations').select('id').limit(1).executeTakeFirst();
        if (firstOrg) {
          organizationId = firstOrg.id;
          await trx
            .updateTable('employees')
            .set({ organization_id: organizationId, updated_at: new Date() })
            .where('id', '=', transactionData.employee_id)
            .execute();
        }
      }

      // 3. Insert transaction record
      const txn = await trx
        .insertInto('transactions')
        .values({
          fp_transaction_ref: transactionData.fp_transaction_ref,
          employee_id: transactionData.employee_id,
          merchant_id: transactionData.merchant_id,
          organization_id: organizationId,
          employee_fp_id_snapshot: transactionData.employee_fp_id_snapshot,
          employee_name_snapshot: transactionData.employee_name_snapshot,
          employee_phone_snapshot: transactionData.employee_phone_snapshot,
          org_name_snapshot: transactionData.org_name_snapshot,
          merchant_name_snapshot: transactionData.merchant_name_snapshot,
          merchant_mpesa_snapshot: transactionData.merchant_mpesa_snapshot,
          category_snapshot: transactionData.category_snapshot,
          total_amount: transactionData.total_amount,
          credit_portion: transactionData.credit_portion,
          copay_portion: transactionData.copay_portion,
          stk_checkout_request_id: transactionData.stk_checkout_request_id || null,
          status: transactionData.status || 'PENDING',
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      // 4. Insert journal entries for the double-entry financial ledger
      if (journalEntries.length > 0) {
        const entriesToInsert = journalEntries.map((e) => ({
          transaction_id: txn.id,
          account_type: e.account_type,
          debit_amount: e.debit_amount,
          credit_amount: e.credit_amount,
          description: e.description,
        }));

        await trx.insertInto('journal_entries').values(entriesToInsert).execute();
      }

      return txn;
    });
  }

  async updateStatus(transactionId, status, mpesaReceipt = null) {
    const updateObj = { status, updated_at: new Date() };
    if (mpesaReceipt) updateObj.mpesa_receipt = mpesaReceipt;

    return this.db
      .updateTable('transactions')
      .set(updateObj)
      .where('id', '=', transactionId)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async reverseCreditReservation(transactionId) {
    return this.db.transaction().execute(async (trx) => {
      const txn = await trx
        .selectFrom('transactions')
        .selectAll()
        .where('id', '=', transactionId)
        .forUpdate()
        .executeTakeFirstOrThrow();

      if (txn.status === 'COMPLETED') {
        throw new Error('Cannot reverse completed transaction without formal refund workflow');
      }

      const creditPortion = Number(txn.credit_portion);
      if (creditPortion > 0) {
        const emp = await trx
          .selectFrom('employees')
          .selectAll()
          .where('id', '=', txn.employee_id)
          .forUpdate()
          .executeTakeFirstOrThrow();

        const newAvailable = Math.min(
          Number(emp.credit_limit),
          Number((Number(emp.available_credit) + creditPortion).toFixed(2))
        );

        await trx
          .updateTable('employees')
          .set({ available_credit: newAvailable, updated_at: new Date() })
          .where('id', '=', txn.employee_id)
          .execute();
      }

      return trx
        .updateTable('transactions')
        .set({ status: 'FAILED', updated_at: new Date() })
        .where('id', '=', transactionId)
        .returningAll()
        .executeTakeFirstOrThrow();
    });
  }

  async findByStkCheckoutRequestId(checkoutRequestId) {
    return this.db
      .selectFrom('transactions')
      .selectAll()
      .where('stk_checkout_request_id', '=', checkoutRequestId)
      .executeTakeFirst();
  }

  async findById(transactionId) {
    return this.db
      .selectFrom('transactions')
      .selectAll()
      .where('id', '=', transactionId)
      .executeTakeFirst();
  }

  async findByFpRef(fpRef) {
    return this.db
      .selectFrom('transactions')
      .selectAll()
      .where('fp_transaction_ref', '=', fpRef)
      .executeTakeFirst();
  }

  async listRecentByEmployee(employeeId, limit = 20) {
    return this.db
      .selectFrom('transactions')
      .selectAll()
      .where('employee_id', '=', employeeId)
      .orderBy('created_at', 'desc')
      .limit(limit)
      .execute();
  }

  async listRecentByOrg(orgId, limit = 20) {
    if (!orgId) return [];
    return this.db
      .selectFrom('transactions')
      .selectAll()
      .where('organization_id', '=', orgId)
      .orderBy('created_at', 'desc')
      .limit(limit)
      .execute();
  }

  async listRecentByMerchant(merchantId, limit = 20) {
    if (!merchantId) return [];
    return this.db
      .selectFrom('transactions')
      .selectAll()
      .where('merchant_id', '=', merchantId)
      .orderBy('created_at', 'desc')
      .limit(limit)
      .execute();
  }

  async getMerchantSummaryForOrg(orgId, merchantId) {
    if (!orgId || !merchantId) return { totalCredit: 0, uniqueEmployeesCount: 0 };
    const txns = await this.db
      .selectFrom('transactions')
      .selectAll()
      .where('organization_id', '=', orgId)
      .where('merchant_id', '=', merchantId)
      .where('status', '=', 'COMPLETED')
      .execute();

    let totalCredit = 0;
    const empSet = new Set();
    for (const t of txns) {
      totalCredit += Number(t.credit_portion || 0);
      empSet.add(t.employee_id);
    }

    return {
      totalCredit: Number(totalCredit.toFixed(2)),
      employeeCount: empSet.size,
      transactionCount: txns.length,
    };
  }

  async getTransactionsByOrgAndMerchant(orgId, merchantId, limit = 20, offset = 0) {
    if (!orgId || !merchantId) return [];
    return this.db
      .selectFrom('transactions')
      .selectAll()
      .where('organization_id', '=', orgId)
      .where('merchant_id', '=', merchantId)
      .orderBy('created_at', 'desc')
      .limit(limit)
      .offset(offset)
      .execute();
  }

  async getTransactionsByEmployeeForMerchant(orgId, merchantId) {
    if (!orgId || !merchantId) return [];
    const txns = await this.db
      .selectFrom('transactions')
      .selectAll()
      .where('organization_id', '=', orgId)
      .where('merchant_id', '=', merchantId)
      .where('status', '=', 'COMPLETED')
      .execute();

    const empMap = new Map();
    for (const t of txns) {
      const eId = t.employee_id;
      const existing = empMap.get(eId) || {
        employee_id: eId,
        fp_employee_id: t.employee_fp_id_snapshot,
        full_name: t.employee_name_snapshot,
        total_spent: 0,
        last_visit: t.created_at,
      };
      existing.total_spent = Number((existing.total_spent + Number(t.credit_portion || 0)).toFixed(2));
      if (new Date(t.created_at) > new Date(existing.last_visit)) {
        existing.last_visit = t.created_at;
      }
      empMap.set(eId, existing);
    }
    return Array.from(empMap.values());
  }
}

module.exports = { TransactionRepository };
