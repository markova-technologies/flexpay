/**
 * FlexPay JWT Authentication Middleware
 * =====================================
 * Verifies Authorization: Bearer <token> and decorates req.user.
 */

const { verifyToken } = require('../domain/auth.js');

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication token missing or invalid format (Bearer token required).',
      },
    });
  }

  const token = authHeader.slice(7).trim();
  try {
    const payload = verifyToken(token);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: `Token validation failed: ${err.message}`,
      },
    });
  }
}

/**
 * Optional authentication middleware for endpoints accessible publicly or with enriched user context
 */
function optionalAuthenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    try {
      req.user = verifyToken(token);
    } catch {
      // Ignore invalid optional tokens
    }
  }
  next();
}

module.exports = {
  authenticate,
  optionalAuthenticate,
};
