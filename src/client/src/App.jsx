import { Routes, Route, Navigate } from 'react-router-dom';
import AppShell from './components/AppShell.jsx';
import ProtectedRoute from './router/ProtectedRoute.jsx';
import { useAuth } from './contexts/AuthContext.jsx';

import LoginPage from './pages/auth/LoginPage.jsx';
import EmployeeDashboard from './pages/employee/EmployeeDashboard.jsx';
import RepaymentPage from './pages/employee/RepaymentPage.jsx';
import EmployerDashboard from './pages/employer/EmployerDashboard.jsx';
import MerchantPOS from './pages/merchant/MerchantPOS.jsx';
import CheckoutPage from './pages/CheckoutPage.jsx';
import TransactionListPage from './pages/TransactionListPage.jsx';
import TransactionDetailPage from './pages/TransactionDetailPage.jsx';
import OpsPage from './pages/OpsPage.jsx';

function RootIndex() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;

  switch (user.role) {
    case 'EMPLOYER_ADMIN':
      return <Navigate to="/employer" replace />;
    case 'MERCHANT':
      return <Navigate to="/merchant" replace />;
    case 'FLEXPAY_ADMIN':
      return <Navigate to="/ops" replace />;
    case 'EMPLOYEE':
    default:
      return <EmployeeDashboard />;
  }
}

export default function App() {
  return (
    <AppShell>
      <Routes>
        {/* Public login */}
        <Route path="/login" element={<LoginPage />} />

        {/* Dynamic authenticated home */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <RootIndex />
            </ProtectedRoute>
          }
        />

        {/* Employee Purchase & Repayment Routes */}
        <Route
          path="/checkout"
          element={
            <ProtectedRoute allowedRoles={['EMPLOYEE', 'FLEXPAY_ADMIN']}>
              <CheckoutPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/checkout/:orderId"
          element={
            <ProtectedRoute allowedRoles={['EMPLOYEE', 'FLEXPAY_ADMIN']}>
              <CheckoutPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/repayment"
          element={
            <ProtectedRoute allowedRoles={['EMPLOYEE', 'FLEXPAY_ADMIN']}>
              <RepaymentPage />
            </ProtectedRoute>
          }
        />

        {/* Employer Admin Portal */}
        <Route
          path="/employer"
          element={
            <ProtectedRoute allowedRoles={['EMPLOYER_ADMIN', 'FLEXPAY_ADMIN']}>
              <EmployerDashboard />
            </ProtectedRoute>
          }
        />

        {/* Merchant POS Terminal */}
        <Route
          path="/merchant"
          element={
            <ProtectedRoute allowedRoles={['MERCHANT', 'FLEXPAY_ADMIN']}>
              <MerchantPOS />
            </ProtectedRoute>
          }
        />

        {/* Operations & Platform Ledger Portal */}
        <Route
          path="/ops"
          element={
            <ProtectedRoute allowedRoles={['FLEXPAY_ADMIN']}>
              <OpsPage />
            </ProtectedRoute>
          }
        />

        {/* Audit & Transactions */}
        <Route
          path="/transactions"
          element={
            <ProtectedRoute>
              <TransactionListPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/transactions/:id"
          element={
            <ProtectedRoute>
              <TransactionDetailPage />
            </ProtectedRoute>
          }
        />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  );
}
