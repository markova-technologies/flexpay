import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/layout/ProtectedRoute';

// Lazy-loaded portals & features
const LandingPage = lazy(() => import('./features/landing/LandingPage'));
const AuthHub = lazy(() => import('./features/auth/AuthHub'));
const OrgAuthPage = lazy(() => import('./features/auth/OrgAuthPage'));
const MerchantAuthPage = lazy(() => import('./features/auth/MerchantAuthPage'));
const EmployeeLoginPage = lazy(() => import('./features/auth/EmployeeLoginPage'));
const OrgDashboard = lazy(() => import('./features/organization/OrgDashboard'));
const EmployeeDashboard = lazy(() => import('./features/employee/EmployeeDashboard'));
const MerchantPOS = lazy(() => import('./features/merchant/MerchantPOS'));

export default function App() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            minHeight: '100vh',
            background: 'var(--fp-bg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--fp-text-muted)',
            fontFamily: 'var(--fp-font-mono)',
          }}
        >
          Loading FlexPay...
        </div>
      }
    >
      <Routes>
        {/* Public Landing & Auth Hub */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/auth" element={<AuthHub />} />

        {/* Portal Authentication Pages */}
        <Route path="/auth/organization" element={<OrgAuthPage />} />
        <Route path="/auth/merchant" element={<MerchantAuthPage />} />
        <Route path="/auth/employee" element={<EmployeeLoginPage />} />

        {/* Protected Role Portals */}
        <Route
          path="/org/*"
          element={
            <ProtectedRoute allowedRoles={['ORG_ADMIN', 'ORG_CONTROLLER']}>
              <OrgDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/employee/*"
          element={
            <ProtectedRoute allowedRoles={['EMPLOYEE']}>
              <EmployeeDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/merchant/*"
          element={
            <ProtectedRoute allowedRoles={['MERCHANT_OWNER', 'MERCHANT_STAFF']}>
              <MerchantPOS />
            </ProtectedRoute>
          }
        />

        {/* Catch-all redirect */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
