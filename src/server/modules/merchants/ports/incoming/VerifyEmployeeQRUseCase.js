const { verifyQRPayload } = require('../../../../shared/crypto/employeeIdGenerator');
const { loadConfig } = require('../../../../config');

class VerifyEmployeeQRUseCase {
  constructor({ employeeRepository, merchantRepository } = {}) {
    this.employeeRepo = employeeRepository;
    this.merchantRepo = merchantRepository;
  }

  async execute({ qrPayload, merchantId }) {
    const config = loadConfig();
    const qrResult = verifyQRPayload(qrPayload, config.QR_SECRET, 300);
    if (!qrResult.valid) {
      return { verified: false, error: qrResult.error };
    }

    const [employee, merchant] = await Promise.all([
      this.employeeRepo.findByFpId ? this.employeeRepo.findByFpId(qrResult.fpEmployeeId) : this.employeeRepo.findById(qrResult.employeeId),
      this.merchantRepo ? this.merchantRepo.findById(merchantId) : null,
    ]);

    if (!employee || employee.status !== 'ACTIVE') {
      return { verified: false, error: 'Employee account not active or not found' };
    }
    if (merchant && merchant.status !== 'ACTIVE') {
      return { verified: false, error: 'Merchant account not active' };
    }

    return {
      verified: true,
      employee: {
        fpId:            employee.fp_employee_id,
        name:            employee.full_name,
        orgName:         employee.organization_name || 'Corporate Partner',
        availableCredit: Number(employee.available_credit),
        creditLimit:     Number(employee.credit_limit),
        monthlySalary:   Number(employee.monthly_salary || 0),
      },
    };
  }
}

module.exports = { VerifyEmployeeQRUseCase };
