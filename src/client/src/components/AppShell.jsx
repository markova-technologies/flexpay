import { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  House,
  ShoppingCart,
  Receipt,
  Buildings,
  ArrowsClockwise,
  List,
  X,
  SignOut,
  DeviceMobile,
  CalendarCheck,
  UserCircle,
  CaretDown,
} from '@phosphor-icons/react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { DEMO_SCENARIO } from '../api/scenarios.js';
import './AppShell.css';

const DEMO_PERSONAS = [
  {
    name: 'Abebe Kebede',
    org: 'Ethio Telecom',
    role: 'EMPLOYEE',
    email: 'abebe@ethiotelecom.et',
    pin: '1234',
    badge: 'Employee (Food & Transport)',
    targetRoute: '/',
  },
  {
    name: 'Sara Haile',
    org: 'CBE',
    role: 'EMPLOYEE',
    email: 'sara@cbe.et',
    pin: '1234',
    badge: 'Employee (Health & PayLater)',
    targetRoute: '/',
  },
  {
    name: 'Dawit Tadesse',
    org: 'Ethio Telecom (HR)',
    role: 'EMPLOYER_ADMIN',
    email: 'hr@ethiotelecom.et',
    pin: '5678',
    badge: 'HR Admin (Policies & Pool)',
    targetRoute: '/employer',
  },
  {
    name: 'Aster Molla',
    org: 'CBE (HR Admin)',
    role: 'EMPLOYER_ADMIN',
    email: 'hr@cbe.et',
    pin: '5678',
    badge: 'HR Admin (CBE Roster)',
    targetRoute: '/employer',
  },
  {
    name: 'Yod Abyssinia',
    org: 'Bole Branch',
    role: 'MERCHANT',
    email: 'yod@abyssinia.et',
    pin: '9012',
    badge: 'Merchant POS (Food)',
    targetRoute: '/merchant',
  },
  {
    name: 'Addis Café',
    org: 'Kazanchis Branch',
    role: 'MERCHANT',
    email: 'addis@cafe.et',
    pin: '9012',
    badge: 'Merchant POS (Food)',
    targetRoute: '/merchant',
  },
  {
    name: 'System Controller',
    org: 'FlexPay Ops & Audit',
    role: 'FLEXPAY_ADMIN',
    email: 'ops@flexpay.et',
    pin: '0000',
    badge: 'SuperAdmin / Ops Ledger',
    targetRoute: '/ops',
  },
];

const SCENARIOS = [
  { value: 'SUCCESS',              label: '✓ Success (ResultCode 0)' },
  { value: 'USER_CANCELLED',       label: '✗ User Cancelled (1032)' },
  { value: 'TIMEOUT',              label: '⏱ Timeout (1037)' },
  { value: 'INSUFFICIENT_BENEFIT', label: '◑ Insufficient Benefit' },
  { value: 'INELIGIBLE_MERCHANT',  label: '⊘ Ineligible Merchant' },
];

function getNavItems(role) {
  switch (role) {
    case 'EMPLOYER_ADMIN':
      return [
        { to: '/employer', label: 'Benefit Policies', icon: Buildings },
        { to: '/transactions', label: 'Audit Ledger', icon: Receipt },
        { to: '/ops', label: 'Reconciliation', icon: ArrowsClockwise },
      ];
    case 'MERCHANT':
      return [
        { to: '/merchant', label: 'Cashier POS', icon: DeviceMobile },
        { to: '/transactions', label: 'Sales Ledger', icon: Receipt },
      ];
    case 'FLEXPAY_ADMIN':
      return [
        { to: '/ops', label: 'Ops & Ledger', icon: ArrowsClockwise },
        { to: '/employer', label: 'Employer View', icon: Buildings },
        { to: '/merchant', label: 'Merchant POS', icon: DeviceMobile },
        { to: '/transactions', label: 'System Ledger', icon: Receipt },
      ];
    case 'EMPLOYEE':
    default:
      return [
        { to: '/', label: 'My Wallets', icon: House },
        { to: '/checkout', label: 'New Purchase', icon: ShoppingCart },
        { to: '/repayment', label: 'Repayment Plan', icon: CalendarCheck },
        { to: '/transactions', label: 'My Transactions', icon: Receipt },
      ];
  }
}

