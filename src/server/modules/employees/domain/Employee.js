class Employee {
  constructor(data) {
    this.id = data.id;
    this.fpEmployeeId = data.fp_employee_id || data.fpEmployeeId;
    this.organizationId = data.organization_id || data.organizationId;
    this.fullName = data.full_name || data.fullName;
    this.phoneNumber = data.phone_number || data.phoneNumber;
    this.creditLimit = Number(data.credit_limit !== undefined ? data.credit_limit : data.creditLimit) || 0;
    this.availableCredit = Number(data.available_credit !== undefined ? data.available_credit : data.availableCredit) || 0;
    this.department = data.department || null;
    this.status = data.status || 'ACTIVE';
    this.createdAt = data.created_at || data.createdAt || new Date();
  }

  get spentCredit() {
    return Math.max(0, Number((this.creditLimit - this.availableCredit).toFixed(2)));
  }

  get creditUtilizationPct() {
    if (this.creditLimit <= 0) return 0;
    return Math.min(100, Math.round((this.spentCredit / this.creditLimit) * 100));
  }

  canSpend(amount) {
    if (this.status !== 'ACTIVE') return false;
    if (amount <= 0) return false;
    return this.availableCredit >= amount;
  }

  canUpdateCreditLimit(newLimit) {
    if (newLimit < 0) return { allowed: false, reason: 'Credit limit cannot be negative' };
    if (newLimit < this.spentCredit) {
      return {
        allowed: false,
        reason: `New limit (ETB ${newLimit}) cannot be lower than already spent credit (ETB ${this.spentCredit})`,
      };
    }
    return { allowed: true };
  }
}

module.exports = { Employee };
