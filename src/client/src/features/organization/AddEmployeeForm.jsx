import React, { useState } from 'react';
import { UserPlus, X, CreditCard, Phone, Buildings, User } from '@phosphor-icons/react';
import api from '../../services/api';

export default function AddEmployeeForm({ onClose, onCreated }) {
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('251');
  const [department, setDepartment] = useState('Engineering');
  const [creditLimit, setCreditLimit] = useState(10000);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/org/employees', {
        fullName: fullName.trim(),
        phoneNumber: phoneNumber.trim(),
        department: department.trim(),
        creditLimit: Number(creditLimit),
        creditLimitOverride: Number(creditLimit),
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
          maxWidth: '480px',
          background: 'var(--fp-surface-1)',
          border: '1px solid var(--fp-border)',
          borderRadius: '20px',
          padding: '32px',
          boxShadow: 'var(--fp-shadow-lg)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
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
              }}
            >
              <UserPlus size={22} color="var(--fp-benefit)" weight="bold" />
            </div>
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Add Employee to Plan</h3>
              <span style={{ fontSize: '0.8rem', color: 'var(--fp-text-muted)' }}>
                Generates Luhn FP-ID & 16-Char Credential
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--fp-text-muted)',
              cursor: 'pointer',
              padding: '6px',
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
              marginBottom: '20px',
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.825rem', color: 'var(--fp-text-secondary)', marginBottom: '6px' }}>
              Employee Full Name
            </label>
            <div style={{ position: 'relative' }}>
              <User size={18} color="var(--fp-text-muted)" style={{ position: 'absolute', left: '12px', top: '12px' }} />
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
                  fontSize: '0.9rem',
                }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.825rem', color: 'var(--fp-text-secondary)', marginBottom: '6px' }}>
              Safaricom Phone Number (251...)
            </label>
            <div style={{ position: 'relative' }}>
              <Phone size={18} color="var(--fp-text-muted)" style={{ position: 'absolute', left: '12px', top: '12px' }} />
              <input
                type="text"
                required
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
                  fontSize: '0.9rem',
                  fontFamily: 'var(--fp-font-mono)',
                }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
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
                  fontSize: '0.9rem',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.825rem', color: 'var(--fp-text-secondary)', marginBottom: '6px' }}>
                Credit Limit (ETB)
              </label>
              <input
                type="number"
                min="500"
                step="100"
                required
                value={creditLimit}
                onChange={(e) => setCreditLimit(e.target.value)}
                style={{
                  width: '100%',
                  padding: '11px 14px',
                  borderRadius: '8px',
                  background: 'var(--fp-surface-2)',
                  border: '1px solid var(--fp-border)',
                  color: 'var(--fp-text-primary)',
                  fontSize: '0.9rem',
                  fontFamily: 'var(--fp-font-mono)',
                }}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: '10px',
              padding: '13px',
              borderRadius: '8px',
              background: 'var(--fp-benefit)',
              color: '#060A14',
              fontWeight: 700,
              fontSize: '0.95rem',
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
