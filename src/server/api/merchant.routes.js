/**
 * FlexPay Merchant Portal & POS API Routes
 * =========================================
 * POS terminal customer verification, split payment calculation,
 * and settlement history.
 */

const express = require('express');
const { getDb } = require('../storage/db.js');
const { getMerchantById, resolveBenefitCategory } = require('../domain/merchant.js');
const { calculateSplit } = require('../domain/allocation.js');
const { optionalAuthenticate } = require('../middleware/authenticate.js');

const merchantRouter = express.Router();

/**
 * GET /api/merchants/:id/transactions
 * Merchant settlement history and daily total
 */
merchantRouter.get('/:id/transactions', optionalAuthenticate, (req, res) => {
  const db = getDb();
  const merchantId = req.params.id;

  const merchant = getMerchantById(merchantId);
  if (!merchant) {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: `Merchant ${merchantId} not found.` },
    });
  }

  const rows = db.prepare(`
    SELECT p.*, o.customer_phone, e.name as employee_name
    FROM payment_records p
    JOIN orders o ON o.id = p.order_id
    JOIN employees e ON e.id = p.employee_id
    WHERE p.merchant_id = ?
    ORDER BY p.created_at DESC
  `).all(merchantId);

  let totalSettledETB = 0;
  const transactions = rows.map((r) => {
    const isCompleted = r.status === 'COMPLETED';
    if (isCompleted) {
      totalSettledETB += Number(r.total_etb);
    }

    let breakdown = [];
    if (r.benefit_breakdown_json) {
      try {
        breakdown = JSON.parse(r.benefit_breakdown_json);
      } catch {}
    }

    return {
      paymentId: r.id,
      orderId: r.order_id,
      employeeName: r.employee_name,
      customerPhone: r.customer_phone,
      totalETB: Number(r.total_etb),
      benefitETB: Number(r.benefit_etb),
      mpesaETB: Number(r.mpesa_etb),
      status: r.status,
      receiptNumber: r.mpesa_receipt_number,
      breakdown,
      createdAt: r.created_at,
    };
  });

  res.json({
    merchant: {
      id: merchant.id,
      name: merchant.name,
      category: merchant.category,
      shortCode: merchant.short_code,
    },
    totalSettledETB,
    transactions,
  });
});

/**
 * POST /api/merchants/terminal/verify-customer
 * Cashier enters customer phone number -> returns eligibility and available benefit balance
 */
merchantRouter.post('/terminal/verify-customer', optionalAuthenticate, (req, res) => {
  const db = getDb();
  const { customerPhone, merchantId } = req.body || {};

  if (!customerPhone || !merchantId) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'customerPhone and merchantId are required.' },
    });
  }

  const cleanPhone = String(customerPhone).replace(/\D/g, '');
  // Normalize Ethiopian phone: e.g. 0912345678 -> 251912345678
  let normalizedPhone = cleanPhone;
  if (cleanPhone.startsWith('09')) normalizedPhone = `251${cleanPhone.slice(1)}`;
  else if (cleanPhone.startsWith('9')) normalizedPhone = `251${cleanPhone}`;

  const employee = db.prepare('SELECT * FROM employees WHERE phone = ? OR phone = ?').get(cleanPhone, normalizedPhone);
  if (!employee) {
    return res.status(404).json({
      error: { code: 'CUSTOMER_NOT_FOUND', message: `No active FlexPay corporate employee found with phone ${customerPhone}.` },
    });
  }

  const merchant = getMerchantById(merchantId);
  if (!merchant) {
    return res.status(404).json({
      error: { code: 'MERCHANT_NOT_FOUND', message: `Merchant ${merchantId} not found.` },
    });
  }

  const benefitCategory = resolveBenefitCategory(merchant.category);
  const wallet = db.prepare('SELECT * FROM benefit_wallets WHERE employee_id = ? AND category = ?').get(employee.id, benefitCategory);
  const ba = db.prepare('SELECT * FROM benefit_accounts WHERE employee_id = ?').get(employee.id);

  const walletLimit = wallet ? Number(wallet.monthly_limit_etb) : 0;
  const walletUsed = wallet ? Number(wallet.used_etb) : 0;
  const availableBenefitETB = Math.max(0, walletLimit - walletUsed);

  const salaryLimit = ba ? Number(ba.salary_link_limit_etb) : 1000;
  const salaryUsed = ba ? Number(ba.used_salary_link_etb) : 0;
  const availablePayLaterETB = Math.max(0, salaryLimit - salaryUsed);

  res.json({
    customer: {
      employeeId: employee.id,
      name: employee.name,
      phone: employee.phone,
      employerName: employee.employer_name,
      eligibleCategory: benefitCategory,
      availableBenefitETB,
      availablePayLaterETB,
      totalPurchasingPowerETB: availableBenefitETB + availablePayLaterETB,
    },
  });
});

module.exports = {
  merchantRouter,
};
