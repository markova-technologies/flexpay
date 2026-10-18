const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { generateQRPayload, verifyQRPayload } = require('../../src/server/shared/crypto/employeeIdGenerator');
const { VerifyEmployeeQRUseCase } = require('../../src/server/modules/merchants/ports/incoming/VerifyEmployeeQRUseCase');

const SECRET = 'test-secret-32bytes-xxxxxxxxxxxx';

describe('QR code signing and verification', () => {
  it('verifies a fresh QR payload', () => {
    const payload = generateQRPayload('FP-ETH-2026-A3X9K-Q', 'emp-uuid', 'org-uuid', SECRET);
    const result = verifyQRPayload(payload, SECRET, 300);
    assert.equal(result.valid, true);
    assert.equal(result.fpEmployeeId, 'FP-ETH-2026-A3X9K-Q');
  });

  it('rejects an expired QR payload', () => {
    const payload = generateQRPayload('FP-ETH-2026-A3X9K-Q', 'emp-uuid', 'org-uuid', SECRET);
    const parsed = JSON.parse(payload);
    const stale = JSON.stringify({ ...parsed, ts: parsed.ts - 600 });
    const result = verifyQRPayload(stale, SECRET, 300);
    assert.equal(result.valid, false);
    assert.equal(result.error, 'QR expired');
  });

  it('rejects a tampered QR payload', () => {
    const payload = generateQRPayload('FP-ETH-2026-A3X9K-Q', 'emp-uuid', 'org-uuid', SECRET);
    const parsed = JSON.parse(payload);
    const tampered = JSON.stringify({ ...parsed, sig: 'aaaaaaaaaaaaaaaa' });
    const result = verifyQRPayload(tampered, SECRET, 300);
    assert.equal(result.valid, false);
    assert.equal(result.error, 'Invalid QR signature');
  });

  it('VerifyEmployeeQRUseCase handles both signed payloads and direct FP-ID strings', async () => {
    const { generateEmployeeId } = require('../../src/server/shared/crypto/employeeIdGenerator');
    const validFpId = generateEmployeeId();
    const mockEmployee = {
      id: 'emp-1',
      fp_employee_id: validFpId,
      full_name: 'Abebe Kebede',
      status: 'ACTIVE',
      available_credit: 5000,
      credit_limit: 5000,
      organization_id: 'org-1',
    };
    const mockMerchant = {
      id: 'mch-1',
      business_name: 'Supermarket',
      category: 'GROCERY',
      status: 'ACTIVE',
    };

    const useCase = new VerifyEmployeeQRUseCase({
      employeeRepository: {
        findByFpId: async (id) => (id === mockEmployee.fp_employee_id ? mockEmployee : null),
        findById: async (id) => (id === mockEmployee.id ? mockEmployee : null),
        getOrgCreditPolicy: async () => ({ allowed_categories: ['GROCERY'] }),
      },
      merchantRepository: {
        findById: async () => mockMerchant,
      },
    });

    // 1. Direct FP-ID string scan
    const directRes = await useCase.execute({
      qrPayload: validFpId,
      merchantId: 'mch-1',
    });
    assert.equal(directRes.verified, true);
    assert.equal(directRes.employee.fpId, validFpId);

    // 2. Signed payload scan
    const processEnvSecret = process.env.QR_SECRET || 'flexpay-local-secret-32-chars-ok';
    const signedPayload = generateQRPayload(validFpId, 'emp-1', 'org-1', processEnvSecret);
    const signedRes = await useCase.execute({
      qrPayload: signedPayload,
      merchantId: 'mch-1',
    });
    assert.equal(signedRes.verified, true);
    assert.equal(signedRes.employee.fpId, validFpId);
  });
});

