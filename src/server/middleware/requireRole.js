/**
 * FlexPay Role-Based Access Control (RBAC) Middleware
 * ===================================================
 * Guards route handlers to specified user roles.
 * Allowed roles: 'EMPLOYEE', 'EMPLOYER_ADMIN', 'MERCHANT', 'FLEXPAY_ADMIN'
 */

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'User authentication required prior to role verification.',
        },
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: `Access denied. Role '${req.user.role}' is not authorized. Required: ${allowedRoles.join(', ')}.`,
        },
      });
    }

    next();
  };
}

module.exports = {
  requireRole,
};