export default function AppShell({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, switchDemoUser } = useAuth();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [scenario, setScenario] = useState(DEMO_SCENARIO.current);
  const [switchingUser, setSwitchingUser] = useState(false);

  // If on login page, render full screen without the sidebar
  if (location.pathname === '/login') {
    return (
      <div className="shell shell--auth">
        <main className="shell__main shell__main--auth">
          {children}
        </main>
      </div>
    );
  }

  function handleScenarioChange(val) {
    DEMO_SCENARIO.current = val;
    setScenario(val);
  }

  async function handlePersonaSwitch(e) {
    const selectedEmail = e.target.value;
    if (!selectedEmail) return;
    const persona = DEMO_PERSONAS.find((p) => p.email === selectedEmail);
    if (!persona) return;

    setSwitchingUser(true);
    try {
      await switchDemoUser(persona, persona.pin);
      navigate(persona.targetRoute, { replace: true });
    } catch (err) {
      console.error('Failed to switch demo persona:', err);
    } finally {
      setSwitchingUser(false);
    }
  }

  async function handleSignOut() {
    await logout();
    navigate('/login', { replace: true });
  }

  const role = user?.role || 'EMPLOYEE';
  const navItems = getNavItems(role);

  return (
    <div className="shell">
      {/* Simulation banner */}
      <div className="fp-sim-banner">
        <span>◆</span>
        <span>SAFARICOM ETHIOPIA M-PESA SIMULATION — Active Hackathon Environment</span>
      </div>

      {/* Mobile header */}
      <header className="shell__mob-header">
        <div className="shell__logo">
          <LogoMark /> FlexPay
        </div>
        <button
          className="shell__mob-toggle"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
        >
          {mobileOpen ? <X size={20} /> : <List size={20} />}
        </button>
      </header>

      {/* Sidebar */}
      <nav
        className={`shell__nav ${mobileOpen ? 'shell__nav--open' : ''}`}
        role="navigation"
        aria-label="Primary navigation"
      >
        <div className="shell__brand-block">
          <div className="shell__logo shell__logo--desktop">
            <LogoMark />
            <div className="shell__logo-text">
              <span className="shell__logo-name">FlexPay</span>
              <span className="shell__logo-by">Markova Technologies</span>
            </div>
          </div>
          <div className="shell__org-badge">
            <span className="shell__org-dot" />
            <span className="shell__org-title">Ethiopian Corporate Network</span>
          </div>
        </div>

        {/* User Identity Card */}
        {user && (
          <div className="shell__user-card">
            <div className="shell__user-avatar">
              <UserCircle size={28} weight="fill" />
            </div>
            <div className="shell__user-info">
              <div className="shell__user-name" title={user.name}>
                {user.name}
              </div>
              <div className="shell__user-sub">
                <span className={`shell__role-pill shell__role-pill--${role.toLowerCase()}`}>
                  {role === 'EMPLOYEE' && 'Employee'}
                  {role === 'EMPLOYER_ADMIN' && 'HR Admin'}
                  {role === 'MERCHANT' && 'Merchant POS'}
                  {role === 'FLEXPAY_ADMIN' && 'System Ops'}
                </span>
              </div>
            </div>
            <button
              className="shell__signout-btn"
              onClick={handleSignOut}
              title="Sign Out"
              aria-label="Sign Out"
            >
              <SignOut size={16} weight="bold" />
            </button>
          </div>
        )}

        {/* Quick Demo Persona Switcher */}
        <div className="shell__persona-switcher">
          <div className="shell__persona-label">
            <span>⚡ Demo Persona</span>
            {switchingUser && <span className="shell__switching-dot">Switching...</span>}
          </div>
          <div className="shell__select-wrapper">
            <select
              value={user?.email || ''}
              onChange={handlePersonaSwitch}
              disabled={switchingUser}
              className="shell__persona-select"
            >
              {DEMO_PERSONAS.map((p) => (
                <option key={p.email} value={p.email}>
                  {p.name} ({p.badge})
                </option>
              ))}
            </select>
            <CaretDown size={14} className="shell__select-caret" />
          </div>
        </div>

        {/* Navigation Items */}
        <div className="shell__nav-items">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/' || to === '/employer' || to === '/merchant' || to === '/ops'}
              className={({ isActive }) =>
                `shell__nav-link ${isActive ? 'shell__nav-link--active' : ''}`
              }
              onClick={() => setMobileOpen(false)}
            >
              <Icon size={18} weight="regular" />
              <span>{label}</span>
            </NavLink>
          ))}
        </div>

        {/* Demo controls panel */}
        <div className="shell__demo-panel">
          <div className="shell__demo-header">
            <p className="fp-label" style={{ fontSize: '0.6875rem' }}>M-PESA Scenario</p>
            <span className="shell__demo-badge">Active</span>
          </div>
          {SCENARIOS.map(({ value, label }) => (
            <label key={value} className="shell__demo-option">
              <input
                type="radio"
                name="scenario"
                value={value}
                checked={scenario === value}
                onChange={() => handleScenarioChange(value)}
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </nav>

      {/* Overlay for mobile drawer */}
      {mobileOpen && (
        <div className="shell__overlay" onClick={() => setMobileOpen(false)} />
      )}

      {/* Main content */}
      <main className="shell__main" id="main-content">
        {children}
      </main>

      {/* Mobile bottom nav */}
      <nav className="shell__bottom-nav" aria-label="Mobile navigation">
        {navItems.slice(0, 4).map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/' || to === '/employer' || to === '/merchant' || to === '/ops'}
            className={({ isActive }) =>
              `shell__bottom-link ${isActive ? 'shell__bottom-link--active' : ''}`
            }
          >
            <Icon size={22} weight="regular" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

function LogoMark() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect width="24" height="24" rx="6" fill="var(--fp-benefit)" />
      <path d="M7 8h6a2 2 0 0 1 0 4H7V8Z" fill="var(--fp-text-inverse)" />
      <rect x="7" y="14" width="4" height="2" rx="1" fill="var(--fp-text-inverse)" />
    </svg>
  );
}
