import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore, getPortalForPath } from '../../stores/authStore';

export default function ProtectedRoute({ children, allowedRoles }) {
  const location = useLocation();
  const getSessionForPortal = useAuthStore((s) => s.getSessionForPortal);
  const legacyUser = useAuthStore((s) => s.user);
  const legacyToken = useAuthStore((s) => s.accessToken);

  // 1. Resolve target portal from allowedRoles or active URL path
  let portal = null;
  if (allowedRoles && Array.isArray(allowedRoles) && allowedRoles.length > 0) {
    if (allowedRoles.some((r) => (r || '').startsWith('ORG_') || r === 'ORGANIZATION')) {
      portal = 'ORG';
    } else if (allowedRoles.some((r) => (r || '').startsWith('MERCHANT'))) {
      portal = 'MERCHANT';
    } else if (allowedRoles.some((r) => r === 'EMPLOYEE' || r === 'WORKER')) {
      portal = 'EMPLOYEE';
    }
  }
  if (!portal) {
    portal = getPortalForPath(location.pathname);
  }

  // 2. Fetch the session strictly isolated for THIS portal
  const session = getSessionForPortal ? getSessionForPortal(portal) : { user: legacyUser, accessToken: legacyToken };
  const user = session?.user || (portal === null ? legacyUser : null);
  const accessToken = session?.accessToken || (portal === null ? legacyToken : null);

  // 3. If unauthenticated for this specific portal, redirect to its dedicated login
  if (!accessToken || !user) {
    if (portal === 'ORG') return <Navigate to="/auth/organization" replace />;
    if (portal === 'MERCHANT') return <Navigate to="/auth/merchant" replace />;
    if (portal === 'EMPLOYEE') return <Navigate to="/auth/employee" replace />;
    return <Navigate to="/auth" replace />;
  }

  // 4. Role validation strictly against this portal's user
  if (allowedRoles && Array.isArray(allowedRoles) && allowedRoles.length > 0) {
    const userRole = (user.role || '').toUpperCase();
    const isAllowed = allowedRoles.some((r) => {
      const target = (r || '').toUpperCase();
      if (userRole === target) return true;
      if (['ADMIN', 'FLEXPAY_ADMIN', 'SUPER_ADMIN'].includes(userRole)) return true;
      if (target === 'MERCHANT' || target.startsWith('MERCHANT_')) {
        if (['EMPLOYEE', 'WORKER'].includes(userRole)) return false;
        return userRole === 'MERCHANT' || userRole.startsWith('MERCHANT_') || Boolean(user.merchantId);
      }
      if (target.startsWith('ORG_') || target === 'EMPLOYER_ADMIN' || target === 'ORGANIZATION') {
        if (['EMPLOYEE', 'WORKER'].includes(userRole)) return false;
        return userRole.startsWith('ORG_') || userRole === 'EMPLOYER_ADMIN' || userRole === 'ORGANIZATION';
      }
      if (target === 'EMPLOYEE' || target === 'WORKER') {
        return userRole === 'EMPLOYEE' || userRole === 'WORKER' || Boolean(user.employeeId);
      }
      return false;
    });

    if (!isAllowed) {
      if (portal === 'ORG') return <Navigate to="/auth/organization" replace />;
      if (portal === 'MERCHANT') return <Navigate to="/auth/merchant" replace />;
      if (portal === 'EMPLOYEE') return <Navigate to="/auth/employee" replace />;
      return <Navigate to="/auth" replace />;
    }
  }

  return children;
}
