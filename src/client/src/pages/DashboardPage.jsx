import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Wallet, Sparkle, ArrowUpRight, Receipt, Storefront, ShieldCheck
} from '@phosphor-icons/react';
import { api } from '../api/client.js';
import { formatETB, formatDate } from '../utils/format.js';
import StatCard from '../components/ui/StatCard.jsx';
import StatusBadge from '../components/ui/StatusBadge.jsx';
import Button from '../components/ui/Button.jsx';
import './DashboardPage.css';

export default function DashboardPage() {
  const navigate = useNavigate();
  const [employee, setEmployee] = useState(null);
  const [account, setAccount] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [emp, acct, txs] = await Promise.all([
          api.getEmployee('emp-001'),
          api.getBenefitAccount('emp-001'),
          api.getTransactions({ employeeId: 'emp-001' }),
        ]);
        setEmployee(emp);
        setAccount(acct);
        setTransactions(txs.transactions || []);
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="fp-page-enter dashboard-page">
        <div className="fp-skeleton" style={{ height: '36px', width: '280px', marginBottom: '24px' }} />
        <div className="dashboard-stats-grid">
          <div className="fp-skeleton" style={{ height: '120px' }} />
          <div className="fp-skeleton" style={{ height: '120px' }} />
          <div className="fp-skeleton" style={{ height: '120px' }} />
        </div>
      </div>
    );
  }

  return (
    <div className="fp-page-enter dashboard-page">
      {/* Top Banner / Welcome */}
      <div className="dashboard-welcome">
        <div>
          <h1>Welcome, {employee?.name}</h1>
          <p className="dashboard-welcome__sub">
            {employee?.employerName} Employee Benefit Account &middot; E.164 ID: <code className="mono">+{employee?.phone}</code>
          </p>
        </div>
        <div className="dashboard-welcome__actions">
          <Button
            id="btn-new-purchase"
            variant="primary"
            icon={ArrowUpRight}
            onClick={() => navigate('/checkout')}
          >
            Start Purchase
          </Button>
        </div>
      </div>

      {/* Financial Stat Cards */}
      <div className="dashboard-stats-grid">
        <StatCard
          label="Available Benefit Allowance"
          value={formatETB(account?.availableBalanceETB)}
          sub={`Used ${formatETB(account?.usedAllowanceETB)} of ${formatETB(account?.totalAllowanceETB)}`}
          icon={Wallet}
          accent="benefit"
        />
        <StatCard
          label="Available Salary-Link Limit"
          value={formatETB(account?.availableSalaryLinkETB)}
          sub={`Pre-authorized monthly deduction limit: ${formatETB(account?.salaryLinkLimitETB)}`}
          icon={Sparkle}
          accent="salary"
        />
        <StatCard
          label="Combined Purchasing Power"
          value={formatETB((account?.availableBalanceETB || 0) + (account?.availableSalaryLinkETB || 0))}
          sub="Instantly allocated at point-of-sale"
          icon={ShieldCheck}
          accent="success"
        />
      </div>

      {/* Two Column Layout: Recent Transactions + Eligibility Info */}
      <div className="dashboard-main-grid">
        {/* Left: Recent Transactions */}
        <div className="fp-card">
          <div className="fp-card__header">
            <div>
              <h3 className="fp-card__title">Recent Activity</h3>
              <p style={{ fontSize: '0.8125rem' }}>Purchases and split allocations</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/transactions')}
            >
              View All
            </Button>
          </div>

          {transactions.length === 0 ? (
            <div className="fp-empty">
              <Receipt className="fp-empty__icon" />
              <div className="fp-empty__title">No transactions yet</div>
              <div className="fp-empty__body">Your purchases will appear here after checkout.</div>
            </div>
          ) : (
            <div className="dashboard-tx-list">
              {transactions.slice(0, 4).map((tx) => (
                <div
                  key={tx.id}
                  className="dashboard-tx-item fp-pressable"
                  onClick={() => navigate(`/transactions/${tx.id}`)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && navigate(`/transactions/${tx.id}`)}
                >
                  <div className="dashboard-tx-item__left">
                    <div className="dashboard-tx-item__icon">
                      <Storefront size={18} />
                    </div>
                    <div>
                      <div className="dashboard-tx-item__name">{tx.merchantName}</div>
                      <div className="dashboard-tx-item__date">{formatDate(tx.createdAt)}</div>
                    </div>
                  </div>
                  <div className="dashboard-tx-item__right">
                    <div className="dashboard-tx-item__amount mono">{formatETB(tx.totalETB)}</div>
                    <StatusBadge status={tx.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: How FlexPay Co-Funding Works */}
        <div className="dashboard-sidebar-column">
          <div className="fp-card fp-card--elevated">
            <h3 className="fp-card__title" style={{ marginBottom: '12px' }}>
              How Benefits-First Split Works
            </h3>
            <div className="dashboard-info-step">
              <span className="dashboard-info-step__num">1</span>
              <div>
                <strong>Employer Covers First</strong>
                <p>Eligible grocery and meal categories are funded up to your available benefit allowance.</p>
              </div>
            </div>
            <div className="dashboard-info-step">
              <span className="dashboard-info-step__num">2</span>
              <div>
                <strong>Zero-Interest Salary Co-Pay</strong>
                <p>Remaining amounts up to your authorized limit are settled via instant M-PESA USSD push.</p>
              </div>
            </div>
            <div className="dashboard-info-step">
              <span className="dashboard-info-step__num">3</span>
              <div>
                <strong>Instant Merchant Settlement</strong>
                <p>The merchant receives guaranteed 100% full payout upon transaction confirmation.</p>
              </div>
            </div>

            <div className="dashboard-cta-banner">
              <div>
                <strong>Try the Demo Order</strong>
                <p>ETB 2,000 grocery basket at Yod Abyssinia Market</p>
              </div>
              <Button
                variant="primary"
                size="sm"
                onClick={() => navigate('/checkout')}
              >
                Checkout Now
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
