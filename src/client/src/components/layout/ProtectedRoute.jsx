import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';

export default function ProtectedRoute({ children, allowedRoles }) {
  const { user, accessToken, _hasHydrated } = useAuthStore();
  const [hydrated, setHydrated] = useState(_hasHydrated);

  useEffect(() => {
    if (_hasHydrated) {
      setHydrated(true);
    } else {
      const unsub = useAuthStore.persist?.onFinishHydration?.(() => {
        setHydrated(true);
      });
      if (useAuthStore.persist?.hasHydrated?.()) {
        setHydrated(true);
      }
      return () => unsub?.();
    }
  }, [_hasHydrated]);

  // Wait for persisted auth state to rehydrate before evaluating access
  if (!hydrated) {
    return null;
  }

  if (!accessToken || !user) {
    return <Navigate to="/auth" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/auth" replace />;
  }

  return children;
}

