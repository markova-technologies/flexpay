/**
 * Role Normalization & Flexible Role-Based Access Control
 * Gracefully handles role variations ('MERCHANT' vs 'MERCHANT_OWNER' vs 'MERCHANT_STAFF',
 * 'ORG_ADMIN' vs 'ORG_CONTROLLER' vs 'EMPLOYER_ADMIN', etc.)
 */
function normalizeRole(role) {
  if (!role) return '';
  return String(role).trim().toUpperCase();
}

function hasPermission(userRole, requiredRoles, userObj) {
  if (!userRole && !userObj) return false;

  const normalizedUser = normalizeRole(userRole || userObj?.role);

  // Platform superadmins have universal authorization
  if (['ADMIN', 'FLEXPAY_ADMIN', 'SUPER_ADMIN'].includes(normalizedUser)) {
    return true;
  }

  const normalizedRequired = requiredRoles.map((r) => normalizeRole(r));

  // 1. Direct role match
  if (normalizedRequired.includes(normalizedUser)) {
    return true;
  }

  // 2. Merchant family match
  const requiresMerchant = normalizedRequired.some(
    (r) => r === 'MERCHANT' || r.startsWith('MERCHANT_')
  );
  if (requiresMerchant) {
    if (
      normalizedUser === 'MERCHANT' ||
      normalizedUser.startsWith('MERCHANT_') ||
      (!normalizedUser.startsWith('ORG_') && normalizedUser !== 'EMPLOYEE' && Boolean(userObj?.merchantId || userObj?.merchant_id))
    ) {
      return true;
    }
  }

  // 3. Organization family match
  const requiresOrg = normalizedRequired.some(
    (r) => r.startsWith('ORG_') || r === 'EMPLOYER_ADMIN' || r === 'ORGANIZATION'
  );
  if (requiresOrg) {
    if (
      normalizedUser.startsWith('ORG_') ||
      normalizedUser === 'EMPLOYER_ADMIN' ||
      normalizedUser === 'ORGANIZATION'
    ) {
      return true;
    }
  }

  // 4. Employee family match
  const requiresEmployee = normalizedRequired.some(
    (r) => r === 'EMPLOYEE' || r === 'WORKER'
  );
  if (requiresEmployee) {
    if (
      normalizedUser === 'EMPLOYEE' ||
      normalizedUser === 'WORKER' ||
      Boolean(userObj?.employeeId || userObj?.employee_id || userObj?.fpEmployeeId)
    ) {
      return true;
    }
  }

  return false;
}

function requireRole(...roles) {
  return async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({ error: 'Unauthorized: missing session' });
    }

    const userRole = request.user.role || request.user.userRole;
    if (!hasPermission(userRole, roles, request.user)) {
      return reply.code(403).send({ error: 'Forbidden: insufficient permissions' });
    }
  };
}

module.exports = { requireRole, hasPermission };

