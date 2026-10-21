import React, { useState } from 'react';
import { UserPlus, X, CreditCard, Phone, Buildings, User } from '@phosphor-icons/react';
import api from '../../services/api';

export function AddEmployeeForm({ onClose, onCreated }) {
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('251');
  const [department, setDepartment] = useState('Operations');
  const [jobTitle, setJobTitle] = useState('');
  const [monthlySalary, setMonthlySalary] = useState('');
  const [creditLimit, setCreditLimit] = useState('');
  const [isLimitOverridden, setIsLimitOverridden] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSalaryChange = (val) => {
    setMonthlySalary(val);
    if (!isLimitOverridden) {
      setCreditLimit(val);
    }
  };

  const handleLimitChange = (val) => {
    setCreditLimit(val);
    setIsLimitOverridden(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const salaryNum = parseFloat(monthlySalary);
    if (isNaN(salaryNum) || salaryNum <= 0) {
      setError('Monthly Salary is required and must be greater than 0.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/org/employees', {
        fullName: fullName.trim(),
        phoneNumber: phoneNumber.trim(),
        department: department.trim(),
        jobTitle: jobTitle.trim() || undefined,
        monthlySalary: salaryNum,
        creditLimit: creditLimit ? parseFloat(creditLimit) : salaryNum,
        creditLimitOverride: creditLimit ? parseFloat(creditLimit) : salaryNum,
      });

      // Pass employee data and the one-time generated password to parent
      onCreated(res.data.employee, res.data.plainPassword);
    } catch (err) {
      const msg =
        err.response?.data?.details?.[0]?.message ||
        err.response?.data?.error ||
        err.response?.data?.message ||
        'Failed to onboard employee. Please verify details.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fp-modal-overlay"
      onClick={onClose}
    >
      <div
        className="fp-modal"
        style={{
          width: '100%',
          maxWidth: '500px',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="fp-sheet-handle" />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: 'rgba(16, 185, 129, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <UserPlus size={22} color="var(--fp-benefit)" weight="bold" />
            </div>
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>Add Employee to Plan</h3>
              <span style={{ fontSize: '0.8rem', color: 'var(--fp-text-muted)' }}>
                Generates Luhn FP-ID & 16-Char Credential
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="fp-touch-target"
            aria-label="Close dialog"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--fp-text-muted)',
              cursor: 'pointer',
              padding: '8px',
              minWidth: 'var(--fp-touch-min)',
              minHeight: 'var(--fp-touch-min)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {error && (
          <div
            style={{
              padding: '12px',
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              borderRadius: '8px',
              color: '#EF4444',
              fontSize: '0.85rem',
              marginBottom: '16px',
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.825rem', color: 'var(--fp-text-secondary)', marginBottom: '6px' }}>
              Employee Full Name
            </label>
            <div style={{ position: 'relative' }}>
              <User size={18} color="var(--fp-text-muted)" style={{ position: 'absolute', left: '12px', top: '13px' }} />
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Bethlehem Hailu"
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
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.825rem', color: 'var(--fp-text-secondary)', marginBottom: '6px' }}>
              Safaricom Phone Number (251...)
            </label>
            <div style={{ position: 'relative' }}>
              <Phone size={18} color="var(--fp-text-muted)" style={{ position: 'absolute', left: '12px', top: '13px' }} />
              <input
                type="text"
                required
                inputMode="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="251711223344"
                style={{
                  width: '100%',
                  padding: '11px 14px 11px 38px',
                  borderRadius: '8px',
                  background: 'var(--fp-surface-2)',
                  border: '1px solid var(--fp-border)',
                  color: 'var(--fp-text-primary)',
                  fontSize: '1rem',
                  fontFamily: 'var(--fp-font-mono)',
                  minHeight: 'var(--fp-touch-min)',
                }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.825rem', color: 'var(--fp-text-secondary)', marginBottom: '6px' }}>
                Department
              </label>
              <input
                type="text"
                required
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="Operations"
                style={{
                  width: '100%',
                  padding: '11px 14px',
                  borderRadius: '8px',
                  background: 'var(--fp-surface-2)',
                  border: '1px solid var(--fp-border)',
                  color: 'var(--fp-text-primary)',
                  fontSize: '1rem',
                  minHeight: 'var(--fp-touch-min)',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.825rem', color: 'var(--fp-text-secondary)', marginBottom: '6px' }}>
                Job Title
              </label>
              <input
                type="text"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                placeholder="Senior Accountant"
                style={{
                  width: '100%',
                  padding: '11px 14px',
                  borderRadius: '8px',
                  background: 'var(--fp-surface-2)',
                  border: '1px solid var(--fp-border)',
                  color: 'var(--fp-text-primary)',
                  fontSize: '1rem',
                  minHeight: 'var(--fp-touch-min)',
                }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.825rem', color: 'var(--fp-text-secondary)', marginBottom: '6px' }}>
              Monthly Salary (ETB) <span style={{ color: 'var(--fp-danger, #EF4444)' }}>*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <CreditCard size={18} color="var(--fp-benefit)" style={{ position: 'absolute', left: '12px', top: '13px' }} />
              <input
                type="number"
                min="1"
                step="0.01"
                required
                inputMode="decimal"
                value={monthlySalary}
                onChange={(e) => handleSalaryChange(e.target.value)}
                placeholder="e.g. 15000"
                style={{
                  width: '100%',
                  padding: '11px 14px 11px 38px',
                  borderRadius: '8px',
                  background: 'var(--fp-surface-2)',
                  border: '1px solid var(--fp-border)',
                  color: 'var(--fp-text-primary)',
                  fontSize: '1rem',
                  fontFamily: 'var(--fp-font-mono)',
                  minHeight: 'var(--fp-touch-min)',
                }}
              />
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--fp-text-muted)', marginTop: '4px' }}>
              FlexPay Earned Wage Access baseline: default credit limit = Monthly Salary.
            </p>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.825rem', color: 'var(--fp-text-secondary)', marginBottom: '6px' }}>
              Credit Limit (ETB) {isLimitOverridden && <span style={{ color: 'var(--fp-pending, #F59E0B)', fontSize: '0.75rem' }}>(Overridden)</span>}
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={creditLimit}
              onChange={(e) => handleLimitChange(e.target.value)}
              placeholder="Defaults to Monthly Salary"
              style={{
                width: '100%',
                padding: '11px 14px',
                borderRadius: '8px',
                background: 'var(--fp-surface-2)',
                border: '1px solid var(--fp-border)',
                color: 'var(--fp-text-primary)',
                fontSize: '1rem',
                fontFamily: 'var(--fp-font-mono)',
                minHeight: 'var(--fp-touch-min)',
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="fp-touch-target"
            style={{
              marginTop: '8px',
              padding: '14px',
              minHeight: 'var(--fp-touch-comfortable)',
              borderRadius: '8px',
              background: 'var(--fp-benefit)',
              color: '#060A14',
              fontWeight: 700,
              fontSize: '1rem',
              border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: '0 4px 16px rgba(16, 185, 129, 0.25)',
            }}
          >
            {loading ? 'Creating Account & CSPRNG Password...' : 'Issue FP-ID & Generate Password'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default AddEmployeeForm;
