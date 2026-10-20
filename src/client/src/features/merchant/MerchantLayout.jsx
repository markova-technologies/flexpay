import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { List, CaretDown, CreditCard, SignOut } from '@phosphor-icons/react';
import { useAuthStore } from '../../stores/authStore';
import api from '../../services/api';
import { Drawer } from '../../components/ui/Drawer';
import { FlexPayLogo } from '../../components/ui/FlexPayLogo';
import MerchantDashboard from './MerchantDashboard';
import MerchantSettlements from './MerchantSettlements';
import MerchantOrgs from './MerchantOrgs';
import MerchantEmployees from './MerchantEmployees';
import MerchantTransactions from './MerchantTransactions';
import MerchantPOS from './pos/MerchantPOS';
import MerchantAnalytics from './MerchantAnalytics';
import './MerchantLayout.css';

const NAV_ITEMS = [
  { key: 'overview',       label: 'Overview',       icon: '📊', desc: 'Receivables, settlements & metrics' },
  { key: 'settlements',    label: 'Settlements',    icon: '💰', desc: 'Employer wires & M-PESA receipts' },
  { key: 'organizations',  label: 'Organizations',  icon: '🏢', desc: 'Corporate employer partners' },
  { key: 'employees',      label: 'Employees',      icon: '👥', desc: 'Enrolled employee credit accounts' },
  { key: 'transactions',   label: 'Transactions',   icon: '📋', desc: 'Audit log of in-store checkouts' },
  { key: 'pos',            label: 'POS Scanner',    icon: '💳', desc: 'Camera QR scanner & manual FP-ID' },
  { key: 'analytics',      label: 'Analytics',      icon: '📈', desc: 'Sales breakdown & top categories' },
];

export function MerchantLayout() {
  const [active, setActive] = useState('overview');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { user, clearAuth } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {}
    clearAuth();
    navigate('/auth');
  };

  const currentItem = NAV_ITEMS.find((item) => item.key === active) || NAV_ITEMS[0];

  return (
    <div className="merchant-layout">
      {/* Mobile Top Header */}
      <header className="merchant-mobile-header">
        <FlexPayLogo variant="compact" size={26} onClick={() => navigate('/')} style={{ cursor: 'pointer' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            className="merchant-quick-pos-btn fp-touch-target"
            onClick={() => setActive('pos')}
            aria-label="Open POS Terminal"
          >
            <CreditCard size={16} weight="bold" />
            <span>POS</span>
          </button>
          <button
            type="button"
            className="merchant-menu-btn"
            onClick={() => setMobileNavOpen(true)}
            aria-label="Open Merchant Navigation Menu"
            aria-expanded={mobileNavOpen}
          >
            <List size={20} weight="bold" />
            <span>Menu</span>
          </button>
        </div>
      </header>

      {/* Mobile Active Section Sub-Bar */}
      <div className="merchant-mobile-subbar">
        <div className="merchant-mobile-subbar__current">
          <span>{currentItem.icon}</span>
          <span>{currentItem.label}</span>
        </div>
        <button
          type="button"
          className="merchant-mobile-subbar__btn"
          onClick={() => setMobileNavOpen(true)}
          aria-label="Switch Merchant View"
        >
          <span>Switch</span>
          <CaretDown size={12} weight="bold" />
        </button>
      </div>

      {/* Mobile Navigation Drawer */}
      <Drawer
        open={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
        title="Merchant Navigation"
        width="min(88vw, 360px)"
        side="right"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Merchant Profile Card */}
          <div
            style={{
              background: 'var(--fp-surface-2)',
              border: '1px solid var(--fp-border)',
              borderRadius: '14px',
              padding: '16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  background: 'rgba(255, 77, 38, 0.15)',
                  color: 'var(--fp-orange, #FF4D26)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.25rem',
                  flexShrink: 0,
                }}
              >
                🏪
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--fp-text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {user?.businessName || user?.merchantName || user?.name || 'Retail Merchant'}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--fp-orange, #FF4D26)', fontWeight: 600 }}>
                  Till: {user?.tillNumber || user?.safaricomShortcode || 'M-PESA POS'} • Active Partner
                </div>
              </div>
            </div>
          </div>

          {/* Navigation Items List */}
          <div>
            <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fp-text-muted)', fontWeight: 700, marginBottom: '8px', paddingLeft: '4px' }}>
              Cashier & Settlement Views
            </div>
            <div className="merchant-drawer-nav-list">
              {NAV_ITEMS.map((item) => {
                const isActive = active === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    className={`merchant-drawer-nav-item ${isActive ? 'active' : ''}`}
                    onClick={() => {
                      setActive(item.key);
                      setMobileNavOpen(false);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                  >
                    <div className="merchant-drawer-nav-item__icon">
                      {item.icon}
                    </div>
                    <div className="merchant-drawer-nav-item__text">
                      <div className="merchant-drawer-nav-item__title">{item.label}</div>
                      <div className="merchant-drawer-nav-item__desc">{item.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Divider */}
          <div style={{ height: '1px', background: 'var(--fp-border)' }} />

          {/* Sign Out Action in Drawer */}
          <div>
            <button
              type="button"
              onClick={handleLogout}
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: '10px',
                background: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                color: 'var(--fp-danger)',
                fontWeight: 600,
                fontSize: '0.88rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                justifyContent: 'center',
                minHeight: '44px',
              }}
            >
              <SignOut size={18} />
              <span>Sign Out of POS</span>
            </button>
          </div>
        </div>
      </Drawer>

      {/* Navigation (Sidebar on desktop, horizontal scrollable pills on mobile) */}
      <nav className="merchant-nav">
        <div className="sidebar__brand desktop-only">
          <FlexPayLogo variant="compact" size={28} onClick={() => navigate('/')} style={{ cursor: 'pointer' }} />
        </div>
        <div className="merchant-nav__list">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`sidebar__item fp-touch-target ${active === item.key ? 'active' : ''}`}
              onClick={() => setActive(item.key)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </button>
          ))}
        </div>

        <div className="sidebar__footer desktop-only">
          <button
            type="button"
            className="sidebar__item"
            style={{ color: 'var(--text-muted, #64748B)' }}
            onClick={handleLogout}
          >
            <span>🚪</span>
            <span>Sign Out</span>
          </button>
        </div>
      </nav>

      <main className="merchant-main">
        {active === 'overview' && (
          <MerchantDashboard
            onNavigateToPos={() => setActive('pos')}
            onNavigateToSettlements={() => setActive('settlements')}
          />
        )}
        {active === 'settlements' && <MerchantSettlements />}
        {active === 'organizations' && <MerchantOrgs />}
        {active === 'employees' && <MerchantEmployees />}
        {active === 'transactions' && <MerchantTransactions />}
        {active === 'pos' && <MerchantPOS />}
        {active === 'analytics' && <MerchantAnalytics />}
      </main>
    </div>
  );
}

export default MerchantLayout;
