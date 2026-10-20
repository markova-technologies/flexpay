import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Buildings,
  Users,
  CreditCard,
  CurrencyDollar,
  Key,
  SignOut,
  UserPlus,
  MagnifyingGlass,
  CheckCircle,
  PencilSimple,
  ArrowsClockwise,
  List,
  CaretDown,
  CaretRight
} from '@phosphor-icons/react';
import api from '../../services/api';
import { useAuthStore } from '../../stores/authStore';
import { useToast } from '../../contexts/ToastContext';
import { Drawer } from '../../components/ui/Drawer';
import { FlexPayLogo } from '../../components/ui/FlexPayLogo';
import AddEmployeeForm from './AddEmployeeForm';
import PasswordDisplay from './PasswordDisplay';
import PasswordResetRequests from './PasswordResetRequests';
import PayrollPreview from './PayrollPreview';
import './OrgDashboard.css';

function KPICardSkeleton() {
  return (
    <div
      style={{
        background: 'var(--fp-surface-1)',
        border: '1px solid var(--fp-border)',
        borderRadius: '16px',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        boxShadow: 'var(--fp-shadow-sm)',
      }}
    >
      <div className="fp-skeleton" style={{ width: '45%', height: '14px' }} />
      <div className="fp-skeleton" style={{ width: '65%', height: '34px', borderRadius: '8px' }} />
      <div className="fp-skeleton" style={{ width: '55%', height: '12px' }} />
    </div>
  );
}

function TableSkeleton({ rows = 5 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          style={{
            display: 'grid',
            gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1fr 1fr 80px',
            gap: '16px',
            alignItems: 'center',
            padding: '14px',
            borderBottom: '1px solid var(--fp-border-subtle)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="fp-skeleton" style={{ width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0 }} />
            <div className="fp-skeleton" style={{ width: '120px', height: '16px' }} />
          </div>
          <div className="fp-skeleton" style={{ width: '130px', height: '16px' }} />
          <div className="fp-skeleton" style={{ width: '80px', height: '16px' }} />
          <div className="fp-skeleton" style={{ width: '90px', height: '16px' }} />
          <div className="fp-skeleton" style={{ width: '70px', height: '16px' }} />
          <div className="fp-skeleton" style={{ width: '70px', height: '16px' }} />
          <div className="fp-skeleton" style={{ width: '64px', height: '28px', borderRadius: '6px', justifySelf: 'end' }} />
        </div>
      ))}
    </div>
  );
}

