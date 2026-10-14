const test = require('node:test');
const assert = require('node:assert/strict');
const { validateMerchantEligibility, validateEmployeeEligibility } = require('../../src/server/domain/policy.js');
const { calculateOrderTotal, calculateSplit } = require('../../src/server/domain/allocation.js');

test('Domain Policy - Merchant Eligibility', async (t) => {
  await t.test('allows active merchant in permitted category (GROCERY)', () => {
    const merchant = {
      id: 'mer-001',
      name: 'Yod Abyssinia Market',
      category: 'GROCERY',
      status: 'ACTIVE',
      allowed_categories: JSON.stringify(['GROCERY', 'MEAL']),
    };
    const res = validateMerchantEligibility(merchant);
    assert.equal(res.isEligible, true);
  });

  await t.test('blocks active merchant in unpermitted category (ELECTRONICS)', () => {
    const merchant = {
      id: 'mer-002',
      name: 'Electronics Paradise',
      category: 'ELECTRONICS',
      status: 'ACTIVE',
      allowed_categories: JSON.stringify(['GROCERY', 'MEAL']),
    };
    const res = validateMerchantEligibility(merchant);
    assert.equal(res.isEligible, false);
    assert.match(res.rejectionReason, /ELECTRONICS/);
  });

  await t.test('blocks inactive or suspended merchant', () => {
    const merchant = {
      id: 'mer-001',
      name: 'Yod Abyssinia Market',
      category: 'GROCERY',
      status: 'SUSPENDED',
      allowed_categories: JSON.stringify(['GROCERY', 'MEAL']),
    };
    const res = validateMerchantEligibility(merchant);
    assert.equal(res.isEligible, false);
    assert.match(res.rejectionReason, /suspended/);
  });
});

test('Domain Allocation - Authoritative Order Split', async (t) => {
  const eligibleMerchant = {
    id: 'mer-001',
    name: 'Yod Abyssinia Market',
    category: 'GROCERY',
    status: 'ACTIVE',
    allowed_categories: JSON.stringify(['GROCERY', 'MEAL']),
  };

  const employee = {
    id: 'emp-001',
    name: 'Abebe Kebede',
    employer_name: 'Ethio Telecom',
  };

  await t.test('calculates correct order total from item list', () => {
    const items = [
      { name: 'Teff Flour (25kg)', unitPriceETB: 1400, quantity: 1 },
      { name: 'Cooking Oil (3L)', unitPriceETB: 600, quantity: 1 },
    ];
    const total = calculateOrderTotal(items);
    assert.equal(total, 2000);
  });

  await t.test('Standard Demo: ETB 2,000 order splits into ETB 1,500 Benefit and ETB 500 Co-Pay', () => {
    const benefitAccount = {
      employee_id: 'emp-001',
      employer_name: 'Ethio Telecom',
      total_allowance_etb: 3000,
      used_allowance_etb: 1500, // available: 1500
      salary_link_limit_etb: 2000,
      used_salary_link_etb: 500, // available: 1500
      expires_at: '2026-12-31T23:59:59Z',
    };
    const items = [
      { name: 'Teff Flour', unitPriceETB: 1400, quantity: 1 },
      { name: 'Cooking Oil', unitPriceETB: 600, quantity: 1 },
    ];

    const split = calculateSplit({
      merchant: eligibleMerchant,
      employee,
      benefitAccount,
      items,
    });

    assert.equal(split.isEligible, true);
    assert.equal(split.orderTotalETB, 2000);
    assert.equal(split.benefitCoveredETB, 1500);
    assert.equal(split.employeeCoPayETB, 500);
    assert.equal(split.benefitPercentage, 75);
    assert.equal(split.employerName, 'Ethio Telecom');
  });

  await t.test('100% Benefit Coverage: ETB 450 order with ETB 1,500 balance has ETB 0 co-pay', () => {
    const benefitAccount = {
      employee_id: 'emp-001',
      employer_name: 'Ethio Telecom',
      total_allowance_etb: 3000,
      used_allowance_etb: 1500, // available: 1500
      salary_link_limit_etb: 2000,
      used_salary_link_etb: 500,
      expires_at: '2026-12-31T23:59:59Z',
    };
    const items = [{ name: 'Lunch Special', unitPriceETB: 450, quantity: 1 }];

    const split = calculateSplit({
      merchant: eligibleMerchant,
      employee,
      benefitAccount,
      items,
    });

    assert.equal(split.isEligible, true);
    assert.equal(split.orderTotalETB, 450);
    assert.equal(split.benefitCoveredETB, 450);
    assert.equal(split.employeeCoPayETB, 0);
    assert.equal(split.benefitPercentage, 100);
  });

  await t.test('Insufficient Benefit: Rejects when available benefit balance is 0', () => {
    const exhaustedAccount = {
      employee_id: 'emp-002',
      employer_name: 'Ethio Telecom',
      total_allowance_etb: 2000,
      used_allowance_etb: 2000, // available: 0
      salary_link_limit_etb: 1500,
      used_salary_link_etb: 0,
      expires_at: '2026-12-31T23:59:59Z',
    };
    const items = [{ name: 'Groceries', unitPriceETB: 2000, quantity: 1 }];

    const split = calculateSplit({
      merchant: eligibleMerchant,
      employee,
      benefitAccount: exhaustedAccount,
      items,
    });

    assert.equal(split.isEligible, false);
    assert.equal(split.benefitCoveredETB, 0);
    assert.match(split.rejectionReason, /insufficient/);
  });
});
