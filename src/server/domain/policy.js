/**
 * FlexPay Merchant & Benefit Policy Engine
 * =========================================
 * Authoritative server-side policy enforcement.
 * Enforces employer benefit rules, merchant category restrictions,
 * and employee eligibility.
 */

const DEFAULT_EMPLOYER_ALLOWED_CATEGORIES = ['GROCERY', 'MEAL'];

/**
 * Validates whether a merchant and transaction category are eligible for benefit coverage.
 * 
 * @param {Object} merchant Merchant record from DB
 * @param {Array<string>} [employerAllowedCategories] Employer-permitted categories
 * @returns {{ isEligible: boolean, rejectionReason?: string }}
 */
function validateMerchantEligibility(merchant, employerAllowedCategories = DEFAULT_EMPLOYER_ALLOWED_CATEGORIES) {
  if (!merchant) {
    return {
      isEligible: false,
      rejectionReason: 'Merchant does not exist in the FlexPay registry.',
    };
  }

  if (merchant.status !== 'ACTIVE') {
    return {
      isEligible: false,
      rejectionReason: `Merchant '${merchant.name}' is currently ${merchant.status.toLowerCase()}.`,
    };
  }

  // Parse allowed categories from merchant if stored as JSON string
  let allowedCategories = employerAllowedCategories;
  if (merchant.allowed_categories) {
    try {
      const parsed = typeof merchant.allowed_categories === 'string' 
        ? JSON.parse(merchant.allowed_categories) 
        : merchant.allowed_categories;
      if (Array.isArray(parsed) && parsed.length > 0) {
        allowedCategories = parsed;
      }
    } catch {
      // Fallback to default
    }
  }

  const category = (merchant.category || '').toUpperCase();
  const isAllowed = allowedCategories.map(c => c.toUpperCase()).includes(category);

  if (!isAllowed) {
    return {
      isEligible: false,
      rejectionReason: `Category '${merchant.category}' is not permitted under employer benefit policy. Permitted categories: ${allowedCategories.join(', ')}.`,
    };
  }

  return {
    isEligible: true,
  };
}

/**
 * Validates employee eligibility and benefit account status.
 * 
 * @param {Object} employee Employee record
 * @param {Object} benefitAccount Benefit account record
 * @returns {{ isEligible: boolean, rejectionReason?: string }}
 */
function validateEmployeeEligibility(employee, benefitAccount) {
  if (!employee) {
    return {
      isEligible: false,
      rejectionReason: 'Employee record not found.',
    };
  }

  if (!benefitAccount) {
    return {
      isEligible: false,
      rejectionReason: 'No active benefit account found for this employee.',
    };
  }

  const now = new Date();
  const expiresAt = new Date(benefitAccount.expires_at || benefitAccount.expiresAt);
  if (expiresAt < now) {
    return {
      isEligible: false,
      rejectionReason: 'Employer benefit allocation has expired for the current period.',
    };
  }

  return {
    isEligible: true,
  };
}

module.exports = {
  DEFAULT_EMPLOYER_ALLOWED_CATEGORIES,
  validateMerchantEligibility,
  validateEmployeeEligibility,
};
