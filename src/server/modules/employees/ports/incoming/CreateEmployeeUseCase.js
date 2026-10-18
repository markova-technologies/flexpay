const { generateEmployeeId } = require('../../../../shared/crypto/employeeIdGenerator');
const { generateCompliantPassword } = require('../../../../shared/crypto/passwordGenerator');
const { hashPassword } = require('../../../../shared/crypto/argon2');

class CreateEmployeeUseCase {
  constructor({ employeeRepository, notificationService, db } = {}) {
    this.repo = employeeRepository;
    this.notifications = notificationService;
    this.db = db;
  }

  async execute({ organizationId, fullName, phoneNumber, department, jobTitle, monthlySalary, creditLimitOverride, sendSms = false }) {
    if (!organizationId) throw new Error('organizationId is required');
    if (!fullName || !phoneNumber) throw new Error('fullName and phoneNumber are required');

    // 1. Check if phone is already registered in this organization
    const existing = await this.repo.findByPhone(organizationId, phoneNumber);
    if (existing) {
      const err = new Error('An employee with this phone number is already registered in this organization');
      err.statusCode = 409;
      throw err;
    }

    // 2. Determine credit limit: default to monthlySalary, with fallback to org policy or 0
    const effectiveSalary = monthlySalary !== undefined && monthlySalary !== null ? Number(monthlySalary) : null;
    const policy = await this.repo.getOrgCreditPolicy(organizationId);
    let creditLimit;
    if (creditLimitOverride !== undefined && creditLimitOverride !== null) {
      creditLimit = Number(creditLimitOverride);
    } else if (effectiveSalary !== null && effectiveSalary > 0) {
      creditLimit = effectiveSalary;
    } else {
      creditLimit = policy ? Number(policy.global_credit_limit) : (effectiveSalary || 0);
    }

    // 3. Generate globally unique FP Employee ID with collision check
    let fpEmployeeId;
    let attempts = 0;
    do {
      fpEmployeeId = generateEmployeeId('ETH');
      const collision = await this.repo.findByFpId(fpEmployeeId);
      if (!collision) break;
      attempts++;
    } while (attempts < 10);

    if (attempts >= 10) {
      throw new Error('Employee ID generation collision limit exceeded');
    }

    // 4. Generate 16-char CSPRNG password
    const plainPassword = generateCompliantPassword(16);
    const passwordHash = await hashPassword(plainPassword);

    // 5. Store employee & user record atomically
    const employee = await this.repo.createEmployeeWithUser({
      fpEmployeeId,
      organizationId,
      fullName,
      phoneNumber,
      creditLimit,
      monthlySalary: effectiveSalary !== null ? effectiveSalary : creditLimit,
      department: department || null,
      jobTitle: jobTitle || null,
      passwordHash,
    });

    // 6. Optional SMS delivery
    if (sendSms && this.notifications && typeof this.notifications.sendEmployeeCreatedSms === 'function') {
      try {
        await this.notifications.sendEmployeeCreatedSms({
          to: phoneNumber,
          fpEmployeeId,
          password: plainPassword,
        });
      } catch (err) {
        console.warn(`[SMS Notification Warning] Could not send SMS: ${err.message}`);
      }
    }

    return {
      employee,
      plainPassword,
      fpEmployeeId,
    };
  }
}

module.exports = { CreateEmployeeUseCase };
