import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';

export default function ProtectedRoute({ allowedRoles, children }) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        gap: '16px',
        color: 'var(--fp-text-secondary)',
      }}>
        <div style={{
          width: '32px',
          height: '32px',
          borderRadius: '50%',
          border: '2px solid rgba(16, 185, 129, 0.2)',
          borderTopColor: 'var(--fp-benefit)',
          animation: 'spin 0.8s linear infinite',
        }} />
        <span style={{ fontSize: '0.875rem' }}>Authenticating session...</span>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && Array.isArray(allowedRoles) && !allowedRoles.includes(user.role)) {
    // Redirect to the user's role-appropriate home portal
    switch (user.role) {
      case 'EMPLOYER_ADMIN':
        return <Navigate to="/employer" replace />;
      case 'MERCHANT':
        return <Navigate to="/merchant" replace />;
      case 'FLEXPAY_ADMIN':
        return <Navigate to="/ops" replace />;
      case 'EMPLOYEE':
      default:
        return <Navigate to="/" replace />;
    }
  }

  return children;
}
