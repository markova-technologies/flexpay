import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import api from '../../services/api';
import MerchantDashboard from './MerchantDashboard';
import MerchantOrgs from './MerchantOrgs';
import MerchantEmployees from './MerchantEmployees';
import MerchantTransactions from './MerchantTransactions';
import MerchantPOS from './pos/MerchantPOS';
import MerchantAnalytics from './MerchantAnalytics';
import './MerchantLayout.css';

const NAV_ITEMS = [
  { key: 'overview',       label: 'Overview',       icon: '📊' },
  { key: 'organizations',  label: 'Organizations',  icon: '🏢' },
  { key: 'employees',      label: 'Employees',      icon: '👥' },
  { key: 'transactions',   label: 'Transactions',   icon: '📋' },
  { key: 'pos',            label: 'POS',            icon: '💳' },
  { key: 'analytics',      label: 'Analytics',      icon: '📈' },
];

export function MerchantLayout() {
  const [active, setActive] = useState('overview');
  const { user, clearAuth } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {}
    clearAuth();
    navigate('/auth');
  };

  return (
    <div className="merchant-layout">
      <nav className="merchant-sidebar">
        <div className="sidebar__brand">
          FlexPay <span>Merchant</span>
        </div>
        {NAV_ITEMS.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`sidebar__item ${active === item.key ? 'active' : ''}`}
            onClick={() => setActive(item.key)}
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}

        <div className="sidebar__footer">
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
        {active === 'overview' && <MerchantDashboard onNavigateToPos={() => setActive('pos')} />}
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
