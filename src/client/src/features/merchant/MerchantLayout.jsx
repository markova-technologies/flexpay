import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  List,
  CaretDown,
  CreditCard,
  SignOut,
  ChartBar,
  Coins,
  Buildings,
  Users,
  Receipt,
  QrCode,
  TrendUp,
  Storefront,
  CheckCircle,
  User,
} from '@phosphor-icons/react';
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
  { key: 'overview',       label: 'Overview',       Icon: ChartBar,   desc: 'Receivables, settlements & metrics' },
  { key: 'settlements',    label: 'Settlements',    Icon: Coins,      desc: 'Employer wires & M-PESA receipts' },
  { key: 'organizations',  label: 'Organizations',  Icon: Buildings,  desc: 'Corporate employer partners' },
  { key: 'employees',      label: 'Employees',      Icon: Users,      desc: 'Enrolled employee credit accounts' },
  { key: 'transactions',   label: 'Transactions',   Icon: Receipt,    desc: 'Audit log of in-store checkouts' },
  { key: 'pos',            label: 'POS Scanner',    Icon: QrCode,     desc: 'Camera QR scanner & manual FP-ID' },
  { key: 'analytics',      label: 'Analytics',      Icon: TrendUp,    desc: 'Sales breakdown & top categories' },
];

export function MerchantLayout() {
  const [active, setActive] = useState('overview');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [merchantInfo, setMerchantInfo] = useState(null);

  const session = useAuthStore((s) => (s.getSessionForPortal ? s.getSessionForPortal('MERCHANT') : null));
  const user = session?.user || useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const navigate = useNavigate();

  useEffect(() => {
    let isMounted = true;
    api
      .get('/merchant/dashboard')
      .then((res) => {
        if (isMounted && res.data?.merchant) {
          setMerchantInfo(res.data.merchant);
        }
      })
      .catch((err) => {
        console.debug('[MerchantLayout] Profile fetch deferred/cached:', err?.message);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {}
    clearAuth('MERCHANT');
    navigate('/auth');
  };

  const currentItem = NAV_ITEMS.find((item) => item.key === active) || NAV_ITEMS[0];

  const businessName =
    merchantInfo?.businessName ||
    user?.businessName ||
    user?.merchantName ||
    user?.name ||
    'Friendship Supermarket';

  const category =
    merchantInfo?.category ||
    user?.category ||
    'GROCERY';

  const mpesaNumber =
    merchantInfo?.mpesaNumber ||
    user?.mpesaNumber ||
    user?.tillNumber ||
    user?.safaricomShortcode ||
    '174379';

  const terminalId =
    user?.terminalId ||
    (merchantInfo?.id ? `POS-${String(merchantInfo.id).slice(0, 6).toUpperCase()}` : 'POS-TILL-01');

  const cashierName =
    user?.fullName ||
    user?.name ||
    user?.ownerFullName ||
    'Station Cashier';

  return (
    <div className="merchant-layout">
      {/* Mobile Top Header */}
      <header className="merchant-mobile-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
          <FlexPayLogo variant="mark" size={30} onClick={() => navigate('/')} style={{ cursor: 'pointer', flexShrink: 0 }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--fp-text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {businessName}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--fp-text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              Till: {mpesaNumber} • {category}
            </div>
          </div>
        </div>
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
          <span className="nav-icon-badge">
            <currentItem.Icon size={16} weight="bold" />
          </span>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '12px',
                  background: 'var(--fp-orange-dim, rgba(255, 77, 38, 0.12))',
                  border: '1px solid var(--fp-orange-border, rgba(255, 77, 38, 0.28))',
                  color: 'var(--fp-orange, #FF4D26)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Storefront size={22} weight="fill" />
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--fp-text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {businessName}
                </div>
                <div style={{ fontSize: '0.74rem', color: 'var(--fp-text-muted)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ color: 'var(--fp-orange, #FF4D26)', fontWeight: 700 }}>Till: {mpesaNumber}</span>
                  <span>•</span>
                  <span>{category}</span>
                </div>
                <div style={{ fontSize: '0.7rem', color: '#059669', fontWeight: 600, marginTop: '3px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <CheckCircle size={12} weight="fill" />
                  <span>Certified Merchant Partner</span>
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
                      <item.Icon size={20} weight={isActive ? 'fill' : 'bold'} />
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
              <SignOut size={18} weight="bold" />
              <span>Sign Out of POS</span>
            </button>
          </div>
        </div>
      </Drawer>

      {/* Navigation (Sidebar on desktop) */}
      <nav className="merchant-nav">
        <div className="sidebar__brand desktop-only">
          <FlexPayLogo variant="compact" size={28} onClick={() => navigate('/')} style={{ cursor: 'pointer' }} />
        </div>

        <div className="merchant-nav__list">
          {NAV_ITEMS.map((item) => {
            const isActive = active === item.key;
            return (
              <button
                key={item.key}
                type="button"
                className={`sidebar__item fp-touch-target ${isActive ? 'active' : ''}`}
                onClick={() => setActive(item.key)}
              >
                <span className="nav-icon-badge">
                  <item.Icon size={18} weight={isActive ? 'fill' : 'bold'} />
                </span>
                <span className="nav-label">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Main Content Area with Sticky Desktop Header */}
      <div className="merchant-content-area">
        <header className="merchant-desktop-header desktop-only">
          <div className="merchant-header-profile">
            <div className="merchant-header-avatar">
              <Storefront size={24} weight="fill" />
            </div>
            <div className="merchant-header-titles">
              <div className="merchant-header-name-row">
                <h1 className="merchant-header-title">{businessName}</h1>
                <span className="merchant-badge-certified">
                  <CheckCircle size={14} weight="fill" />
                  <span>Certified Merchant</span>
                </span>
                <span className="merchant-badge-category">{category}</span>
              </div>
              <div className="merchant-header-subtitle">
                <span>M-PESA Till: <strong className="mono">{mpesaNumber}</strong></span>
                <span className="merchant-header-sep">•</span>
                <span>Terminal ID: <span className="mono">{terminalId}</span></span>
                <span className="merchant-header-sep">•</span>
                <span>EWA Cashless Partner</span>
              </div>
            </div>
          </div>

          <div className="merchant-header-actions">
            <div className="merchant-header-user-badge">
              <div className="merchant-header-user-avatar">
                <User size={15} weight="bold" />
              </div>
              <div className="merchant-header-user-text">
                <div className="merchant-header-user-name">{cashierName}</div>
                <div className="merchant-header-user-role">POS Cashier • Online</div>
              </div>
            </div>

            <button
              type="button"
              className="merchant-header-pos-btn fp-touch-target"
              onClick={() => setActive('pos')}
              aria-label="Open POS Terminal"
            >
              <CreditCard size={16} weight="bold" />
              <span>Open POS Scanner</span>
            </button>

            <button
              type="button"
              className="merchant-header-signout-btn fp-touch-target"
              onClick={handleLogout}
              aria-label="Sign Out"
            >
              <SignOut size={16} weight="bold" />
              <span>Sign Out</span>
            </button>
          </div>
        </header>

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
    </div>
  );
}

export default MerchantLayout;
