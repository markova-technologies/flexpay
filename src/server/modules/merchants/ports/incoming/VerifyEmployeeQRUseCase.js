const { verifyQRPayload, validateEmployeeId } = require('../../../../shared/crypto/employeeIdGenerator');
const { loadConfig } = require('../../../../config');

class VerifyEmployeeQRUseCase {
  constructor({ employeeRepository, merchantRepository } = {}) {
    this.employeeRepo = employeeRepository;
    this.merchantRepo = merchantRepository;
  }

  async execute({ qrPayload, merchantId }) {
    if (!qrPayload || typeof qrPayload !== 'string') {
      return { verified: false, error: 'Empty or invalid QR code payload' };
    }

    const trimmed = qrPayload.trim();
    const config = loadConfig();
    let fpEmployeeId = null;
    let employeeId = null;

    // 1. Try parsing as cryptographic signed payload (HMAC-SHA256, 300s TTL)
    const qrResult = verifyQRPayload(trimmed, config.QR_SECRET || 'flexpay-local-secret-32-chars-ok', 300);
    if (qrResult.valid) {
      fpEmployeeId = qrResult.fpEmployeeId;
      employeeId = qrResult.employeeId;
    } else {
      // 2. Try parsing as JSON object containing fpEmployeeId, fpId, or id
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed && typeof parsed === 'object') {
          fpEmployeeId = parsed.fpEmployeeId || parsed.fpId || parsed.id;
        }
      } catch {
        // Not JSON, check if it's a direct FP-ID string
        if (trimmed.startsWith('FP-')) {
          fpEmployeeId = trimmed;
        }
      }

      // If we derived an FP-ID, check its checksum and format
      if (fpEmployeeId) {
        const idCheck = validateEmployeeId(fpEmployeeId);
        if (!idCheck.valid) {
          return { verified: false, error: 'Invalid Employee ID format or checksum' };
        }
      } else {
        return { verified: false, error: qrResult.error || 'Invalid QR code signature or format' };
      }
    }

    // 3. Resolve employee and merchant entities
    const [employee, merchant] = await Promise.all([
      fpEmployeeId
        ? (this.employeeRepo.findByFpId ? this.employeeRepo.findByFpId(fpEmployeeId) : this.employeeRepo.findById(fpEmployeeId))
        : (this.employeeRepo.findById ? this.employeeRepo.findById(employeeId) : null),
      this.merchantRepo ? this.merchantRepo.findById(merchantId) : null,
    ]);

    if (!employee || employee.status !== 'ACTIVE') {
      return { verified: false, error: 'Employee account not active or not found' };
    }
    if (merchant && merchant.status !== 'ACTIVE') {
      return { verified: false, error: 'Merchant terminal is inactive' };
    }

    // 4. Validate category eligibility against employer credit policy
    if (this.employeeRepo.getOrgCreditPolicy && merchant) {
      const policy = await this.employeeRepo.getOrgCreditPolicy(employee.organization_id);
      if (policy && Array.isArray(policy.allowed_categories) && policy.allowed_categories.length > 0) {
        if (!policy.allowed_categories.includes(merchant.category)) {
          return {
            verified: false,
            eligible: false,
            error: `Merchant category '${merchant.category}' is not approved by employee organization`,
          };
        }
      }
    }

    return {
      verified: true,
      eligible: true,
      employee: {
        fpId:             employee.fp_employee_id,
        fpEmployeeId:     employee.fp_employee_id,
        name:             employee.full_name,
        fullName:         employee.full_name,
        orgName:          employee.organization_name || 'Corporate Partner',
        organizationName: employee.organization_name || 'Corporate Partner',
        organizationId:   employee.organization_id,
        availableCredit:  Number(employee.available_credit),
        creditLimit:      Number(employee.credit_limit),
        monthlySalary:    Number(employee.monthly_salary || 0),
      },
      merchant: merchant ? {
        name: merchant.business_name || merchant.name,
        category: merchant.category,
      } : undefined,
    };
  }
}

module.exports = { VerifyEmployeeQRUseCase };
