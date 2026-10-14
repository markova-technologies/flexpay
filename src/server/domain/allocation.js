/**
 * FlexPay Benefit Allocation Engine
 * ==================================
 * Authoritative backend domain calculation.
 * Zero browser trust: Computes the precise split between employer-funded
 * benefit and employee salary-linked co-pay.
 */

const { validateMerchantEligibility, validateEmployeeEligibility } = require('./policy.js');

/**
 * Calculates authoritative order total from item list.
 * 
 * @param {Array<{ unitPriceETB: number, quantity: number }>} items
 * @returns {number}
 */
function calculateOrderTotal(items) {
  if (!Array.isArray(items) || items.length === 0) return 0;
  return items.reduce((sum, item) => {
    const price = Number(item.unitPriceETB) || 0;
    const qty = Math.max(0, parseInt(item.quantity, 10) || 0);
    return sum + (price * qty);
  }, 0);
}

/**
 * Calculates authoritative split for an order.
 * 
 * @param {Object} params
 * @param {Object} params.merchant - DB merchant record
 * @param {Object} params.employee - DB employee record
 * @param {Object} params.benefitAccount - DB benefit account record
 * @param {Array} params.items - Order items
 * @returns {Object} Split allocation result
 */
function calculateSplit({ merchant, employee, benefitAccount, items, wallets }) {
  const orderTotalETB = calculateOrderTotal(items);

  // 1. Validate merchant category & status
  const merchantPolicy = validateMerchantEligibility(merchant);
  if (!merchantPolicy.isEligible) {
    return {
      orderTotalETB,
      benefitCoveredETB: 0,
      employeeCoPayETB: 0,
      benefitPercentage: 0,
      isEligible: false,
      rejectionReason: merchantPolicy.rejectionReason,
    };
  }

  // 2. Validate employee & benefit account
  const employeePolicy = validateEmployeeEligibility(employee, benefitAccount);
  if (!employeePolicy.isEligible) {
    return {
      orderTotalETB,
      benefitCoveredETB: 0,
      employeeCoPayETB: 0,
      benefitPercentage: 0,
      isEligible: false,
      rejectionReason: employeePolicy.rejectionReason,
    };
  }

  // 3. Compute available balances
  // Determine merchant's target benefit category (e.g. MEAL/GROCERY -> FOOD, TRANSPORT -> TRANSPORT, etc.)
  const rawMerchantCat = (merchant.category || 'GROCERY').toUpperCase();
  let benefitCategory = 'FOOD';
  if (['MEAL', 'GROCERY', 'FOOD'].includes(rawMerchantCat)) benefitCategory = 'FOOD';
  else if (['TRANSPORT', 'COMMUTE'].includes(rawMerchantCat)) benefitCategory = 'TRANSPORT';
  else if (['PHARMACY', 'CLINIC', 'HOSPITAL', 'HEALTH'].includes(rawMerchantCat)) benefitCategory = 'HEALTH';

  let availableBenefitETB = 0;
  const employerName = benefitAccount?.employer_name || benefitAccount?.employerName || employee?.employer_name || employee?.employerName || 'Employer';

  // If specific category wallets are provided, use the matching category wallet
  if (wallets && Array.isArray(wallets) && wallets.length > 0) {
    const matchingWallet = wallets.find(w => (w.category || '').toUpperCase() === benefitCategory);
    if (matchingWallet) {
      const limit = Number(matchingWallet.monthly_limit_etb ?? matchingWallet.monthlyLimit ?? 0);
      const used = Number(matchingWallet.used_etb ?? matchingWallet.used ?? 0);
      availableBenefitETB = Math.max(0, limit - used);
    }
  } else if (benefitAccount) {
    const totalAllowance = Number(benefitAccount.total_allowance_etb ?? benefitAccount.totalAllowanceETB ?? 0);
    const usedAllowance = Number(benefitAccount.used_allowance_etb ?? benefitAccount.usedAllowanceETB ?? 0);
    availableBenefitETB = Math.max(0, totalAllowance - usedAllowance);
  }

  const salaryLimit = Number(benefitAccount?.salary_link_limit_etb ?? benefitAccount?.salaryLinkLimitETB ?? 0);
  const usedSalary = Number(benefitAccount?.used_salary_link_etb ?? benefitAccount?.usedSalaryLinkETB ?? 0);
  const availableSalaryETB = Math.max(0, salaryLimit - usedSalary);

  // 4. Handle insufficient benefit balance (0 available balance)
  if (availableBenefitETB <= 0) {
    return {
      orderTotalETB,
      benefitCoveredETB: 0,
      employeeCoPayETB: orderTotalETB,
      payLaterETB: orderTotalETB,
      benefitPercentage: 0,
      isEligible: false,
      rejectionReason: `Benefit balance for ${benefitCategory} (ETB 0.00) is insufficient for this purchase.`,
      employerName,
      benefitCategory,
      splitByCategory: [],
    };
  }

  // 5. Determine Benefit Covered Amount:
  // Benefit covers up to availableBenefitETB, capped at orderTotalETB
  const benefitCoveredETB = Math.min(availableBenefitETB, orderTotalETB);
  const employeeCoPayETB = Math.max(0, orderTotalETB - benefitCoveredETB);

  // 6. Validate Employee Salary-Linked Limit if Co-Pay is required
  if (employeeCoPayETB > availableSalaryETB) {
    return {
      orderTotalETB,
      benefitCoveredETB,
      employeeCoPayETB,
      payLaterETB: employeeCoPayETB,
      benefitPercentage: orderTotalETB > 0 ? Math.round((benefitCoveredETB / orderTotalETB) * 100) : 0,
      isEligible: false,
      rejectionReason: `Employee salary-linked purchasing limit (ETB ${availableSalaryETB.toFixed(2)}) is insufficient for required co-pay of ETB ${employeeCoPayETB.toFixed(2)}.`,
      employerName,
      benefitCategory,
      splitByCategory: [
        { category: benefitCategory, amount: benefitCoveredETB }
      ],
    };
  }

  const benefitPercentage = orderTotalETB > 0 ? Math.round((benefitCoveredETB / orderTotalETB) * 100) : 0;

  return {
    orderTotalETB,
    benefitCoveredETB,
    employeeCoPayETB,
    payLaterETB: employeeCoPayETB,
    benefitPercentage,
    isEligible: true,
    employerName,
    benefitCategory,
    splitByCategory: [
      { category: benefitCategory, amount: benefitCoveredETB }
    ],
  };
}

module.exports = {
  calculateOrderTotal,
  calculateSplit,
};
