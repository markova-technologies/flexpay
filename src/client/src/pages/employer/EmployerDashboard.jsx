import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Buildings,
  SlidersHorizontal,
  UsersThree,
  ChartBar,
  ShieldCheck,
  CheckCircle,
  FloppyDisk,
  WarningCircle,
  CurrencyCircleDollar,
} from '@phosphor-icons/react';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { api } from '../../api/client.js';
import { useToast } from '../../contexts/ToastContext.jsx';
import Button from '../../components/ui/Button.jsx';
import { formatETB } from '../../utils/format.js';
import './EmployerPortal.css';

export default function EmployerDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { push: toast } = useToast();
  const orgId = user?.entityId || 'org-001';

  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'policies' | 'roster' | 'analytics'
  const [org, setOrg] = useState(null);
  const [policies, setPolicies] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savingPolicyId, setSavingPolicyId] = useState(null);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [orgRes, polRes, empRes, anaRes] = await Promise.all([
          api.getEmployerOrg(orgId).catch(() => null),
          api.getEmployerPolicies(orgId).catch(() => ({ policies: [] })),
          api.getEmployerEmployees(orgId).catch(() => ({ employees: [] })),
          api.getEmployerAnalytics(orgId).catch(() => null),
        ]);

        setOrg(orgRes?.org || { name: 'Ethio Telecom', benefitPoolETB: 500000, usedPoolETB: 145000, availablePoolETB: 355000, utilizationRate: 29 });
        setPolicies(polRes.policies || []);
        setEmployees(empRes.employees || []);
        setAnalytics(anaRes?.analytics || null);
      } catch (err) {
        console.error('Failed to load employer portal data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [orgId]);

  async function handlePolicyLimitChange(policyId, newLimit) {
    setPolicies((prev) =>
      prev.map((p) => (p.id === policyId ? { ...p, monthlyLimitETB: Number(newLimit) || 0 } : p))
    );
  }

  async function savePolicy(policy) {
    setSavingPolicyId(policy.id);
    try {
      await api.updateEmployerPolicy(policy.id, {
        monthlyLimitETB: policy.monthlyLimitETB,
        eligibleMerchantCategories: policy.eligibleMerchantCategories,
        isActive: policy.isActive,
      });
      toast({ message: `Saved ${policy.category} policy: ${policy.monthlyLimitETB} ETB/month`, type: 'success' });
    } catch (err) {
      toast({ message: err.message || 'Failed to update policy', type: 'error' });
    } finally {
      setSavingPolicyId(null);
    }
  }

  if (loading) {
    return (
      <div className="empr-container" style={{ padding: '24px 0' }}>
        <div style={{ height: '140px', background: 'var(--fp-surface-2)', borderRadius: 'var(--fp-r-xl)' }} />
        <div style={{ height: '300px', background: 'var(--fp-surface-1)', borderRadius: 'var(--fp-r-lg)', marginTop: '20px' }} />
      </div>
    );
  }

  return (
    <div className="empr-container fp-page-enter">
      {/* Header Banner */}
      <div className="empr-header-card">
        <div>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 10px',
            borderRadius: 'var(--fp-r-pill)',
            background: 'rgba(16, 185, 129, 0.12)',
            color: 'var(--fp-benefit)',
            fontSize: '0.75rem',
            fontWeight: 600,
            marginBottom: '8px',
          }}>
            <Buildings size={14} weight="fill" />
            <span>Corporate Benefit Admin &middot; {org?.name}</span>
          </div>
          <h1 className="empr-title">{org?.name} Benefits Management</h1>
          <p className="empr-sub">
            Configure category quotas, monitor employee utilization, and reconcile payroll-linked settlements.
          </p>
        </div>

        <div style={{ textAlign: 'right' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--fp-text-muted)', textTransform: 'uppercase' }}>
            Funded Benefit Pool
          </span>
          <div className="fp-tabular-nums" style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--fp-text-primary)' }}>
            {formatETB(org?.availablePoolETB)}
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--fp-benefit)' }}>
            of {formatETB(org?.benefitPoolETB)} Total Pool
          </span>
        </div>
      </div>

      {/* Top 4 Stats */}
      <div className="empr-stats-row">
        <div className="empr-stat-box">
          <span className="empr-stat-label">Total Allocated Pool</span>
          <div className="empr-stat-value fp-tabular-nums">{formatETB(org?.benefitPoolETB)}</div>
          <span className="empr-stat-sub">Annual funded corporate reserve</span>
        </div>

        <div className="empr-stat-box">
          <span className="empr-stat-label">Month-to-Date Spend</span>
          <div className="empr-stat-value fp-tabular-nums" style={{ color: 'var(--fp-benefit)' }}>
            {formatETB(org?.usedPoolETB)}
          </div>
          <span className="empr-stat-sub">{org?.utilizationRate}% of monthly budget spent</span>
        </div>

        <div className="empr-stat-box">
          <span className="empr-stat-label">Enrolled Employees</span>
          <div className="empr-stat-value fp-tabular-nums">{employees.length} Active</div>
          <span className="empr-stat-sub">100% KYC verified with Fayda IDs</span>
        </div>

        <div className="empr-stat-box">
          <span className="empr-stat-label">Next Payroll Cycle</span>
          <div className="empr-stat-value">Oct 31, 2026</div>
          <span className="empr-stat-sub">Automatic salary deduction sync</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="empr-nav-tabs">
        <button
          className={`empr-tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          <Buildings size={18} />
          <span>Overview</span>
        </button>
        <button
          className={`empr-tab-btn ${activeTab === 'policies' ? 'active' : ''}`}
          onClick={() => setActiveTab('policies')}
        >
          <SlidersHorizontal size={18} />
          <span>Benefit Policies (Scene 1)</span>
        </button>
        <button
          className={`empr-tab-btn ${activeTab === 'roster' ? 'active' : ''}`}
          onClick={() => setActiveTab('roster')}
        >
          <UsersThree size={18} />
          <span>Employee Roster</span>
        </button>
        <button
          className={`empr-tab-btn ${activeTab === 'analytics' ? 'active' : ''}`}
          onClick={() => setActiveTab('analytics')}
        >
          <ChartBar size={18} />
          <span>Spend Analytics</span>
        </button>
      </div>

      {/* Tab 1: Overview */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="empr-card">
            <div className="empr-card-header">
              <span className="empr-card-title">Live Category Quotas & Limits</span>
              <Button variant="ghost" onClick={() => setActiveTab('policies')}>
                Edit Policies &rarr;
              </Button>
            </div>
            <table className="empr-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Monthly Employee Cap</th>
                  <th>Eligible Merchant Categories</th>
                  <th>Network Status</th>
                </tr>
              </thead>
              <tbody>
                {policies.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>{p.category === 'FOOD' ? '🍽️' : p.category === 'TRANSPORT' ? '🚌' : '🏥'}</span>
                        <strong style={{ color: 'var(--fp-text-primary)' }}>{p.category}</strong>
                      </div>
                    </td>
                    <td className="fp-tabular-nums" style={{ fontWeight: 600 }}>
                      {formatETB(p.monthlyLimitETB)} / employee / mo
                    </td>
                    <td>
                      {p.eligibleMerchantCategories.map((c) => (
                        <span key={c} className="empr-category-tag" style={{ background: 'var(--fp-surface-3)', color: 'var(--fp-text-secondary)' }}>
                          {c}
                        </span>
                      ))}
                    </td>
                    <td>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        background: 'rgba(16, 185, 129, 0.1)',
                        color: 'var(--fp-benefit)',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                      }}>
                        <CheckCircle size={12} weight="fill" />
                        ACTIVE
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Benefit Policies (Scene 1 in Hackathon Pitch) */}
      {activeTab === 'policies' && (
        <div className="empr-card fp-page-enter">
          <div className="empr-card-header">
            <div>
              <span className="empr-card-title">Configure Benefit Budget Rules</span>
              <p style={{ fontSize: '0.75rem', color: 'var(--fp-text-muted)', marginTop: '2px' }}>
                Defined limits are enforced server-side. Employees cannot spend outside authorized categories.
              </p>
            </div>
          </div>

          <table className="empr-table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Monthly Allowance Cap (ETB)</th>
                <th>Permitted Merchant Types</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {policies.map((p) => (
                <tr key={p.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span>{p.category === 'FOOD' ? '🍽️' : p.category === 'TRANSPORT' ? '🚌' : '🏥'}</span>
                      <strong style={{ color: 'var(--fp-text-primary)' }}>{p.category}</strong>
                    </div>
                  </td>
                  <td>
                    <input
                      type="number"
                      className="empr-input-limit fp-tabular-nums"
                      value={p.monthlyLimitETB}
                      onChange={(e) => handlePolicyLimitChange(p.id, e.target.value)}
                      step="50"
                      min="100"
                    />
                    <span style={{ marginLeft: '6px', fontSize: '0.75rem', color: 'var(--fp-text-muted)' }}>ETB</span>
                  </td>
                  <td>
                    {p.eligibleMerchantCategories.map((c) => (
                      <span key={c} className="empr-category-tag" style={{ background: 'var(--fp-surface-2)', color: 'var(--fp-text-primary)' }}>
                        {c}
                      </span>
                    ))}
                  </td>
                  <td>
                    <span style={{ color: 'var(--fp-benefit)', fontSize: '0.75rem', fontWeight: 600 }}>
                      Enforced
                    </span>
                  </td>
                  <td>
                    <Button
                      variant="primary"
                      icon={FloppyDisk}
                      onClick={() => savePolicy(p)}
                      disabled={savingPolicyId === p.id}
                    >
                      {savingPolicyId === p.id ? 'Saving...' : 'Apply'}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 3: Employee Roster */}
      {activeTab === 'roster' && (
        <div className="empr-card fp-page-enter">
          <div className="empr-card-header">
            <span className="empr-card-title">Employee Enrolled Roster & Category Usage</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--fp-text-muted)' }}>
              {employees.length} Employees Active
            </span>
          </div>

          <table className="empr-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Food Spend</th>
                <th>Transport Spend</th>
                <th>Health Spend</th>
                <th>PayLater Outstanding</th>
                <th>Total Corporate Impact</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((emp) => (
                <tr key={emp.id}>
                  <td>
                    <strong style={{ color: 'var(--fp-text-primary)' }}>{emp.name}</strong>
                    <div style={{ fontSize: '0.75rem', color: 'var(--fp-text-muted)' }}>
                      +{emp.phone} &middot; ID: {emp.id}
                    </div>
                  </td>
                  <td>
                    <div className="fp-tabular-nums" style={{ fontWeight: 600, color: 'var(--fp-cat-food)' }}>
                      {formatETB(emp.food.used)}
                    </div>
                    <span style={{ fontSize: '0.6875rem', color: 'var(--fp-text-muted)' }}>
                      of {formatETB(emp.food.limit)} cap
                    </span>
                  </td>
                  <td>
                    <div className="fp-tabular-nums" style={{ fontWeight: 600, color: 'var(--fp-cat-transport)' }}>
                      {formatETB(emp.transport.used)}
                    </div>
                    <span style={{ fontSize: '0.6875rem', color: 'var(--fp-text-muted)' }}>
                      of {formatETB(emp.transport.limit)} cap
                    </span>
                  </td>
                  <td>
                    <div className="fp-tabular-nums" style={{ fontWeight: 600, color: 'var(--fp-cat-health)' }}>
                      {formatETB(emp.health.used)}
                    </div>
                    <span style={{ fontSize: '0.6875rem', color: 'var(--fp-text-muted)' }}>
                      of {formatETB(emp.health.limit)} cap
                    </span>
                  </td>
                  <td>
                    <div className="fp-tabular-nums" style={{ fontWeight: 600, color: 'var(--fp-salary)' }}>
                      {formatETB(emp.payLater.used)}
                    </div>
                    <span style={{ fontSize: '0.6875rem', color: 'var(--fp-text-muted)' }}>
                      Deduction on Oct 31
                    </span>
                  </td>
                  <td className="fp-tabular-nums" style={{ fontWeight: 700, color: 'var(--fp-text-primary)' }}>
                    {formatETB(emp.totalSpendETB)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 4: Spend Analytics */}
      {activeTab === 'analytics' && (
        <div className="empr-card fp-page-enter">
          <div className="empr-card-header">
            <span className="empr-card-title">Corporate Spend by Category</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--fp-text-muted)' }}>Period: October 2026</span>
          </div>

          <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {analytics?.categoryBreakdown?.map((item) => (
              <div key={item.category} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                  <strong style={{ color: 'var(--fp-text-primary)' }}>
                    {item.category === 'FOOD' ? '🍽️ Food & Meals' : item.category === 'TRANSPORT' ? '🚌 Transport' : '🏥 Health & Medical'}
                  </strong>
                  <span className="fp-tabular-nums">
                    <strong>{formatETB(item.usedETB)}</strong> spent of {formatETB(item.budgetETB)} ({item.utilizationRate}%)
                  </span>
                </div>
                <div style={{ width: '100%', height: '8px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '999px', overflow: 'hidden' }}>
                  <div style={{
                    width: `${Math.min(100, item.utilizationRate)}%`,
                    height: '100%',
                    background: item.category === 'FOOD' ? 'var(--fp-cat-food)' : item.category === 'TRANSPORT' ? 'var(--fp-cat-transport)' : 'var(--fp-cat-health)',
                    borderRadius: '999px',
                  }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
