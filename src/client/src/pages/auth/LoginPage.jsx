import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Wallet,
  Buildings,
  Storefront,
  GearSix,
  LockKey,
  EnvelopeSimple,
  Eye,
  EyeSlash,
  ArrowRight,
  ShieldCheck,
  CheckCircle,
  WarningCircle,
} from '@phosphor-icons/react';
import { useAuth } from '../../contexts/AuthContext.jsx';
import './LoginPage.css';

const ROLES = [
  { id: 'EMPLOYEE', label: 'Employee', icon: Wallet, defaultEmail: 'abebe@ethiotelecom.et', pin: '1234' },
  { id: 'EMPLOYER_ADMIN', label: 'Employer', icon: Buildings, defaultEmail: 'hr@ethiotelecom.et', pin: '5678' },
  { id: 'MERCHANT', label: 'Merchant', icon: Storefront, defaultEmail: 'yod@abyssinia.et', pin: '9012' },
  { id: 'FLEXPAY_ADMIN', label: 'Ops', icon: GearSix, defaultEmail: 'ops@flexpay.et', pin: '0000' },
];

const DEMO_PERSONAS = [
  {
    name: 'Abebe Kebede',
    org: 'Ethio Telecom (Employee)',
    role: 'EMPLOYEE',
    email: 'abebe@ethiotelecom.et',
    pin: '1234',
    badge: '🍽️ Food & 🚌 Transport',
  },
  {
    name: 'Sara Haile',
    org: 'CBE (Employee)',
    role: 'EMPLOYEE',
    email: 'sara@cbe.et',
    pin: '1234',
    badge: '💳 PayLater Ready',
  },
  {
    name: 'Ethio Telecom HR',
    org: 'Benefit Policy Admin',
    role: 'EMPLOYER_ADMIN',
    email: 'hr@ethiotelecom.et',
    pin: '5678',
    badge: '500,000 ETB Pool',
  },
  {
    name: 'Yod Abyssinia Manager',
    org: 'Supermarket POS',
    role: 'MERCHANT',
    email: 'yod@abyssinia.et',
    pin: '9012',
    badge: 'ShortCode 2005',
  },
  {
    name: 'FlexPay Ops & Audit',
    org: 'Platform Controller',
    role: 'FLEXPAY_ADMIN',
    email: 'ops@flexpay.et',
    pin: '0000',
    badge: 'Double-Entry Ledger',
  },
];

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, switchDemoUser } = useAuth();

  const [activeRole, setActiveRole] = useState('EMPLOYEE');
  const [email, setEmail] = useState('abebe@ethiotelecom.et');
  const [pin, setPin] = useState('1234');
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleRoleSelect(role) {
    setActiveRole(role.id);
    setEmail(role.defaultEmail);
    setPin(role.pin);
    setError(null);
  }

  function redirectUser(userRole) {
    const from = location.state?.from?.pathname;
    if (from && from !== '/login') {
      navigate(from, { replace: true });
      return;
    }

    switch (userRole) {
      case 'EMPLOYER_ADMIN':
        navigate('/employer', { replace: true });
        break;
      case 'MERCHANT':
        navigate('/merchant', { replace: true });
        break;
      case 'FLEXPAY_ADMIN':
        navigate('/ops', { replace: true });
        break;
      case 'EMPLOYEE':
      default:
        navigate('/', { replace: true });
        break;
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email || !pin) {
      setError('Please provide your corporate email and 4-digit PIN.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const user = await login(email, pin);
      redirectUser(user.role);
    } catch (err) {
      setError(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDemoPersonaClick(persona) {
    setIsSubmitting(true);
    setError(null);
    try {
      const user = await switchDemoUser(persona, persona.pin);
      redirectUser(user.role);
    } catch (err) {
      setError(err.message || 'Demo login failed');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fp-login-container">
      <div className="fp-login-card">
        <div className="fp-login-header">
          <div className="fp-login-brand">
            <div className="fp-login-logo-icon">
              <ShieldCheck size={22} weight="fill" />
            </div>
            <span className="fp-login-brand-title">FlexPay</span>
          </div>
          <p className="fp-login-subtitle">
            Corporate Benefits & Salary-Linked Purchasing Network
          </p>
        </div>

        {error && (
          <div className="fp-error-banner">
            <WarningCircle size={18} weight="fill" />
            <span>{error}</span>
          </div>
        )}

        <label className="fp-role-selector-label">Select Your Role</label>
        <div className="fp-role-grid">
          {ROLES.map((r) => {
            const Icon = r.icon;
            const isActive = activeRole === r.id;
            return (
              <button
                key={r.id}
                type="button"
                className={`fp-role-btn ${isActive ? 'active' : ''}`}
                onClick={() => handleRoleSelect(r)}
              >
                <Icon size={20} weight={isActive ? 'fill' : 'regular'} />
                <span>{r.label}</span>
              </button>
            );
          })}
        </div>

        <form className="fp-login-form" onSubmit={handleSubmit}>
          <div className="fp-input-group">
            <label className="fp-input-label">Corporate Email</label>
            <div className="fp-input-wrapper">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@organization.et"
                required
              />
              <span className="fp-input-icon">
                <EnvelopeSimple size={18} />
              </span>
            </div>
          </div>

          <div className="fp-input-group">
            <label className="fp-input-label">Security PIN (4 digits)</label>
            <div className="fp-input-wrapper">
              <input
                type={showPin ? 'text' : 'password'}
                maxLength={4}
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="••••"
                required
              />
              <span
                className="fp-input-icon"
                onClick={() => setShowPin(!showPin)}
                role="button"
                tabIndex={0}
              >
                {showPin ? <EyeSlash size={18} /> : <Eye size={18} />}
              </span>
            </div>
          </div>

          <button
            type="submit"
            className="fp-submit-btn"
            disabled={isSubmitting}
          >
            <span>{isSubmitting ? 'Authenticating...' : 'Sign In to Portal'}</span>
            <ArrowRight size={18} weight="bold" />
          </button>
        </form>

        {/* Demo One-Click Access for Judges */}
        <div className="fp-demo-box">
          <div className="fp-demo-box-header">
            <span className="fp-demo-box-title">⚡ Instant Hackathon Demo Personas</span>
          </div>
          <div className="fp-demo-chip-grid">
            {DEMO_PERSONAS.map((p) => (
              <div
                key={p.email}
                className="fp-demo-chip"
                onClick={() => handleDemoPersonaClick(p)}
                role="button"
                tabIndex={0}
              >
                <div>
                  <div className="fp-demo-chip-name">{p.name}</div>
                  <div className="fp-demo-chip-sub">{p.org}</div>
                </div>
                <span className="fp-demo-chip-badge">{p.badge}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="fp-login-footer">
        <div className="fp-trust-item">
          <CheckCircle size={14} weight="fill" color="var(--fp-benefit)" />
          <span>Safaricom Ethiopia M-PESA</span>
        </div>
        <span>•</span>
        <div className="fp-trust-item">
          <CheckCircle size={14} weight="fill" color="var(--fp-benefit)" />
          <span>Double-Entry Balanced Ledger</span>
        </div>
        <span>•</span>
        <div className="fp-trust-item">
          <CheckCircle size={14} weight="fill" color="var(--fp-benefit)" />
          <span>Payroll Synchronized</span>
        </div>
      </div>
    </div>
  );
}
