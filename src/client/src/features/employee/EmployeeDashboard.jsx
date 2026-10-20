import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User,
  SignOut,
  CreditCard,
  Receipt,
  ArrowsClockwise,
  CheckCircle,
  Clock,
  XCircle,
  ShoppingBag,
  ForkKnife,
  FirstAid,
  Bus,
  Lightning
} from '@phosphor-icons/react';
import api from '../../services/api';
import { useAuthStore } from '../../stores/authStore';
import { FlexPayLogo } from '../../components/ui/FlexPayLogo';
import CreditRing from './CreditRing';
import QRCodeCard from './QRCodeCard';

export default function EmployeeDashboard() {
  const navigate = useNavigate();
  const { user, clearAuth } = useAuthStore();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchDashboard = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/employee/dashboard');
      setData(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load employee dashboard data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {}
    clearAuth();
    navigate('/auth');
  };

  const getCategoryIcon = (cat) => {
    switch (cat) {
      case 'FOOD':
      case 'GROCERY':
        return <ForkKnife size={16} color="var(--fp-salary)" />;
      case 'PHARMACY':
      case 'HEALTH':
        return <FirstAid size={16} color="var(--fp-benefit)" />;
      case 'TRANSPORT':
        return <Bus size={16} color="#38BDF8" />;
      case 'UTILITIES':
        return <Lightning size={16} color="#A855F7" />;
      default:
        return <ShoppingBag size={16} color="var(--fp-text-muted)" />;
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--fp-bg)', color: 'var(--fp-text-primary)' }}>
      {/* Top Navbar */}
      <header
        style={{
          borderBottom: '1px solid var(--fp-border)',
          background: 'var(--fp-surface-1)',
          padding: 'clamp(12px, 3vw, 16px) clamp(16px, 4vw, 28px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          minHeight: 'var(--fp-header-h-mob)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <FlexPayLogo variant="mark" size={32} onClick={() => navigate('/')} style={{ cursor: 'pointer', flexShrink: 0 }} />
          <div>
            <h1 style={{ fontSize: 'clamp(1rem, 3vw, 1.15rem)', fontWeight: 800, margin: 0, lineHeight: 1.2 }}>FlexPay Wallet</h1>
            <span style={{ fontSize: '0.75rem', color: 'var(--fp-text-muted)' }}>
              {data?.employee?.organizationName || 'Corporate Partner'} • Employee Portal
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(10px, 3vw, 16px)' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.875rem', fontWeight: 700 }}>
              {data?.employee?.fullName || user?.fullName || 'Employee'}
            </div>
            <div className="mono" style={{ fontSize: '0.725rem', color: 'var(--fp-text-secondary)' }}>
              {data?.employee?.fpEmployeeId || user?.fpEmployeeId}
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="fp-touch-target"
            style={{
              background: 'var(--fp-surface-2)',
              border: '1px solid var(--fp-border)',
              borderRadius: '8px',
              padding: '8px 12px',
              minHeight: '40px',
              color: 'var(--fp-text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.85rem',
            }}
          >
            <SignOut size={16} />
            <span className="fp-hide-on-tiny">Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: 'clamp(20px, 4vw, 36px) clamp(14px, 4vw, 24px)', boxSizing: 'border-box' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--fp-text-muted)' }}>
            <ArrowsClockwise size={36} className="spin" style={{ marginBottom: '12px' }} />
            <p>Loading your live financial allowances...</p>
          </div>
        ) : error ? (
          <div style={{ padding: '24px', background: 'rgba(239, 68, 68, 0.1)', color: '#EF4444', borderRadius: '12px' }}>
            {error}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(20px, 4vw, 32px)' }}>
            {/* Top Row: Gauge & Balances */}
            {(() => {
              const emp = data?.employee || {};
              const creditLimit = Number(data?.creditLimit ?? emp.creditLimit ?? 0);
              const availableCredit = Number(data?.availableCredit ?? emp.availableCredit ?? 0);
              const spentThisMonth = Number(data?.spentThisMonth ?? data?.spentCredit ?? emp.spentCredit ?? 0);
              const qrEmployee = {
                ...emp,
                fpEmployeeId: data?.fpEmployeeId || emp.fpEmployeeId || user?.fpEmployeeId,
                fullName: data?.fullName || emp.fullName || user?.fullName || 'Employee',
                organizationName: data?.organizationName || emp.organizationName || 'Corporate Partner',
              };

              return (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))',
                    gap: 'clamp(16px, 3vw, 24px)',
                    alignItems: 'stretch',
                  }}
                >
                  {/* Credit Ring Container */}
                  <div
                    style={{
                      background: 'var(--fp-surface-1)',
                      border: '1px solid var(--fp-border)',
                      borderRadius: '20px',
                      padding: 'clamp(20px, 4vw, 28px)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: 'var(--fp-shadow-md)',
                      boxSizing: 'border-box',
                    }}
                  >
                    <CreditRing
                      limit={creditLimit}
                      available={availableCredit}
                      spent={spentThisMonth}
                      size={200}
                    />
                  </div>

                  {/* Balance Summary Cards */}
                  <div style={{ display: 'grid', gridTemplateRows: 'repeat(3, 1fr)', gap: '14px' }}>
                    <div
                      style={{
                        background: 'var(--fp-surface-1)',
                        border: '1px solid var(--fp-border)',
                        borderRadius: '16px',
                        padding: 'clamp(14px, 3vw, 20px) clamp(16px, 3vw, 24px)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div>
                        <span style={{ fontSize: '0.8rem', color: 'var(--fp-text-muted)' }}>Monthly Credit Limit</span>
                        <div className="mono" style={{ fontSize: '1.4rem', fontWeight: 800 }}>
                          ETB {creditLimit.toLocaleString()}
                        </div>
                      </div>
                      <CreditCard size={32} color="var(--fp-text-secondary)" />
                    </div>

                    <div
                      style={{
                        background: 'rgba(16, 185, 129, 0.08)',
                        border: '1px solid rgba(16, 185, 129, 0.25)',
                        borderRadius: '16px',
                        padding: 'clamp(14px, 3vw, 20px) clamp(16px, 3vw, 24px)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div>
                        <span style={{ fontSize: '0.8rem', color: 'var(--fp-benefit)' }}>Available for Spend</span>
                        <div className="mono" style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--fp-benefit)' }}>
                          ETB {availableCredit.toLocaleString()}
                        </div>
                      </div>
                      <CheckCircle size={32} color="var(--fp-benefit)" weight="fill" />
                    </div>

                    <div
                      style={{
                        background: 'var(--fp-surface-1)',
                        border: '1px solid var(--fp-border)',
                        borderRadius: '16px',
                        padding: 'clamp(14px, 3vw, 20px) clamp(16px, 3vw, 24px)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div>
                        <span style={{ fontSize: '0.8rem', color: 'var(--fp-text-muted)' }}>Spent This Cycle</span>
                        <div className="mono" style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--fp-salary)' }}>
                          ETB {spentThisMonth.toLocaleString()}
                        </div>
                      </div>
                      <Receipt size={32} color="var(--fp-salary)" />
                    </div>
                  </div>

                  {/* QR Card */}
                  <QRCodeCard employee={qrEmployee} />
                </div>
              );
            })()}

            {/* Category Spending Breakdown */}
            <div
              style={{
                background: 'var(--fp-surface-1)',
                border: '1px solid var(--fp-border)',
                borderRadius: '20px',
                padding: 'clamp(18px, 4vw, 28px)',
                boxSizing: 'border-box',
              }}
            >
              <h3 style={{ fontSize: '1.15rem', marginBottom: '20px' }}>Spending by Category</h3>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 140px), 1fr))',
                  gap: 'clamp(10px, 2.5vw, 16px)',
                }}
              >
                {Object.entries(data.spendingByCategory || {}).map(([cat, amount]) => (
                  <div
                    key={cat}
                    style={{
                      background: 'var(--fp-surface-2)',
                      border: '1px solid var(--fp-border)',
                      borderRadius: '12px',
                      padding: '14px 16px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      {getCategoryIcon(cat)}
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--fp-text-secondary)' }}>
                        {cat}
                      </span>
                    </div>
                    <div className="mono" style={{ fontSize: '1.15rem', fontWeight: 700 }}>
                      ETB {Number(amount).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Purchases List */}
            <div
              style={{
                background: 'var(--fp-surface-1)',
                border: '1px solid var(--fp-border)',
                borderRadius: '20px',
                padding: 'clamp(18px, 4vw, 28px)',
                boxSizing: 'border-box',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ fontSize: '1.15rem', margin: 0 }}>Recent Activity</h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--fp-text-muted)' }}>
                  {data.recentTransactions?.length || 0} transactions
                </span>
              </div>

              {(!data.recentTransactions || data.recentTransactions.length === 0) ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--fp-text-muted)', fontSize: '0.9rem' }}>
                  No transactions recorded yet this cycle. Scan your QR code at a certified merchant to begin!
                </div>
              ) : (
                <div className="fp-table-responsive" style={{ WebkitOverflowScrolling: 'touch' }}>
                  <table style={{ width: '100%', minWidth: '600px', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--fp-border)', color: 'var(--fp-text-muted)', textAlign: 'left' }}>
                        <th style={{ padding: '12px 14px' }}>Merchant</th>
                        <th style={{ padding: '12px 14px' }}>Category</th>
                        <th style={{ padding: '12px 14px' }}>Total</th>
                        <th style={{ padding: '12px 14px' }}>FlexPay Credit</th>
                        <th style={{ padding: '12px 14px' }}>M-PESA Co-Pay</th>
                        <th style={{ padding: '12px 14px' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.recentTransactions.map((tx) => (
                        <tr key={tx.id} style={{ borderBottom: '1px solid var(--fp-border-subtle)' }}>
                          <td style={{ padding: '12px 14px', fontWeight: 600 }}>
                            {tx.merchant_name_snapshot || 'Merchant'}
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                              {getCategoryIcon(tx.category_snapshot)}
                              {tx.category_snapshot || 'GENERAL'}
                            </span>
                          </td>
                          <td className="mono" style={{ padding: '12px 14px', fontWeight: 700 }}>
                            ETB {Number(tx.total_amount).toLocaleString()}
                          </td>
                          <td className="mono" style={{ padding: '12px 14px', color: 'var(--fp-benefit)' }}>
                            ETB {Number(tx.credit_portion).toLocaleString()}
                          </td>
                          <td className="mono" style={{ padding: '12px 14px', color: 'var(--fp-salary)' }}>
                            ETB {Number(tx.copay_portion).toLocaleString()}
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '3px 8px',
                                borderRadius: '4px',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                background:
                                  tx.status === 'COMPLETED'
                                    ? 'rgba(16, 185, 129, 0.15)'
                                    : tx.status === 'PENDING'
                                    ? 'rgba(245, 158, 11, 0.15)'
                                    : 'rgba(239, 68, 68, 0.15)',
                                color:
                                  tx.status === 'COMPLETED'
                                    ? 'var(--fp-benefit)'
                                    : tx.status === 'PENDING'
                                    ? 'var(--fp-salary)'
                                    : '#EF4444',
                              }}
                            >
                              {tx.status === 'COMPLETED' ? <CheckCircle size={14} /> : <Clock size={14} />}
                              {tx.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
