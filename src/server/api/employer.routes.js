/**
 * FlexPay Employer Portal API Routes
 * ===================================
 * Corporate benefit budget management, employee roster, policy configuration,
 * and real-time utilization analytics.
 */

const express = require('express');
const { getDb } = require('../storage/db.js');
const { optionalAuthenticate, authenticate } = require('../middleware/authenticate.js');
const { requireRole } = require('../middleware/requireRole.js');

const employerRouter = express.Router();

// Helper to resolve orgId from request user or fallback to org-001 for demo convenience
function resolveOrgId(req) {
  if (req.user && req.user.role === 'EMPLOYER_ADMIN' && req.user.entityId) {
    return req.user.entityId;
  }
  return req.query.orgId || 'org-001';
}

/**
 * GET /api/employer/org
 * Returns organization benefit pool and balance overview
 */
employerRouter.get('/org', optionalAuthenticate, (req, res) => {
  const db = getDb();
  const orgId = resolveOrgId(req);

  const org = db.prepare('SELECT * FROM organizations WHERE id = ?').get(orgId);
  if (!org) {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: `Organization ${orgId} not found.` },
    });
  }

  const pool = Number(org.benefit_pool_etb || 0);
  const used = Number(org.used_pool_etb || 0);
  const available = Math.max(0, pool - used);
  const utilizationRate = pool > 0 ? Math.round((used / pool) * 100) : 0;

  // Active employee count
  const empCount = db.prepare('SELECT COUNT(*) AS count FROM employees WHERE employer_id = ?').get(orgId);

  res.json({
    org: {
      id: org.id,
      name: org.name,
      benefitPoolETB: pool,
      usedPoolETB: used,
      availablePoolETB: available,
      utilizationRate,
      activeEmployees: empCount ? empCount.count : 0,
    },
  });
});

/**
 * GET /api/employer/policies
 * Returns benefit category limits configured by the employer
 */
employerRouter.get('/policies', optionalAuthenticate, (req, res) => {
  const db = getDb();
  const orgId = resolveOrgId(req);

  const rows = db.prepare('SELECT * FROM benefit_policies WHERE org_id = ? ORDER BY category ASC').all(orgId);
  const policies = rows.map((p) => {
    let categories = [];
    try {
      categories = JSON.parse(p.eligible_merchant_categories);
    } catch {
      categories = [p.eligible_merchant_categories];
    }
    return {
      id: p.id,
      orgId: p.org_id,
      category: p.category,
      monthlyLimitETB: Number(p.monthly_limit_etb),
      eligibleMerchantCategories: categories,
      isActive: Boolean(p.is_active),
      createdAt: p.created_at,
    };
  });

  res.json({ policies });
});

/**
 * PUT /api/employer/policies/:id
 * Updates benefit policy monthly limit or eligible merchant categories
 */
employerRouter.put('/policies/:id', optionalAuthenticate, (req, res) => {
  const db = getDb();
  const { monthlyLimitETB, eligibleMerchantCategories, isActive } = req.body || {};

  const existing = db.prepare('SELECT * FROM benefit_policies WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: `Policy ${req.params.id} not found.` },
    });
  }

  const updatedLimit = monthlyLimitETB !== undefined ? Number(monthlyLimitETB) : existing.monthly_limit_etb;
  const updatedCategories = eligibleMerchantCategories !== undefined
    ? JSON.stringify(eligibleMerchantCategories)
    : existing.eligible_merchant_categories;
  const updatedActive = isActive !== undefined ? (isActive ? 1 : 0) : existing.is_active;

  db.prepare(`
    UPDATE benefit_policies 
    SET monthly_limit_etb = ?, eligible_merchant_categories = ?, is_active = ?
    WHERE id = ?
  `).run(updatedLimit, updatedCategories, updatedActive, req.params.id);

  res.json({
    success: true,
    policy: {
      id: req.params.id,
      category: existing.category,
      monthlyLimitETB: updatedLimit,
      eligibleMerchantCategories: JSON.parse(updatedCategories),
      isActive: Boolean(updatedActive),
    },
  });
});

/**
 * GET /api/employer/employees
 * Employee roster with per-category benefit usage and PayLater outstanding
 */
employerRouter.get('/employees', optionalAuthenticate, (req, res) => {
  const db = getDb();
  const orgId = resolveOrgId(req);

  const org = db.prepare('SELECT name FROM organizations WHERE id = ?').get(orgId);
  const orgName = org ? org.name : '';

  const employees = db.prepare(`
    SELECT * FROM employees 
    WHERE employer_id = ? 
       OR employer_id = ?
       OR (employer_name IS NOT NULL AND employer_name = ?)
  `).all(orgId, orgId === 'org-001' ? 'emp-eth-telecom' : 'emp-cbe', orgName);

  const roster = employees.map((emp) => {
    // Get wallets for this employee
    const wallets = db.prepare('SELECT * FROM benefit_wallets WHERE employee_id = ?').all(emp.id);
    const ba = db.prepare('SELECT * FROM benefit_accounts WHERE employee_id = ?').get(emp.id);

    const walletMap = {};
    let totalUsed = 0;
    wallets.forEach((w) => {
      const limit = Number(w.monthly_limit_etb);
      const used = Number(w.used_etb);
      totalUsed += used;
      walletMap[w.category.toLowerCase()] = {
        limit,
        used,
        available: Math.max(0, limit - used),
      };
    });

    const salaryLimit = ba ? Number(ba.salary_link_limit_etb) : 1000;
    const salaryUsed = ba ? Number(ba.used_salary_link_etb) : 0;

    return {
      id: emp.id,
      name: emp.name,
      phone: emp.phone,
      food: walletMap.food || { limit: 2000, used: 0, available: 2000 },
      transport: walletMap.transport || { limit: 800, used: 0, available: 800 },
      health: walletMap.health || { limit: 500, used: 0, available: 500 },
      payLater: {
        limit: salaryLimit,
        used: salaryUsed,
        available: Math.max(0, salaryLimit - salaryUsed),
      },
      totalSpendETB: totalUsed + salaryUsed,
    };
  });

  res.json({ employees: roster });
});

/**
 * GET /api/employer/analytics
 * Aggregated category spend and budget utilization
 */
employerRouter.get('/analytics', optionalAuthenticate, (req, res) => {
  const db = getDb();
  const orgId = resolveOrgId(req);

  // Compute spend by category across all benefit wallets in org
  const categoryStats = db.prepare(`
    SELECT 
      bw.category,
      SUM(bw.monthly_limit_etb) AS total_budget,
      SUM(bw.used_etb) AS total_used
    FROM benefit_wallets bw
    JOIN employees e ON e.id = bw.employee_id
    WHERE e.employer_id = ?
    GROUP BY bw.category
  `).all(orgId);

  const breakdown = categoryStats.map((c) => ({
    category: c.category,
    budgetETB: Number(c.total_budget || 0),
    usedETB: Number(c.total_used || 0),
    utilizationRate: c.total_budget > 0 ? Math.round((c.total_used / c.total_budget) * 100) : 0,
  }));

  res.json({
    analytics: {
      categoryBreakdown: breakdown,
      period: 'October 2026',
      settlementCycle: 'Monthly (Payroll Deduction Synchronized)',
    },
  });
});

module.exports = {
  employerRouter,
};
