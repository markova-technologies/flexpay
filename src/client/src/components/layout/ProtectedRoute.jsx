import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';

export default function ProtectedRoute({ children, allowedRoles }) {
  const { user, accessToken } = useAuthStore();

  if (!accessToken || !user) {
    return <Navigate to="/auth" replace />;
  }

  if (allowedRoles && Array.isArray(allowedRoles) && allowedRoles.length > 0) {
    const userRole = (user.role || '').toUpperCase();
    const isAllowed = allowedRoles.some((r) => {
      const target = (r || '').toUpperCase();
      if (userRole === target) return true;
      if (['ADMIN', 'FLEXPAY_ADMIN', 'SUPER_ADMIN'].includes(userRole)) return true;
      if (
        (target === 'MERCHANT' || target.startsWith('MERCHANT_'))
      ) {
        if (['EMPLOYEE', 'WORKER'].includes(userRole)) return false;
        if (userRole === 'MERCHANT' || userRole.startsWith('MERCHANT_') || Boolean(user.merchantId)) {
          return true;
        }
      }
      if (
        (target.startsWith('ORG_') || target === 'EMPLOYER_ADMIN' || target === 'ORGANIZATION')
      ) {
        if (['EMPLOYEE', 'WORKER'].includes(userRole)) return false;
        if (
          userRole.startsWith('ORG_') ||
          userRole === 'EMPLOYER_ADMIN' ||
          userRole === 'ORGANIZATION'
        ) {
          return true;
        }
      }
      if (
        (target === 'EMPLOYEE' || target === 'WORKER') &&
        (userRole === 'EMPLOYEE' || userRole === 'WORKER' || Boolean(user.employeeId))
      ) {
        return true;
      }
      return false;
    });

    if (!isAllowed) {
      if (['EMPLOYEE', 'WORKER'].includes(userRole)) {
        return <Navigate to="/employee" replace />;
      }
      if (userRole === 'MERCHANT' || userRole.startsWith('MERCHANT_')) {
        return <Navigate to="/merchant" replace />;
      }
      if (userRole.startsWith('ORG_') || userRole === 'EMPLOYER_ADMIN' || userRole === 'ORGANIZATION') {
        return <Navigate to="/org" replace />;
      }
      return <Navigate to="/auth" replace />;
    }
  }

  return children;
}