export default function OrgDashboard() {
  const navigate = useNavigate();
  const toast = useToast();
  const { user, clearAuth } = useAuthStore();

  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'employees' | 'resets' | 'payroll'
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [stats, setStats] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [passwordModalData, setPasswordModalData] = useState(null); // { employeeName, fpId, plainPassword }

  // Credit limit edit modal
  const [editingEmp, setEditingEmp] = useState(null);
  const [newCreditLimit, setNewCreditLimit] = useState(10000);

  const fetchOrgData = async () => {
    setLoading(true);
    try {
      const [dashRes, empRes] = await Promise.all([
        api.get('/org/dashboard').catch(() => ({ data: {} })),
        api.get('/org/employees').catch(() => ({ data: { employees: [] } })),
      ]);
      setStats(dashRes.data);
      setEmployees(empRes.data.employees || []);
    } catch (err) {
      console.error('Failed to load org data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrgData();
  }, []);

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {}
    clearAuth();
    navigate('/auth');
  };

  const handleEmployeeCreated = (employee, plainPassword) => {
    setShowAddModal(false);
    setPasswordModalData({
      employeeName: employee.fullName || employee.full_name,
      fpEmployeeId: employee.fpEmployeeId || employee.fp_employee_id,
      plainPassword,
    });
    fetchOrgData();
  };

  const handlePasswordApproved = (employeeName, fpId, plainPassword) => {
    setPasswordModalData({
      employeeName,
      fpEmployeeId: fpId,
      plainPassword,
    });
    fetchOrgData();
  };

  const handleUpdateCreditLimit = async (e) => {
    e.preventDefault();
    if (!editingEmp) return;
    try {
      const empId = editingEmp.fp_employee_id || editingEmp.fpEmployeeId;
      await api.patch(`/org/employees/${empId}/credit`, {
        creditLimit: Number(newCreditLimit),
        newCreditLimit: Number(newCreditLimit),
      });
      setEditingEmp(null);
      toast.success('Credit allowance updated successfully.');
      await fetchOrgData();
    } catch (err) {
      toast.error(err.response?.data?.message || err.response?.data?.error || 'Failed to update credit limit.');
    }
  };

  const filteredEmployees = employees.filter((emp) => {
    const q = searchQuery.toLowerCase();
    const name = (emp.full_name || emp.fullName || '').toLowerCase();
    const fpId = (emp.fp_employee_id || emp.fpEmployeeId || '').toLowerCase();
    const phone = (emp.phone_number || emp.phoneNumber || '').toLowerCase();
    return name.includes(q) || fpId.includes(q) || phone.includes(q);
  });

  const totalAllocated = Number(stats?.totalAllocatedCredit ?? stats?.stats?.totalCreditExtended ?? 0);
  const totalSpent = Number(stats?.totalSpentCredit ?? stats?.stats?.totalCreditUtilized ?? 0);
  const utilizationPct = stats?.utilizationPercentage ?? stats?.stats?.utilizationPercentage ?? 
    (totalAllocated > 0 ? Math.round((totalSpent / totalAllocated) * 100) : 0);
  const pendingSettlement = Number(stats?.pendingSettlementAmount ?? stats?.stats?.pendingSettlementAmount ?? totalSpent);
  const pendingResetCount = Number(stats?.stats?.pendingPasswordResets ?? stats?.pendingPasswordResets ?? 0);

  const TABS = [
    {
      id: 'overview',
      label: 'Overview & Analytics',
      shortLabel: 'Overview',
      icon: <Buildings size={18} />,
      desc: 'Live credit limits & workforce snapshot',
    },
    {
      id: 'employees',
      label: 'Staff & Allowances',
      shortLabel: 'Staff',
      icon: <Users size={18} />,
      desc: 'Manage roster, salary allowances & FP-IDs',
      badge: loading && employees.length === 0 ? null : employees.length,
    },
    {
      id: 'resets',
      label: 'Password Reset Queue',
      shortLabel: 'Resets',
      icon: <Key size={18} />,
      desc: 'Employee verification & credential approvals',
      badge: pendingResetCount > 0 ? pendingResetCount : null,
      badgeColor: 'var(--fp-salary)',
    },
    {
      id: 'payroll',
      label: 'Automated Payroll & Wires',
      shortLabel: 'Payroll',
      icon: <CurrencyDollar size={18} />,
      desc: 'Month-end salary settlement & merchant wires',
    },
  ];

  const currentTabObj = TABS.find((t) => t.id === activeTab) || TABS[0];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--fp-bg)', color: 'var(--fp-text-primary)' }}>
      {/* Top Header */}
      <header className="org-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
          <FlexPayLogo variant="mark" size={36} onClick={() => navigate('/')} style={{ cursor: 'pointer', flexShrink: 0 }} />
          <div style={{ minWidth: 0 }}>
            <h1 style={{ fontSize: 'clamp(0.95rem, 3vw, 1.15rem)', fontWeight: 800, margin: 0, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {stats?.organization?.name || stats?.org?.name || user?.orgName || user?.organizationName || 'Corporate Admin'}
            </h1>
            <span style={{ fontSize: '0.72rem', color: 'var(--fp-text-muted)', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              Org Management • {user?.role || 'ORG_ADMIN'}
            </span>
          </div>
        </div>

        {/* Desktop Header Actions */}
        <div className="org-header-desktop-actions">
          {loading && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 12px',
                borderRadius: '20px',
                background: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.25)',
                color: 'var(--fp-benefit)',
                fontSize: '0.78rem',
                fontWeight: 600,
              }}
            >
              <div
                style={{
                  width: '7px',
                  height: '7px',
                  borderRadius: '50%',
                  background: 'var(--fp-benefit)',
                  animation: 'fp-pulse 1.4s infinite',
                }}
              />
              <span>Syncing...</span>
            </div>
          )}

          <button
            onClick={fetchOrgData}
            disabled={loading}
            title="Refresh ledger state"
            className="fp-touch-target"
            style={{
              background: 'var(--fp-surface-2)',
              border: '1px solid var(--fp-border)',
              borderRadius: '8px',
              padding: '8px 12px',
              color: 'var(--fp-text-secondary)',
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.85rem',
              minHeight: 'var(--fp-touch-min)',
            }}
          >
            <ArrowsClockwise size={16} className={loading ? 'spin' : ''} />
            <span>Sync</span>
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="fp-touch-target"
            style={{
              padding: '9px 16px',
              borderRadius: '8px',
              background: 'var(--fp-orange, #FF4D26)',
              color: '#FFFFFF',
              fontWeight: 700,
              fontSize: '0.85rem',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              minHeight: 'var(--fp-touch-min)',
              boxShadow: '0 2px 12px var(--fp-orange-glow, rgba(255, 77, 38, 0.25))',
            }}
          >
            <UserPlus size={18} weight="bold" />
            <span>Add Staff</span>
          </button>

          <button
            onClick={handleLogout}
            className="fp-touch-target"
            style={{
              background: 'var(--fp-surface-2)',
              border: '1px solid var(--fp-border)',
              borderRadius: '8px',
              padding: '8px 12px',
              color: 'var(--fp-text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.85rem',
              minHeight: 'var(--fp-touch-min)',
            }}
          >
            <SignOut size={16} />
            <span>Exit</span>
          </button>
        </div>

        {/* Mobile Header Actions: Sync icon, + Staff quick action, Menu toggle */}
        <div className="org-header-mobile-actions">
          <button
            onClick={fetchOrgData}
            disabled={loading}
            title="Sync Ledger"
            aria-label="Sync ledger data"
            className="fp-touch-target"
            style={{
              background: 'var(--fp-surface-2)',
              border: '1px solid var(--fp-border)',
              borderRadius: '8px',
              padding: '8px',
              color: 'var(--fp-text-secondary)',
              minHeight: '44px',
              minWidth: '44px',
              cursor: 'pointer',
            }}
          >
            <ArrowsClockwise size={18} className={loading ? 'spin' : ''} />
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            aria-label="Add Staff Member"
            className="fp-touch-target"
            style={{
              background: 'var(--fp-benefit)',
              color: '#060A14',
              border: 'none',
              borderRadius: '8px',
              padding: '8px 12px',
              fontWeight: 700,
              fontSize: '0.82rem',
              minHeight: '44px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              cursor: 'pointer',
            }}
          >
            <UserPlus size={16} weight="bold" />
            <span>+ Staff</span>
          </button>

          <button
            type="button"
            className="org-menu-btn"
            onClick={() => setMobileNavOpen(true)}
            aria-label="Open Navigation Menu"
            aria-expanded={mobileNavOpen}
          >
            <List size={20} weight="bold" />
            <span>Menu</span>
            {pendingResetCount > 0 && <span className="org-menu-badge" title="Pending password resets" />}
          </button>
        </div>
      </header>

      {/* Desktop Horizontal Tabs */}
      <nav className="org-tabs-desktop" aria-label="Organization Dashboard Tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`org-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
          >
            {tab.icon}
            <span>{tab.label}</span>
            {tab.badge !== null && tab.badge !== undefined && (
              <span
                className="org-tab-badge"
                style={tab.badgeColor ? { background: 'rgba(245, 158, 11, 0.15)', color: tab.badgeColor } : undefined}
              >
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </nav>

      {/* Mobile Active Section Sub-Bar */}
      <div className="org-mobile-subbar">
        <div className="org-mobile-subbar__current">
          {currentTabObj.icon}
          <span>{currentTabObj.label}</span>
        </div>
        <button
          type="button"
          className="org-mobile-subbar__btn"
          onClick={() => setMobileNavOpen(true)}
          aria-label="Switch dashboard section"
        >
          <span>Switch</span>
          <CaretDown size={12} weight="bold" />
        </button>
      </div>

      {/* Mobile Navigation Drawer */}
      <Drawer
        open={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
        title="Organization Menu"
        width="min(88vw, 360px)"
        side="right"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Org Profile Header Card */}
          <div
            style={{
              background: 'var(--fp-surface-2)',
              border: '1px solid var(--fp-border)',
              borderRadius: '14px',
              padding: '16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <FlexPayLogo variant="mark" size={32} style={{ flexShrink: 0 }} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--fp-text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {stats?.organization?.name || stats?.org?.name || user?.orgName || 'Corporate Admin'}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--fp-benefit)', fontWeight: 600 }}>
                  {user?.role || 'ORG_ADMIN'} • Active Employer
                </div>
              </div>
            </div>
          </div>

          {/* Nav Items */}
          <div>
            <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fp-text-muted)', fontWeight: 700, marginBottom: '8px', paddingLeft: '4px' }}>
              Dashboard Portals
            </div>
            <div className="org-drawer-nav-list">
              {TABS.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    className={`org-drawer-nav-item ${isActive ? 'active' : ''}`}
                    onClick={() => {
                      setActiveTab(tab.id);
                      setMobileNavOpen(false);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                  >
                    <div className="org-drawer-nav-item__icon">
                      {tab.icon}
                    </div>
                    <div className="org-drawer-nav-item__text">
                      <div className="org-drawer-nav-item__title">{tab.label}</div>
                      <div className="org-drawer-nav-item__desc">{tab.desc}</div>
                    </div>
                    {tab.badge !== null && tab.badge !== undefined && (
                      <span
                        className="org-tab-badge"
                        style={tab.badgeColor ? { background: 'rgba(245, 158, 11, 0.2)', color: tab.badgeColor } : undefined}
                      >
                        {tab.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Divider */}
          <div style={{ height: '1px', background: 'var(--fp-border)' }} />

          {/* Quick Actions in Drawer */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fp-text-muted)', fontWeight: 700, paddingLeft: '4px' }}>
              Quick Actions
            </div>

            <button
              type="button"
              onClick={() => {
                setMobileNavOpen(false);
                setShowAddModal(true);
              }}
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: '10px',
                background: 'var(--fp-benefit)',
                color: '#060A14',
                fontWeight: 700,
                fontSize: '0.88rem',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                justifyContent: 'center',
                minHeight: '46px',
              }}
            >
              <UserPlus size={18} weight="bold" />
              <span>Add New Employee</span>
            </button>

            <button
              type="button"
              onClick={() => {
                fetchOrgData();
                setMobileNavOpen(false);
              }}
              style={{
                width: '100%',
                padding: '11px 14px',
                borderRadius: '10px',
                background: 'var(--fp-surface-2)',
                border: '1px solid var(--fp-border)',
                color: 'var(--fp-text-primary)',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                justifyContent: 'center',
                minHeight: '44px',
              }}
            >
              <ArrowsClockwise size={16} className={loading ? 'spin' : ''} />
              <span>Sync Ledger State</span>
            </button>

            <button
              type="button"
              onClick={handleLogout}
              style={{
                width: '100%',
                padding: '11px 14px',
                borderRadius: '10px',
                background: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                color: 'var(--fp-danger)',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                justifyContent: 'center',
                minHeight: '44px',
                marginTop: '8px',
              }}
            >
              <SignOut size={16} />
              <span>Sign Out / Exit</span>
            </button>
          </div>
        </div>
      </Drawer>

      {/* Main Tab Views */}
      <main style={{ maxWidth: '1240px', margin: '0 auto', padding: 'clamp(16px, 3.5vw, 36px) clamp(14px, 3vw, 24px)' }}>
        {activeTab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
            {/* KPI Cards / Shimmer Skeletons */}
            {loading && !stats ? (
              <div className="org-kpi-grid">
                <KPICardSkeleton />
                <KPICardSkeleton />
                <KPICardSkeleton />
                <KPICardSkeleton />
              </div>
            ) : (
              <div className="org-kpi-grid fp-page-enter">
                <div className="org-kpi-card">
                  <span className="org-kpi-label">Total Allocated</span>
                  <div className="org-kpi-value mono">
                    ETB {Number(totalAllocated).toLocaleString()}
                  </div>
                  <span className="org-kpi-sub">
                    Across {employees.length} enrolled staff
                  </span>
                </div>

                <div className="org-kpi-card">
                  <span className="org-kpi-label">Credit Spent</span>
                  <div className="org-kpi-value mono" style={{ color: 'var(--fp-salary)' }}>
                    ETB {Number(totalSpent).toLocaleString()}
                  </div>
                  <span className="org-kpi-sub">
                    {utilizationPct}% company utilization
                  </span>
                </div>

                <div className="org-kpi-card">
                  <span className="org-kpi-label">Pending Payables</span>
                  <div className="org-kpi-value mono" style={{ color: 'var(--fp-benefit)' }}>
                    ETB {Number(pendingSettlement).toLocaleString()}
                  </div>
                  <span className="org-kpi-sub">
                    To be wired at month-end
                  </span>
                </div>

                <div className="org-kpi-card">
                  <span className="org-kpi-label">Active Workforce</span>
                  <div className="org-kpi-value mono">
                    {employees.length}
                  </div>
                  <span className="org-kpi-sub" style={{ color: 'var(--fp-benefit)' }}>
                    100% Luhn-verified FP-IDs
                  </span>
                </div>
              </div>
            )}

            {/* Quick Actions & Recent Summary */}
            <div
              style={{
                background: 'var(--fp-surface-1)',
                border: '1px solid var(--fp-border)',
                borderRadius: '20px',
                padding: '28px',
              }}
            >
              <h3 style={{ fontSize: '1.15rem', marginBottom: '16px' }}>Quick Actions</h3>
              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                <button
                  onClick={() => setShowAddModal(true)}
                  style={{
                    padding: '12px 20px',
                    borderRadius: '8px',
                    background: 'var(--fp-benefit)',
                    color: '#060A14',
                    fontWeight: 700,
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <UserPlus size={18} weight="bold" />
                  Add New Employee
                </button>
                <button
                  onClick={() => setActiveTab('resets')}
                  style={{
                    padding: '12px 20px',
                    borderRadius: '8px',
                    background: 'var(--fp-surface-2)',
                    border: '1px solid var(--fp-border)',
                    color: 'var(--fp-text-primary)',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <Key size={18} />
                  Review Password Reset Queue
                </button>
                <button
                  onClick={() => setActiveTab('payroll')}
                  style={{
                    padding: '12px 20px',
                    borderRadius: '8px',
                    background: 'var(--fp-surface-2)',
                    border: '1px solid var(--fp-border)',
                    color: 'var(--fp-text-primary)',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <CurrencyDollar size={18} />
                  Preview Automated Payroll Wires
                </button>
              </div>
            </div>

            {/* Overview Workforce Preview */}
            <div
              style={{
                background: 'var(--fp-surface-1)',
                border: '1px solid var(--fp-border)',
                borderRadius: '20px',
                padding: '28px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>Workforce Allocation Snapshot</h3>
                  <p style={{ color: 'var(--fp-text-secondary)', fontSize: '0.85rem', marginTop: '4px' }}>
                    Live status of enrolled employee benefits and credit lines.
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab('employees')}
                  style={{
                    background: 'transparent',
                    border: '1px solid var(--fp-border)',
                    borderRadius: '8px',
                    padding: '8px 14px',
                    color: 'var(--fp-benefit)',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                  }}
                >
                  View All Staff →
                </button>
              </div>

              {loading && employees.length === 0 ? (
                <TableSkeleton rows={4} />
              ) : employees.length === 0 ? (
                <p style={{ textAlign: 'center', padding: '32px', color: 'var(--fp-text-muted)' }}>
                  No employees onboarded yet. Click "Add Employee" to issue your first credit allowance.
                </p>
              ) : (
                <>
                  {/* Desktop Table View */}
                  <div className="org-staff-table-desktop fp-table-responsive">
                    <table style={{ width: '100%', minWidth: '600px', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--fp-border)', color: 'var(--fp-text-muted)', textAlign: 'left' }}>
                          <th style={{ padding: '12px 14px' }}>Employee</th>
                          <th style={{ padding: '12px 14px' }}>FP-ID</th>
                          <th style={{ padding: '12px 14px' }}>Credit Limit</th>
                          <th style={{ padding: '12px 14px' }}>Available Balance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {employees.slice(0, 5).map((emp) => (
                          <tr key={emp.id} style={{ borderBottom: '1px solid var(--fp-border-subtle)' }}>
                            <td style={{ padding: '14px', fontWeight: 600 }}>{emp.full_name || emp.fullName}</td>
                            <td className="mono" style={{ padding: '14px', color: 'var(--fp-benefit)' }}>
                              {emp.fp_employee_id || emp.fpEmployeeId}
                            </td>
                            <td className="mono" style={{ padding: '14px', fontWeight: 700 }}>
                              ETB {Number(emp.credit_limit || emp.creditLimit).toLocaleString()}
                            </td>
                            <td className="mono" style={{ padding: '14px', color: 'var(--fp-benefit)' }}>
                              ETB {Number(emp.available_credit ?? emp.availableCredit).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Staff Cards View */}
                  <div className="org-staff-cards-mobile">
                    {employees.slice(0, 5).map((emp) => (
                      <div key={emp.id} className="org-staff-card">
                        <div className="org-staff-card__header">
                          <div>
                            <div className="org-staff-card__name">{emp.full_name || emp.fullName}</div>
                            <div className="org-staff-card__dept">{emp.department || 'Staff Member'}</div>
                          </div>
                          <span style={{ fontSize: '0.72rem', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--fp-benefit)', padding: '3px 8px', borderRadius: '6px', fontWeight: 700 }}>
                            ACTIVE
                          </span>
                        </div>
                        <div className="org-staff-card__fpid">
                          {emp.fp_employee_id || emp.fpEmployeeId}
                        </div>
                        <div className="org-staff-card__metrics">
                          <div>
                            <div className="org-staff-card__metric-label">Credit Limit</div>
                            <div className="org-staff-card__metric-val">ETB {Number(emp.credit_limit || emp.creditLimit).toLocaleString()}</div>
                          </div>
                          <div>
                            <div className="org-staff-card__metric-label">Available</div>
                            <div className="org-staff-card__metric-val" style={{ color: 'var(--fp-benefit)' }}>
                              ETB {Number(emp.available_credit ?? emp.availableCredit).toLocaleString()}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {activeTab === 'employees' && (
          <div
            style={{
              background: 'var(--fp-surface-1)',
              border: '1px solid var(--fp-border)',
              borderRadius: '20px',
              padding: 'clamp(16px, 3.5vw, 28px)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '24px',
                flexWrap: 'wrap',
                gap: '16px',
              }}
            >
              <div style={{ position: 'relative', width: '100%', maxWidth: '380px' }}>
                <MagnifyingGlass size={18} color="var(--fp-text-muted)" style={{ position: 'absolute', left: '12px', top: '13px' }} />
                <input
                  type="text"
                  placeholder="Search staff by name, FP-ID or phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '11px 14px 11px 38px',
                    borderRadius: '8px',
                    background: 'var(--fp-surface-2)',
                    border: '1px solid var(--fp-border)',
                    color: 'var(--fp-text-primary)',
                    fontSize: '1rem',
                    minHeight: 'var(--fp-touch-min)',
                  }}
                />
              </div>

              <button
                onClick={() => setShowAddModal(true)}
                className="fp-touch-target"
                style={{
                  padding: '10px 18px',
                  borderRadius: '8px',
                  background: 'var(--fp-benefit)',
                  color: '#060A14',
                  fontWeight: 700,
                  fontSize: '0.875rem',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  minHeight: 'var(--fp-touch-min)',
                }}
              >
                <UserPlus size={18} weight="bold" />
                Add Employee
              </button>
            </div>

            {loading && employees.length === 0 ? (
              <TableSkeleton rows={6} />
            ) : filteredEmployees.length === 0 ? (
              <p style={{ textAlign: 'center', padding: '40px', color: 'var(--fp-text-muted)' }}>
                No employees matching criteria. Click "Add Employee" to onboard your staff.
              </p>
            ) : (
              <>
                {/* Desktop Table View */}
                <div className="org-staff-table-desktop fp-table-responsive">
                  <table style={{ width: '100%', minWidth: '760px', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--fp-border)', color: 'var(--fp-text-muted)', textAlign: 'left' }}>
                        <th style={{ padding: '12px 14px' }}>Employee</th>
                        <th style={{ padding: '12px 14px' }}>FP-ID</th>
                        <th style={{ padding: '12px 14px' }}>Department</th>
                        <th style={{ padding: '12px 14px' }}>Safaricom Phone</th>
                        <th style={{ padding: '12px 14px' }}>Credit Limit</th>
                        <th style={{ padding: '12px 14px' }}>Available</th>
                        <th style={{ padding: '12px 14px', textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredEmployees.map((emp) => (
                        <tr key={emp.id} style={{ borderBottom: '1px solid var(--fp-border-subtle)' }}>
                          <td style={{ padding: '14px', fontWeight: 600 }}>
                            {emp.full_name || emp.fullName}
                          </td>
                          <td className="mono" style={{ padding: '14px', color: 'var(--fp-benefit)' }}>
                            {emp.fp_employee_id || emp.fpEmployeeId}
                          </td>
                          <td style={{ padding: '14px', color: 'var(--fp-text-secondary)' }}>
                            {emp.department || 'General'}
                          </td>
                          <td className="mono" style={{ padding: '14px' }}>
                            {emp.phone_number || emp.phoneNumber}
                          </td>
                          <td className="mono" style={{ padding: '14px', fontWeight: 700 }}>
                            ETB {Number(emp.credit_limit || emp.creditLimit).toLocaleString()}
                          </td>
                          <td className="mono" style={{ padding: '14px', color: 'var(--fp-benefit)' }}>
                            ETB {Number(emp.available_credit ?? emp.availableCredit).toLocaleString()}
                          </td>
                          <td style={{ padding: '14px', textAlign: 'right' }}>
                            <button
                              onClick={() => {
                                setEditingEmp(emp);
                                setNewCreditLimit(emp.credit_limit || emp.creditLimit);
                              }}
                              style={{
                                background: 'var(--fp-surface-2)',
                                border: '1px solid var(--fp-border)',
                                borderRadius: '6px',
                                padding: '6px 10px',
                                color: 'var(--fp-text-primary)',
                                fontSize: '0.8rem',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                              }}
                            >
                              <PencilSimple size={14} />
                              Limit
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Staff Cards View */}
                <div className="org-staff-cards-mobile">
                  {filteredEmployees.map((emp) => (
                    <div key={emp.id} className="org-staff-card">
                      <div className="org-staff-card__header">
                        <div>
                          <div className="org-staff-card__name">{emp.full_name || emp.fullName}</div>
                          <div className="org-staff-card__dept">{emp.department || 'General'} • {emp.phone_number || emp.phoneNumber}</div>
                        </div>
                        <span style={{ fontSize: '0.72rem', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--fp-benefit)', padding: '3px 8px', borderRadius: '6px', fontWeight: 700 }}>
                          ACTIVE
                        </span>
                      </div>
                      <div className="org-staff-card__fpid">
                        {emp.fp_employee_id || emp.fpEmployeeId}
                      </div>
                      <div className="org-staff-card__metrics">
                        <div>
                          <div className="org-staff-card__metric-label">Credit Limit</div>
                          <div className="org-staff-card__metric-val">ETB {Number(emp.credit_limit || emp.creditLimit).toLocaleString()}</div>
                        </div>
                        <div>
                          <div className="org-staff-card__metric-label">Available</div>
                          <div className="org-staff-card__metric-val" style={{ color: 'var(--fp-benefit)' }}>
                            ETB {Number(emp.available_credit ?? emp.availableCredit).toLocaleString()}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingEmp(emp);
                          setNewCreditLimit(emp.credit_limit || emp.creditLimit);
                        }}
                        className="fp-touch-target"
                        style={{
                          width: '100%',
                          padding: '10px 14px',
                          background: 'var(--fp-surface-3)',
                          border: '1px solid var(--fp-border)',
                          borderRadius: '8px',
                          color: 'var(--fp-text-primary)',
                          fontSize: '0.85rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          minHeight: '44px',
                        }}
                      >
                        <PencilSimple size={15} />
                        <span>Adjust Credit Allowance</span>
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'resets' && (
          <PasswordResetRequests onPasswordGenerated={handlePasswordApproved} />
        )}

        {activeTab === 'payroll' && (
          <PayrollPreview />
        )}
      </main>

      {/* Add Employee Modal */}
      {showAddModal && (
        <AddEmployeeForm
          onClose={() => setShowAddModal(false)}
          onCreated={handleEmployeeCreated}
        />
      )}

      {/* One-Time Password Display Modal */}
      {passwordModalData && (
        <PasswordDisplay
          employeeName={passwordModalData.employeeName}
          fpEmployeeId={passwordModalData.fpEmployeeId}
          plainPassword={passwordModalData.plainPassword}
          onClose={() => setPasswordModalData(null)}
        />
      )}

      {/* Edit Credit Limit Modal */}
      {editingEmp && (
        <div
          className="fp-modal-overlay"
          onClick={() => setEditingEmp(null)}
          style={{ zIndex: 150 }}
        >
          <div
            className="fp-modal"
            style={{ maxWidth: '420px', width: '100%' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="fp-sheet-handle" />
            <h3 style={{ fontSize: '1.2rem', marginBottom: '8px' }}>Adjust Monthly Credit Limit</h3>
            <p style={{ color: 'var(--fp-text-secondary)', fontSize: '0.85rem', marginBottom: '20px' }}>
              Employee: <strong>{editingEmp.full_name || editingEmp.fullName}</strong> (
              {editingEmp.fp_employee_id || editingEmp.fpEmployeeId})
            </p>

            <form onSubmit={handleUpdateCreditLimit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--fp-text-secondary)', marginBottom: '6px' }}>
                  New Credit Limit (ETB)
                </label>
                <input
                  type="number"
                  min="500"
                  step="100"
                  required
                  inputMode="decimal"
                  value={newCreditLimit}
                  onChange={(e) => setNewCreditLimit(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    minHeight: 'var(--fp-touch-min)',
                    borderRadius: '8px',
                    background: 'var(--fp-surface-2)',
                    border: '1px solid var(--fp-border)',
                    color: 'var(--fp-text-primary)',
                    fontFamily: 'var(--fp-font-mono)',
                    fontSize: '1rem',
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="submit"
                  className="fp-touch-target"
                  style={{
                    flex: 1,
                    padding: '12px',
                    minHeight: 'var(--fp-touch-min)',
                    borderRadius: '8px',
                    background: 'var(--fp-benefit)',
                    color: '#060A14',
                    fontWeight: 700,
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  Save Limit
                </button>
                <button
                  type="button"
                  onClick={() => setEditingEmp(null)}
                  className="fp-touch-target"
                  style={{
                    padding: '12px 16px',
                    minHeight: 'var(--fp-touch-min)',
                    borderRadius: '8px',
                    background: 'transparent',
                    border: '1px solid var(--fp-border)',
                    color: 'var(--fp-text-secondary)',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
