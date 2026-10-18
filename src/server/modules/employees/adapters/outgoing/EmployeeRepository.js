const { randomUUID } = require('node:crypto');
const { getDb } = require('../../../../infrastructure/database/client');

class EmployeeRepository {
  constructor(db) {
    this.db = db || getDb();
  }

  async findByPhone(organizationId, phoneNumber) {
    return this.db
      .selectFrom('employees')
      .selectAll()
      .where('organization_id', '=', organizationId)
      .where('phone_number', '=', phoneNumber)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();
  }

  async findByFpId(fpEmployeeId) {
    return this.db
      .selectFrom('employees')
      .leftJoin('organizations', 'organizations.id', 'employees.organization_id')
      .selectAll('employees')
      .select('organizations.name as organization_name')
      .where('employees.fp_employee_id', '=', fpEmployeeId)
      .where('employees.deleted_at', 'is', null)
      .executeTakeFirst();
  }

  async findById(employeeId) {
    return this.db
      .selectFrom('employees')
      .leftJoin('organizations', 'organizations.id', 'employees.organization_id')
      .selectAll('employees')
      .select('organizations.name as organization_name')
      .where('employees.id', '=', employeeId)
      .where('employees.deleted_at', 'is', null)
      .executeTakeFirst();
  }

  async findByOrgId(organizationId, { page = 1, limit = 20, search, department } = {}) {
    const offset = (Math.max(1, page) - 1) * limit;

    let query = this.db
      .selectFrom('employees')
      .selectAll()
      .where('organization_id', '=', organizationId)
      .where('deleted_at', 'is', null);

    if (department) {
      query = query.where('department', '=', department);
    }

    if (search) {
      const pattern = `%${search}%`;
      query = query.where((eb) =>
        eb.or([
          eb('full_name', 'ilike', pattern),
          eb('phone_number', 'like', pattern),
          eb('fp_employee_id', 'ilike', pattern),
        ])
      );
    }

    const items = await query
      .orderBy('created_at', 'desc')
      .limit(limit)
      .offset(offset)
      .execute();

    return items;
  }

