import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';

export default function ProtectedRoute({ children, allowedRoles }) {
  const { user, accessToken } = useAuthStore();

  if (!accessToken || !user) {
    return <Navigate to="/auth" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/auth" replace />;
  }

  return children;
}

