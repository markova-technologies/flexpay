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
  ArrowsClockwise
} from '@phosphor-icons/react';
import api from '../../services/api';
import { useAuthStore } from '../../stores/authStore';
import AddEmployeeForm from './AddEmployeeForm';
import PasswordDisplay from './PasswordDisplay';
import PasswordResetRequests from './PasswordResetRequests';
import PayrollPreview from './PayrollPreview';

export default function OrgDashboard() {
  const navigate = useNavigate();
  const { user, clearAuth } = useAuthStore();

  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'employees' | 'resets' | 'payroll'
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
      await api.patch(`/org/employees/${editingEmp.fp_employee_id || editingEmp.fpEmployeeId}/credit`, {
        newCreditLimit: Number(newCreditLimit),
      });
      setEditingEmp(null);
      await fetchOrgData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update credit limit.');
    }
  };

  const filteredEmployees = employees.filter((emp) => {
    const q = searchQuery.toLowerCase();
    const name = (emp.full_name || emp.fullName || '').toLowerCase();
    const fpId = (emp.fp_employee_id || emp.fpEmployeeId || '').toLowerCase();
    const phone = (emp.phone_number || emp.phoneNumber || '').toLowerCase();
    return name.includes(q) || fpId.includes(q) || phone.includes(q);
  });

  return (
    <div style={{ minHeight: '100vh', background: 'var(--fp-bg)', color: 'var(--fp-text-primary)' }}>
      {/* Navbar */}
      <header
        style={{
          borderBottom: '1px solid var(--fp-border)',
          background: 'var(--fp-surface-1)',
          padding: '16px 28px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'var(--fp-benefit)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              color: '#060A14',
            }}
          >
            F
          </div>
          <div>
            <h1 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0 }}>
              {stats?.organization?.name || user?.organizationName || 'Corporate Admin'}
            </h1>
            <span style={{ fontSize: '0.75rem', color: 'var(--fp-text-muted)' }}>
              Organization Management Portal • Role: {user?.role || 'ORG_ADMIN'}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button
            onClick={() => setShowAddModal(true)}
            style={{
              padding: '9px 16px',
              borderRadius: '8px',
              background: 'var(--fp-benefit)',
              color: '#060A14',
              fontWeight: 700,
              fontSize: '0.85rem',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <UserPlus size={18} weight="bold" />
            Add Employee
          </button>
          <button
            onClick={handleLogout}
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
            }}
          >
            <SignOut size={16} />
            Sign Out
          </button>
        </div>
      </header>

      {/* Tabs Bar */}
      <div
        style={{
          borderBottom: '1px solid var(--fp-border)',
          background: 'var(--fp-surface-1)',
          padding: '0 28px',
          display: 'flex',
          gap: '32px',
        }}
      >
        {[
          { id: 'overview', label: 'Overview & Analytics', icon: <Buildings size={18} /> },
          { id: 'employees', label: `Staff & Allowances (${employees.length})`, icon: <Users size={18} /> },
          { id: 'resets', label: 'Password Reset Queue', icon: <Key size={18} /> },
          { id: 'payroll', label: 'Automated Payroll & Wires', icon: <CurrencyDollar size={18} /> },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '16px 0',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === tab.id ? '2px solid var(--fp-benefit)' : '2px solid transparent',
              color: activeTab === tab.id ? 'var(--fp-text-primary)' : 'var(--fp-text-muted)',
              fontWeight: activeTab === tab.id ? 700 : 500,
              fontSize: '0.9rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Main Tab Views */}
      <main style={{ maxWidth: '1240px', margin: '0 auto', padding: '36px 24px' }}>
        {activeTab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            {/* KPI Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px' }}>
              <div style={{ background: 'var(--fp-surface-1)', border: '1px solid var(--fp-border)', borderRadius: '16px', padding: '24px' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--fp-text-muted)' }}>Total Allocated Credit</span>
                <div className="mono" style={{ fontSize: '1.8rem', fontWeight: 800, marginTop: '6px' }}>
                  ETB {Number(stats?.totalAllocatedCredit || 0).toLocaleString()}
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--fp-text-secondary)', marginTop: '4px', display: 'block' }}>
                  Across {employees.length} enrolled staff members
                </span>
              </div>

              <div style={{ background: 'var(--fp-surface-1)', border: '1px solid var(--fp-border)', borderRadius: '16px', padding: '24px' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--fp-text-muted)' }}>Credit Spent This Cycle</span>
                <div className="mono" style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--fp-salary)', marginTop: '6px' }}>
                  ETB {Number(stats?.totalSpentCredit || 0).toLocaleString()}
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--fp-text-secondary)', marginTop: '4px', display: 'block' }}>
                  {stats?.utilizationPercentage || 0}% overall company utilization
                </span>
              </div>

              <div style={{ background: 'var(--fp-surface-1)', border: '1px solid var(--fp-border)', borderRadius: '16px', padding: '24px' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--fp-text-muted)' }}>Pending Merchant Payables</span>
                <div className="mono" style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--fp-benefit)', marginTop: '6px' }}>
                  ETB {Number(stats?.pendingSettlementAmount || 0).toLocaleString()}
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--fp-text-secondary)', marginTop: '4px', display: 'block' }}>
                  To be wired at month-end payroll
                </span>
              </div>

              <div style={{ background: 'var(--fp-surface-1)', border: '1px solid var(--fp-border)', borderRadius: '16px', padding: '24px' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--fp-text-muted)' }}>Active Workforce</span>
                <div className="mono" style={{ fontSize: '1.8rem', fontWeight: 800, marginTop: '6px' }}>
                  {employees.length}
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--fp-benefit)', marginTop: '4px', display: 'block' }}>
                  100% Luhn-verified FP-IDs
                </span>
              </div>
            </div>

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
          </div>
        )}

        {activeTab === 'employees' && (
          <div
            style={{
              background: 'var(--fp-surface-1)',
              border: '1px solid var(--fp-border)',
              borderRadius: '20px',
              padding: '28px',
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
              <div style={{ position: 'relative', width: '320px' }}>
                <MagnifyingGlass size={18} color="var(--fp-text-muted)" style={{ position: 'absolute', left: '12px', top: '11px' }} />
                <input
                  type="text"
                  placeholder="Search staff by name, FP-ID or phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px 10px 38px',
                    borderRadius: '8px',
                    background: 'var(--fp-surface-2)',
                    border: '1px solid var(--fp-border)',
                    color: 'var(--fp-text-primary)',
                    fontSize: '0.875rem',
                  }}
                />
              </div>

              <button
                onClick={() => setShowAddModal(true)}
                style={{
                  padding: '10px 18px',
                  borderRadius: '8px',
                  background: 'var(--fp-benefit)',
                  color: '#060A14',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <UserPlus size={18} weight="bold" />
                Add Employee
              </button>
            </div>

            {filteredEmployees.length === 0 ? (
              <p style={{ textAlign: 'center', padding: '40px', color: 'var(--fp-text-muted)' }}>
                No employees matching criteria. Click "Add Employee" to onboard your staff.
              </p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
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
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(6, 10, 20, 0.85)',
            backdropFilter: 'blur(8px)',
            zIndex: 150,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '420px',
              background: 'var(--fp-surface-1)',
              border: '1px solid var(--fp-border)',
              borderRadius: '20px',
              padding: '32px',
            }}
          >
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
                  value={newCreditLimit}
                  onChange={(e) => setNewCreditLimit(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    background: 'var(--fp-surface-2)',
                    border: '1px solid var(--fp-border)',
                    color: 'var(--fp-text-primary)',
                    fontFamily: 'var(--fp-font-mono)',
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="submit"
                  style={{
                    flex: 1,
                    padding: '10px',
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
                  style={{
                    padding: '10px 16px',
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
