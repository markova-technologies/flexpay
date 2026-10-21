import React, { useState, useEffect } from 'react';
import { Warning, CheckCircle, XCircle, ArrowsClockwise, ShieldCheck } from '@phosphor-icons/react';
import api from '../../services/api';
import { useToast } from '../../contexts/ToastContext';

function PasswordResetSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          style={{
            display: 'grid',
            gridTemplateColumns: '2fr 1.5fr 1fr 120px',
            gap: '16px',
            alignItems: 'center',
            padding: '16px 14px',
            borderBottom: '1px solid var(--fp-border-subtle)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="fp-skeleton" style={{ width: '34px', height: '34px', borderRadius: '50%', flexShrink: 0 }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div className="fp-skeleton" style={{ width: '130px', height: '16px' }} />
              <div className="fp-skeleton" style={{ width: '80px', height: '12px' }} />
            </div>
          </div>
          <div className="fp-skeleton" style={{ width: '120px', height: '16px' }} />
          <div className="fp-skeleton" style={{ width: '90px', height: '16px' }} />
          <div style={{ display: 'flex', gap: '8px', justifySelf: 'end' }}>
            <div className="fp-skeleton" style={{ width: '48px', height: '32px', borderRadius: '6px' }} />
            <div className="fp-skeleton" style={{ width: '48px', height: '32px', borderRadius: '6px' }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function PasswordResetRequests({ onPasswordGenerated }) {
  const toast = useToast();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [error, setError] = useState('');

  const fetchRequests = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/org/password-reset-requests');
      setRequests(res.data.requests || []);
    } catch (err) {
      setError('Failed to fetch password reset queue.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleApprove = async (req) => {
    const targetId = req?.id || req?.requestId;
    if (!targetId || targetId === 'undefined') {
      toast.error('Invalid request record identifier. Please refresh the queue.');
      return;
    }

    setActionLoadingId(targetId);
    try {
      const res = await api.post(`/org/password-reset-requests/${targetId}`, {
        action: 'APPROVE',
      });

      // Show the newly generated 16-character password in the PasswordDisplay modal!
      onPasswordGenerated(req.full_name || req.fullName || 'Employee', req.fp_employee_id || req.fpEmployeeId, res.data.newPassword);
      toast.success('Password reset approved. Temporary credentials generated.');
      await fetchRequests();
    } catch (err) {
      toast.error(err.response?.data?.message || err.response?.data?.error || 'Failed to approve password reset.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleReject = async (req) => {
    const targetId = req?.id || req?.requestId;
    if (!targetId || targetId === 'undefined') {
      toast.error('Invalid request record identifier. Please refresh the queue.');
      return;
    }

    const confirmed = await toast.confirm({
      title: 'Reject Password Reset Request?',
      message: `Are you sure you want to decline the password reset request for ${req.full_name || req.fullName || 'this employee'}? They will need to submit a new request if they still need assistance.`,
      confirmText: 'Reject Request',
      cancelText: 'Keep Request',
      variant: 'danger',
    });
    if (!confirmed) return;

    setActionLoadingId(targetId);
    try {
      await api.post(`/org/password-reset-requests/${targetId}`, {
        action: 'REJECT',
      });
      toast.info('Password reset request has been declined.');
      await fetchRequests();
    } catch (err) {
      toast.error(err.response?.data?.message || err.response?.data?.error || 'Failed to reject reset request.');
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div
      style={{
        background: 'var(--fp-surface-1)',
        border: '1px solid var(--fp-border)',
        borderRadius: '20px',
        padding: 'clamp(18px, 3.5vw, 28px)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h3 style={{ fontSize: 'clamp(1.1rem, 3.5vw, 1.25rem)', fontWeight: 700, margin: 0 }}>Password Reset Approval Queue</h3>
          <p style={{ color: 'var(--fp-text-secondary)', fontSize: '0.85rem', marginTop: '4px' }}>
            Employees who forgot their credentials submit requests here. Approving generates a new 16-character password.
          </p>
        </div>
        <button
          onClick={fetchRequests}
          disabled={loading}
          className="fp-touch-target"
          style={{
            background: 'var(--fp-surface-2)',
            border: '1px solid var(--fp-border)',
            borderRadius: '8px',
            padding: '8px 14px',
            color: 'var(--fp-text-secondary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.85rem',
            minHeight: 'var(--fp-touch-min)',
          }}
        >
          <ArrowsClockwise size={16} />
          Refresh
        </button>
      </div>

      {loading ? (
        <PasswordResetSkeleton />
      ) : requests.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '48px 24px',
            background: 'var(--fp-surface-2)',
            borderRadius: '12px',
            color: 'var(--fp-text-secondary)',
          }}
        >
          <ShieldCheck size={36} color="var(--fp-benefit)" style={{ marginBottom: '8px' }} />
          <p style={{ fontWeight: 600 }}>No Pending Password Reset Requests</p>
          <span style={{ fontSize: '0.8rem', color: 'var(--fp-text-muted)' }}>
            All employee credentials across your company are currently active and secure.
          </span>
        </div>
      ) : (
        <div className="fp-table-responsive">
          <table style={{ width: '100%', minWidth: '700px', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--fp-border)', color: 'var(--fp-text-muted)', textAlign: 'left' }}>
                <th style={{ padding: '12px 14px' }}>Employee</th>
                <th style={{ padding: '12px 14px' }}>FP-ID</th>
                <th style={{ padding: '12px 14px' }}>Phone</th>
                <th style={{ padding: '12px 14px' }}>Reason</th>
                <th style={{ padding: '12px 14px' }}>Status</th>
                <th style={{ padding: '12px 14px', textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((req) => {
                const reqId = req.id || req.requestId;
                return (
                  <tr key={reqId} style={{ borderBottom: '1px solid var(--fp-border-subtle)' }}>
                    <td style={{ padding: '14px', fontWeight: 600 }}>
                      {req.full_name || req.fullName || 'Employee'}
                    </td>
                    <td className="mono" style={{ padding: '14px', color: 'var(--fp-benefit)' }}>
                      {req.fp_employee_id || req.fpEmployeeId}
                    </td>
                    <td className="mono" style={{ padding: '14px' }}>
                      {req.phone_number || req.phoneNumber}
                    </td>
                    <td style={{ padding: '14px', color: 'var(--fp-text-secondary)', maxWidth: '200px' }}>
                      {req.reason || 'Password reset request'}
                    </td>
                    <td style={{ padding: '14px' }}>
                      <span
                        style={{
                          padding: '3px 8px',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          background:
                            req.status === 'PENDING'
                              ? 'rgba(245, 158, 11, 0.15)'
                              : req.status === 'APPROVED'
                              ? 'rgba(16, 185, 129, 0.15)'
                              : 'rgba(239, 68, 68, 0.15)',
                          color:
                            req.status === 'PENDING'
                              ? 'var(--fp-salary)'
                              : req.status === 'APPROVED'
                              ? 'var(--fp-benefit)'
                              : '#EF4444',
                        }}
                      >
                        {req.status}
                      </span>
                    </td>
                    <td style={{ padding: '14px', textAlign: 'right' }}>
                      {req.status === 'PENDING' ? (
                        <div style={{ display: 'inline-flex', gap: '8px' }}>
                          <button
                            onClick={() => handleApprove(req)}
                            disabled={actionLoadingId === reqId}
                            className="fp-touch-target"
                            style={{
                              padding: '8px 14px',
                              minHeight: '38px',
                              borderRadius: '6px',
                              background: 'var(--fp-benefit)',
                              color: '#060A14',
                              fontWeight: 700,
                              fontSize: '0.8rem',
                              border: 'none',
                              cursor: 'pointer',
                            }}
                          >
                            {actionLoadingId === reqId ? 'Generating...' : 'Approve & Issue'}
                          </button>
                          <button
                            onClick={() => handleReject(req)}
                            disabled={actionLoadingId === reqId}
                            className="fp-touch-target"
                            style={{
                              padding: '8px 12px',
                              minHeight: '38px',
                              borderRadius: '6px',
                              background: 'transparent',
                              border: '1px solid rgba(239, 68, 68, 0.3)',
                              color: '#EF4444',
                              fontSize: '0.8rem',
                              cursor: 'pointer',
                            }}
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span style={{ fontSize: '0.8rem', color: 'var(--fp-text-muted)' }}>Resolved</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
