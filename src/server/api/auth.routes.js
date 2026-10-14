/**
 * FlexPay Auth API Routes
 * =======================
 * Authentication endpoints: login, logout, profile, and demo quick-switch.
 */

const express = require('express');
const { login, getUserById } = require('../domain/auth.js');
const { authenticate } = require('../middleware/authenticate.js');
const { getDb } = require('../storage/db.js');

const authRouter = express.Router();

/**
 * POST /api/auth/login
 * Body: { email, pin }
 */
authRouter.post('/login', (req, res) => {
  const { email, pin } = req.body || {};
  if (!email || !pin) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Both email and PIN are required.',
      },
    });
  }

  try {
    const result = login(email, pin);
    res.json(result);
  } catch (err) {
    res.status(401).json({
      error: {
        code: 'AUTH_FAILED',
        message: err.message || 'Invalid credentials',
      },
    });
  }
});

/**
 * GET /api/auth/me
 * Header: Authorization: Bearer <token>
 */
authRouter.get('/me', authenticate, (req, res) => {
  const user = getUserById(req.user.userId);
  if (!user) {
    return res.status(404).json({
      error: {
        code: 'USER_NOT_FOUND',
        message: 'User account no longer exists or is inactive.',
      },
    });
  }
  res.json({ user });
});

/**
 * POST /api/auth/logout
 */
authRouter.post('/logout', (req, res) => {
  res.json({
    success: true,
    message: 'Logged out successfully.',
  });
});

/**
 * GET /api/auth/demo-users
 * Returns available pre-seeded demo users for one-click selection during presentations
 */
authRouter.get('/demo-users', (req, res) => {
  const db = getDb();
  const users = db.prepare(`
    SELECT id, email, role, entity_id, name 
    FROM users 
    WHERE is_active = 1
    ORDER BY role ASC, name ASC
  `).all();

  // Attach default PIN for convenience in demonstration mode
  const enriched = users.map((u) => {
    let pin = '1234';
    if (u.role === 'EMPLOYER_ADMIN') pin = '5678';
    if (u.role === 'MERCHANT') pin = '9012';
    if (u.role === 'FLEXPAY_ADMIN') pin = '0000';
    return {
      ...u,
      demoPin: pin,
    };
  });

  res.json({ users: enriched });
});

module.exports = {
  authRouter,
};
