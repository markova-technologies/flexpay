const { getDb } = require('../../../../infrastructure/database/client');

class AuthRepository {
  constructor(db) {
    this.db = db || getDb();
  }

  async findOrgByTin(tinNumber) {
    if (!tinNumber) return null;
    const clean = String(tinNumber).trim();
    return this.db
      .selectFrom('organizations')
      .selectAll()
      .where('tin_number', '=', clean)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();
  }

  async createOrganization({ name, tinNumber, contactPhone, mpesaShortcode }) {
    return this.db
      .insertInto('organizations')
      .values({
        name,
        tin_number: tinNumber,
        contact_phone: contactPhone,
        mpesa_shortcode: mpesaShortcode || null,
        status: 'ACTIVE',
      })
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async createOrgCreditPolicy(orgId, globalLimit = 0) {
    try {
      return await this.db
        .insertInto('org_credit_policies')
        .values({
          organization_id: orgId,
          global_credit_limit: globalLimit,
          allowed_categories: ['FOOD', 'TRANSPORT', 'HEALTH', 'GROCERY', 'FUEL'],
        })
        .returningAll()
        .executeTakeFirst();
    } catch (err) {
      console.warn('[AuthRepo] Warning: could not initialize default org_credit_policy:', err.message);
      return null;
    }
  }

  async createUser({ role, organizationId, merchantId, employeeId, passwordHash, mustChangePassword = false }) {
    return this.db
      .insertInto('users')
      .values({
        role,
        organization_id: organizationId || null,
        merchant_id: merchantId || null,
        employee_id: employeeId || null,
        password_hash: passwordHash,
        must_change_password: mustChangePassword,
        status: 'ACTIVE',
      })
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async findUserByOrgId(orgId, role) {
    let query = this.db
      .selectFrom('users')
      .selectAll()
      .where('organization_id', '=', orgId);

    if (role) {
      query = query.where('role', '=', role);
    } else {
      query = query.where('role', 'in', ['ORG_ADMIN', 'ORG_CONTROLLER']);
    }

    return query.executeTakeFirst();
  }

  async findMerchantByMpesaNumber(mpesaNumber) {
    return this.db
      .selectFrom('merchants')
      .selectAll()
      .where('mpesa_number', '=', mpesaNumber)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();
  }

  async createMerchant({ businessName, mpesaNumber, category, contactPhone, status = 'ACTIVE' }) {
    return this.db
      .insertInto('merchants')
      .values({
        business_name: businessName,
        mpesa_number: mpesaNumber,
        category,
        contact_phone: contactPhone,
        status,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async findUserByMerchantId(merchantId) {
    return this.db
      .selectFrom('users')
      .selectAll()
      .where('merchant_id', '=', merchantId)
      .executeTakeFirst();
  }

  async findEmployeeByFpId(fpEmployeeId) {
    return this.db
      .selectFrom('employees')
      .selectAll()
      .where('fp_employee_id', '=', fpEmployeeId)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();
  }

  async findUserByEmployeeId(employeeId) {
    return this.db
      .selectFrom('users')
      .selectAll()
      .where('employee_id', '=', employeeId)
      .executeTakeFirst();
  }

  async findUserById(userId) {
    return this.db
      .selectFrom('users')
      .selectAll()
      .where('id', '=', userId)
      .executeTakeFirst();
  }

  async updateLastLogin(userId) {
    return this.db
      .updateTable('users')
      .set({ last_login_at: new Date() })
      .where('id', '=', userId)
      .execute();
  }

  async createPasswordResetRequest({ employeeId, deliveryMethod = 'SMS' }) {
    return this.db
      .insertInto('password_reset_requests')
      .values({
        employee_id: employeeId,
        delivery_method: deliveryMethod,
        status: 'PENDING',
      })
      .returningAll()
      .executeTakeFirstOrThrow();
  }
}

module.exports = { AuthRepository };
