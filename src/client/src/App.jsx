import React, { Component } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/layout/ProtectedRoute';

// Direct synchronous imports for zero-delay, chunk-failure-free portal navigation
import LandingPage from './features/landing/LandingPage';
import AuthHub from './features/auth/AuthHub';
import OrgAuthPage from './features/auth/OrgAuthPage';
import MerchantAuthPage from './features/auth/MerchantAuthPage';
import EmployeeLoginPage from './features/auth/EmployeeLoginPage';
import OrgDashboard from './features/organization/OrgDashboard';
import EmployeeDashboard from './features/employee/EmployeeDashboard';
import MerchantLayout from './features/merchant/MerchantLayout';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Unhandled runtime error in portal:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: '100vh',
            background: 'var(--fp-bg)',
            color: 'var(--fp-text-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            fontFamily: 'var(--fp-font-sans)',
          }}
        >
          <div
            style={{
              maxWidth: '460px',
              width: '100%',
              background: 'var(--fp-surface-1)',
              border: '1px solid var(--fp-border)',
              borderRadius: '20px',
              padding: '36px',
              textAlign: 'center',
              boxShadow: 'var(--fp-shadow-lg)',
            }}
          >
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                background: 'rgba(239, 68, 68, 0.15)',
                color: '#EF4444',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
                fontWeight: 800,
                fontSize: '1.25rem',
              }}
            >
              !
            </div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '8px' }}>
              Portal Render Issue
            </h2>
            <p style={{ color: 'var(--fp-text-secondary)', fontSize: '0.875rem', marginBottom: '24px', lineHeight: 1.5 }}>
              A view error occurred. Refreshing the portal will restore the active session.
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                background: 'var(--fp-benefit)',
                color: '#060A14',
                fontWeight: 700,
                fontSize: '0.95rem',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Refresh Portal
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
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
          path="/org"
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
          path="/employee"
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
              <MerchantLayout />
            </ProtectedRoute>
          }
        />
        <Route
          path="/merchant"
          element={
            <ProtectedRoute allowedRoles={['MERCHANT_OWNER', 'MERCHANT_STAFF']}>
              <MerchantLayout />
            </ProtectedRoute>
          }
        />

        {/* Catch-all redirect */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ErrorBoundary>
  );
}