  async createEmployeeWithUser({
    fpEmployeeId,
    organizationId,
    fullName,
    phoneNumber,
    creditLimit,
    monthlySalary,
    department,
    jobTitle,
    passwordHash,
  }) {
    const employeeId = randomUUID();
    const userId = randomUUID();

    return this.db.transaction().execute(async (trx) => {
      const emp = await trx
        .insertInto('employees')
        .values({
          id: employeeId,
          fp_employee_id: fpEmployeeId,
          organization_id: organizationId,
          full_name: fullName,
          phone_number: phoneNumber,
          credit_limit: creditLimit,
          available_credit: creditLimit,
          monthly_salary: monthlySalary !== undefined && monthlySalary !== null ? monthlySalary : creditLimit,
          department: department || null,
          job_title: jobTitle || null,
          status: 'ACTIVE',
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      await trx
        .insertInto('users')
        .values({
          id: userId,
          role: 'EMPLOYEE',
          organization_id: organizationId,
          employee_id: emp.id,
          password_hash: passwordHash,
          must_change_password: false,
          status: 'ACTIVE',
        })
        .execute();

      return emp;
    });
  }

  async updateCreditLimit(employeeId, newLimit) {
    // Computes difference to adjust available credit safely
    return this.db.transaction().execute(async (trx) => {
      const current = await trx
        .selectFrom('employees')
        .selectAll()
        .where('id', '=', employeeId)
        .forUpdate()
        .executeTakeFirstOrThrow();

      const spent = Number(current.credit_limit) - Number(current.available_credit);
      if (newLimit < spent) {
        throw new Error(`New limit cannot be lower than already spent amount of ${spent}`);
      }

      const newAvailable = Math.max(0, newLimit - spent);

      return trx
        .updateTable('employees')
        .set({
          credit_limit: newLimit,
          available_credit: newAvailable,
          updated_at: new Date(),
        })
        .where('id', '=', employeeId)
        .returningAll()
        .executeTakeFirstOrThrow();
    });
  }

  async getOrgCreditPolicy(organizationId) {
    return this.db
      .selectFrom('org_credit_policies')
      .selectAll()
      .where('organization_id', '=', organizationId)
      .executeTakeFirst();
  }

  async updateOrgCreditPolicy(organizationId, { globalLimit, allowedCategories }) {
    const updateObj = { updated_at: new Date() };
    if (globalLimit !== undefined) updateObj.global_credit_limit = globalLimit;
    if (allowedCategories !== undefined) updateObj.allowed_categories = allowedCategories;

    const updated = await this.db
      .updateTable('org_credit_policies')
      .set(updateObj)
      .where('organization_id', '=', organizationId)
      .returningAll()
      .executeTakeFirst();

    if (!updated) {
      return this.db
        .insertInto('org_credit_policies')
        .values({
          organization_id: organizationId,
          global_credit_limit: globalLimit || 0,
          allowed_categories: allowedCategories || ['FOOD', 'TRANSPORT', 'HEALTH', 'GROCERY', 'FUEL'],
        })
        .returningAll()
        .executeTakeFirst();
    }
    return updated;
  }

  async listPasswordResetRequests(organizationId, status = 'PENDING') {
    return this.db
      .selectFrom('password_reset_requests')
      .innerJoin('employees', 'employees.id', 'password_reset_requests.employee_id')
      .select([
        'password_reset_requests.id as id',
        'password_reset_requests.id as requestId',
        'password_reset_requests.status as status',
        'password_reset_requests.delivery_method as deliveryMethod',
        'password_reset_requests.requested_at as requestedAt',
        'employees.id as employeeId',
        'employees.fp_employee_id as fpEmployeeId',
        'employees.full_name as fullName',
        'employees.phone_number as phoneNumber',
        'employees.department as department',
      ])
      .where('employees.organization_id', '=', organizationId)
      .where('password_reset_requests.status', '=', status)
      .orderBy('password_reset_requests.requested_at', 'desc')
      .execute();
  }

  async findPasswordResetRequestById(requestId) {
    return this.db
      .selectFrom('password_reset_requests')
      .innerJoin('employees', 'employees.id', 'password_reset_requests.employee_id')
      .select([
        'password_reset_requests.id as id',
        'password_reset_requests.id as requestId',
        'password_reset_requests.status as status',
        'password_reset_requests.delivery_method as deliveryMethod',
        'password_reset_requests.employee_id as employeeId',
        'employees.organization_id as organizationId',
        'employees.phone_number as phoneNumber',
        'employees.full_name as fullName',
      ])
      .where('password_reset_requests.id', '=', requestId)
      .executeTakeFirst();
  }

  async approvePasswordReset(requestId, reviewerUserId, newPasswordHash) {
    return this.db.transaction().execute(async (trx) => {
      const req = await trx
        .selectFrom('password_reset_requests')
        .selectAll()
        .where('id', '=', requestId)
        .forUpdate()
        .executeTakeFirstOrThrow();

      if (req.status !== 'PENDING') {
        throw new Error(`Password reset request is already ${req.status}`);
      }

      // Update password hash on users table
      await trx
        .updateTable('users')
        .set({
          password_hash: newPasswordHash,
          must_change_password: true,
          updated_at: new Date(),
        })
        .where('employee_id', '=', req.employee_id)
        .execute();

      // Mark request approved
      const updatedReq = await trx
        .updateTable('password_reset_requests')
        .set({
          status: 'APPROVED',
          reviewed_by: reviewerUserId,
          reviewed_at: new Date(),
        })
        .where('id', '=', requestId)
        .returningAll()
        .executeTakeFirstOrThrow();

      return updatedReq;
    });
  }

  async rejectPasswordReset(requestId, reviewerUserId) {
    return this.db
      .updateTable('password_reset_requests')
      .set({
        status: 'REJECTED',
        reviewed_by: reviewerUserId,
        reviewed_at: new Date(),
      })
      .where('id', '=', requestId)
      .where('status', '=', 'PENDING')
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async updateOrgMpesaShortcode(organizationId, shortcode) {
    return this.db
      .updateTable('organizations')
      .set({ mpesa_shortcode: shortcode, updated_at: new Date() })
      .where('id', '=', organizationId)
      .returningAll()
      .executeTakeFirstOrThrow();
  }
}

module.exports = { EmployeeRepository };
