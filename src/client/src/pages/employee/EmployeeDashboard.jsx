import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Wallet,
  Sparkle,
  ArrowUpRight,
  Receipt,
  Storefront,
  ShieldCheck,
  CheckCircle,
  ClockCounterClockwise,
  CreditCard,
} from '@phosphor-icons/react';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { api } from '../../api/client.js';
import BenefitWalletCard from '../../components/BenefitWalletCard.jsx';
import StatusBadge from '../../components/ui/StatusBadge.jsx';
import Button from '../../components/ui/Button.jsx';
import { formatETB, formatDate } from '../../utils/format.js';
import './EmployeeDashboard.css';

export default function EmployeeDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const employeeId = user?.entityId || 'emp-001';

  const [employee, setEmployee] = useState(null);
  const [walletsData, setWalletsData] = useState(null);
  const [account, setAccount] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function loadData() {
      try {
        setLoading(true);
        const [emp, wData, acct, txs] = await Promise.all([
          api.getEmployee(employeeId).catch(() => null),
          api.getBenefitWallets(employeeId).catch(() => null),
          api.getBenefitAccount(employeeId).catch(() => null),
          api.getTransactions({ employeeId }).catch(() => ({ transactions: [] })),
        ]);

        if (!mounted) return;
        setEmployee(emp || { name: user?.name || 'Abebe Kebede', employerName: 'Ethio Telecom' });
        setWalletsData(wData);
        setAccount(acct);
        setTransactions(txs.transactions || []);
      } catch (err) {
        console.error('Failed to load employee dashboard:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadData();
    return () => {
      mounted = false;
    };
  }, [employeeId, user]);

  if (loading) {
    return (
      <div className="emp-dashboard" style={{ padding: '24px 0' }}>
        <div style={{
          height: '140px',
          background: 'var(--fp-surface-2)',
          borderRadius: 'var(--fp-r-xl)',
          animation: 'pulse 1.5s infinite',
        }} />
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '16px',
          marginTop: '16px',
        }}>
          <div style={{ height: '160px', background: 'var(--fp-surface-1)', borderRadius: 'var(--fp-r-lg)' }} />
          <div style={{ height: '160px', background: 'var(--fp-surface-1)', borderRadius: 'var(--fp-r-lg)' }} />
          <div style={{ height: '160px', background: 'var(--fp-surface-1)', borderRadius: 'var(--fp-r-lg)' }} />
        </div>
      </div>
    );
  }

  const wallets = walletsData?.wallets || [
    { category: 'FOOD', monthlyLimitETB: 2000, usedETB: 500, availableETB: 1500, utilizationRate: 25 },
    { category: 'TRANSPORT', monthlyLimitETB: 800, usedETB: 500, availableETB: 300, utilizationRate: 63 },
    { category: 'HEALTH', monthlyLimitETB: 500, usedETB: 0, availableETB: 500, utilizationRate: 0 },
  ];

  const payLater = walletsData?.payLater || {
    limitETB: account?.salaryLinkLimitETB || 2000,
    usedETB: account?.usedSalaryLinkETB || 500,
    availableETB: account?.availableSalaryLinkETB || 1500,
    nextRepaymentDate: '2026-10-31',
  };

  const totalBenefitAvailable = wallets.reduce((acc, w) => acc + (w.availableETB || 0), 0);

  return (
    <div className="emp-dashboard fp-page-enter">
      {/* Hero Welcome Card */}
      <div className="emp-hero-card">
        <div className="emp-hero-meta">
          <div className="emp-hero-badge">
            <CheckCircle size={14} weight="fill" />
            <span>Active Corporate Allocation &middot; {employee?.employerName}</span>
          </div>
          <h1 className="emp-hero-title">Good morning, {employee?.name?.split(' ')[0]} 👋</h1>
          <p className="emp-hero-sub">
            You have <strong style={{ color: 'var(--fp-benefit)' }}>{totalBenefitAvailable.toLocaleString()} ETB</strong> in active category allowances + <strong style={{ color: 'var(--fp-salary)' }}>{payLater.availableETB.toLocaleString()} ETB</strong> FlexPay PayLater power.
          </p>
        </div>

        <div className="emp-hero-actions">
          <Button
            id="btn-new-purchase"
            variant="primary"
            icon={ArrowUpRight}
            onClick={() => navigate('/checkout')}
          >
            Pay at Merchant
          </Button>
          <Button
            variant="secondary"
            icon={Receipt}
            onClick={() => navigate('/transactions')}
          >
            Transactions
          </Button>
        </div>
      </div>

      {/* Category-Locked Benefit Wallets (Scene 2 from Demo Script) */}
      <div>
        <div className="emp-section-header">
          <h2 className="emp-section-title">
            <Wallet size={20} weight="fill" color="var(--fp-benefit)" />
            <span>Category-Locked Benefit Wallets</span>
          </h2>
          <span style={{ fontSize: '0.8125rem', color: 'var(--fp-text-muted)' }}>
            Reset date: Oct 31, 2026
          </span>
        </div>

        <div className="emp-wallets-grid">
          {wallets.map((w) => (
            <BenefitWalletCard
              key={w.category}
              category={w.category}
              monthlyLimitETB={w.monthlyLimitETB}
              usedETB={w.usedETB}
              availableETB={w.availableETB}
              utilizationRate={w.utilizationRate}
              cycleResetDate={w.cycleResetDate}
            />
          ))}
        </div>
      </div>

      {/* Salary-Linked PayLater Credit Card */}
      <div className="emp-credit-bar-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: 'var(--fp-r-md)',
            background: 'var(--fp-cat-paylater-dim)',
            color: 'var(--fp-cat-paylater)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <CreditCard size={22} weight="fill" />
          </div>
          <div className="emp-credit-info">
            <span className="emp-credit-label">Salary-Linked PayLater Power</span>
            <div className="emp-credit-amount fp-tabular-nums">
              {payLater.availableETB.toLocaleString('en-US', { minimumFractionDigits: 2 })} ETB
              <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--fp-text-muted)', marginLeft: '6px' }}>
                available of {payLater.limitETB.toLocaleString()} ETB limit
              </span>
            </div>
            <span className="emp-credit-sub">
              Automatically synchronized with your monthly payroll &middot; Next deduction: {payLater.nextRepaymentDate}
            </span>
          </div>
        </div>

        <Button
          variant="outline"
          onClick={() => navigate('/repayment')}
        >
          View Repayment Plan
        </Button>
      </div>

      {/* Recent Activity Table */}
      <div>
        <div className="emp-section-header">
          <h2 className="emp-section-title">
            <ClockCounterClockwise size={20} weight="fill" color="var(--fp-text-secondary)" />
            <span>Recent Purchase Activity</span>
          </h2>
          <Button
            variant="ghost"
            onClick={() => navigate('/transactions')}
          >
            View All ({transactions.length})
          </Button>
        </div>

        <div className="emp-tx-card">
          <table className="emp-tx-table">
            <thead>
              <tr>
                <th>Merchant</th>
                <th>Category</th>
                <th>Total Order</th>
                <th>FlexPay Split</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '32px', color: 'var(--fp-text-muted)' }}>
                    No recent transactions found. Tap "Pay at Merchant" to begin.
                  </td>
                </tr>
              ) : (
                transactions.slice(0, 4).map((tx) => (
                  <tr
                    key={tx.paymentId || tx.id}
                    onClick={() => navigate(`/transactions/${tx.paymentId || tx.id}`)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td>
                      <div className="emp-tx-merchant">{tx.merchantName || 'Merchant'}</div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--fp-text-muted)' }}>
                        {tx.mpesaReceiptNumber ? `Receipt: ${tx.mpesaReceiptNumber}` : 'Direct Benefit'}
                      </span>
                    </td>
                    <td>
                      <span className="fp-badge">{tx.merchantCategory || 'MEAL'}</span>
                    </td>
                    <td className="fp-tabular-nums" style={{ fontWeight: 600, color: 'var(--fp-text-primary)' }}>
                      {formatETB(tx.totalETB)}
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{ color: 'var(--fp-benefit)', fontSize: '0.8125rem', fontWeight: 600 }}>
                          +{formatETB(tx.benefitETB)} Benefit
                        </span>
                        {tx.mpesaETB > 0 && (
                          <span style={{ color: 'var(--fp-salary)', fontSize: '0.75rem' }}>
                            {formatETB(tx.mpesaETB)} PayLater / Co-Pay
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <StatusBadge status={tx.status} />
                    </td>
                    <td style={{ fontSize: '0.75rem' }}>
                      {formatDate(tx.createdAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
