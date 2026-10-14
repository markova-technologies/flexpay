/**
 * FlexPay Merchant Domain Engine
 * ===============================
 * Merchant category mapping and eligibility verification.
 */

const { getDb } = require('../storage/db.js');

/**
 * Maps merchant operational category to employer benefit category
 */
const MERCHANT_TO_BENEFIT_CATEGORY = {
  MEAL: 'FOOD',
  GROCERY: 'FOOD',
  TRANSPORT: 'TRANSPORT',
  COMMUTE: 'TRANSPORT',
  PHARMACY: 'HEALTH',
  CLINIC: 'HEALTH',
  HOSPITAL: 'HEALTH',
};

/**
 * Resolves benefit category from merchant category
 */
function resolveBenefitCategory(merchantCategory) {
  if (!merchantCategory) return 'FOOD';
  const norm = String(merchantCategory).toUpperCase();
  return MERCHANT_TO_BENEFIT_CATEGORY[norm] || norm;
}

/**
 * Retrieves merchant by ID with parsed allowed categories
 */
function getMerchantById(merchantId) {
  const db = getDb();
  const merchant = db.prepare('SELECT * FROM merchants WHERE id = ?').get(merchantId);
  if (!merchant) return null;

  let allowedCategories = ['GROCERY', 'MEAL'];
  if (merchant.allowed_categories) {
    try {
      allowedCategories = typeof merchant.allowed_categories === 'string'
        ? JSON.parse(merchant.allowed_categories)
        : merchant.allowed_categories;
    } catch {
      // Fallback
    }
  }

  return {
    ...merchant,
    allowedCategories,
    benefitCategory: resolveBenefitCategory(merchant.category),
  };
}

module.exports = {
  MERCHANT_TO_BENEFIT_CATEGORY,
  resolveBenefitCategory,
  getMerchantById,
};
