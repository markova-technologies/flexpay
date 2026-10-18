import React, { useState, useEffect } from 'react';
import {
  CurrencyDollar,
  ArrowsClockwise,
  CheckCircle,
  Warning,
  Storefront,
  User,
  PaperPlaneTilt,
  ClockAfternoon
} from '@phosphor-icons/react';
import api from '../../services/api';
import { useToast } from '../../contexts/ToastContext';

export default function PayrollPreview() {
  const toast = useToast();
  const [preview, setPreview] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [runningPayroll, setRunningPayroll] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const loadData = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const [prevRes, histRes] = await Promise.all([
        api.get('/org/payroll/preview'),
        api.get('/org/payroll/history').catch(() => ({ data: { settlements: [] } })),
      ]);
      setPreview(prevRes.data);
      setHistory(histRes.data?.settlements || []);
    } catch (err) {
      setErrorMsg('Failed to load payroll preview calculations.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRunPayroll = async () => {
    const confirmed = await toast.confirm({
      title: 'Execute Automated Payroll Settlement?',
      message: 'This will wire M-PESA B2C payouts to all certified merchants and reset employee credit allowances for the billing cycle. This action creates immutable double-entry ledger records.',
      confirmText: 'Execute Settlement',
      cancelText: 'Review Balances',
      variant: 'benefit',
    });
    if (!confirmed) return;

    setRunningPayroll(true);
    setSuccessMsg('');
    setErrorMsg('');
    try {
      const today = new Date();
      const periodStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
      const periodEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10);
      const res = await api.post('/org/payroll/run', {
        periodStart,
        periodEnd,
        settlementDate: today.toISOString(),
      });
      const stlRef = res.data.settlementId || res.data.settlement?.id || 'Ref-OK';
      const msg = `Payroll settlement initiated successfully! Settlement Reference: ${stlRef}. M-PESA B2C wires dispatched.`;
      setSuccessMsg(msg);
      toast.success('Automated payroll settlement executed successfully.');
      await loadData();
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.error || 'Failed to execute payroll settlement.';
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setRunningPayroll(false);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--fp-text-muted)' }}>
        <ArrowsClockwise size={32} className="spin" style={{ marginBottom: '8px' }} />
        <p>Calculating real-time double-entry payroll balances...</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* Banner / Success */}
      {successMsg && (
        <div
          style={{
            padding: '16px 20px',
            background: 'rgba(16, 185, 129, 0.12)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: '12px',
            color: 'var(--fp-benefit)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <CheckCircle size={24} weight="fill" />
          <div>
            <strong>Settlement Dispatched</strong>
            <p style={{ fontSize: '0.85rem', color: 'var(--fp-text-secondary)', marginTop: '2px' }}>
              {successMsg}
            </p>
          </div>
        </div>
      )}

      {errorMsg && (
        <div style={{ padding: '14px', background: 'rgba(239, 68, 68, 0.12)', color: '#EF4444', borderRadius: '10px' }}>
          {errorMsg}
        </div>
      )}

      {/* Overview Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
        <div
          style={{
            background: 'var(--fp-surface-1)',
            border: '1px solid var(--fp-border)',
            borderRadius: '16px',
            padding: '24px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <Storefront size={20} color="var(--fp-salary)" />
            <span style={{ fontSize: '0.85rem', color: 'var(--fp-text-muted)' }}>Merchant Payouts Pending</span>
          </div>
          <div className="mono" style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--fp-salary)' }}>
            ETB {Number(preview?.totalMerchantDisbursements || 0).toLocaleString()}
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--fp-text-secondary)', marginTop: '4px', display: 'block' }}>
            Across {preview?.merchantDisbursements?.length || 0} certified merchant partner(s)
          </span>
        </div>

        <div
          style={{
            background: 'var(--fp-surface-1)',
            border: '1px solid var(--fp-border)',
            borderRadius: '16px',
            padding: '24px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <User size={20} color="var(--fp-benefit)" />
            <span style={{ fontSize: '0.85rem', color: 'var(--fp-text-muted)' }}>Employee Benefits Absorbed</span>
          </div>
          <div className="mono" style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--fp-benefit)' }}>
            ETB {Number(preview?.totalCreditUsed || 0).toLocaleString()}
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--fp-text-secondary)', marginTop: '4px', display: 'block' }}>
            Funded by corporate employer benefit budget
          </span>
        </div>

        {/* Action Button Card */}
        <div
          style={{
            background: 'var(--fp-surface-2)',
            border: '1px solid var(--fp-border-strong)',
            borderRadius: '16px',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
          }}
        >
          <button
            onClick={handleRunPayroll}
            disabled={runningPayroll || (preview?.totalMerchantDisbursements === 0)}
            style={{
              padding: '14px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
              color: '#FFFFFF',
              fontWeight: 800,
              fontSize: '0.95rem',
              border: 'none',
              cursor: runningPayroll || (preview?.totalMerchantDisbursements === 0) ? 'not-allowed' : 'pointer',
              opacity: runningPayroll || (preview?.totalMerchantDisbursements === 0) ? 0.6 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              boxShadow: '0 4px 20px rgba(16, 185, 129, 0.3)',
            }}
          >
            <PaperPlaneTilt size={20} weight="bold" />
            {runningPayroll ? 'Executing M-PESA B2C Wires...' : 'Execute Payroll Settlement'}
          </button>
          <span style={{ fontSize: '0.75rem', color: 'var(--fp-text-muted)', textAlign: 'center', marginTop: '8px' }}>
            Automatically resets all employee credit limits upon completion.
          </span>
        </div>
      </div>

      {/* Merchant Disbursements Table */}
      <div
        style={{
          background: 'var(--fp-surface-1)',
          border: '1px solid var(--fp-border)',
          borderRadius: '16px',
          padding: '24px',
        }}
      >
        <h3 style={{ fontSize: '1.1rem', marginBottom: '16px' }}>Merchant Disbursement Breakdown</h3>
        {(!preview?.merchantDisbursements || preview.merchantDisbursements.length === 0) ? (
          <p style={{ color: 'var(--fp-text-muted)', fontSize: '0.9rem' }}>No pending merchant payables.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--fp-border)', color: 'var(--fp-text-muted)', textAlign: 'left' }}>
                <th style={{ padding: '10px 14px' }}>Merchant</th>
                <th style={{ padding: '10px 14px' }}>M-PESA Payout Till / Phone</th>
                <th style={{ padding: '10px 14px' }}>Transactions</th>
                <th style={{ padding: '10px 14px', textAlign: 'right' }}>Total Receivable Due</th>
              </tr>
            </thead>
            <tbody>
              {preview.merchantDisbursements.map((m) => (
                <tr key={m.merchantId} style={{ borderBottom: '1px solid var(--fp-border-subtle)' }}>
                  <td style={{ padding: '12px 14px', fontWeight: 600 }}>{m.merchantName}</td>
                  <td className="mono" style={{ padding: '12px 14px', color: 'var(--fp-salary)' }}>
                    {m.mpesaPhone}
                  </td>
                  <td style={{ padding: '12px 14px' }}>{m.transactionCount}</td>
                  <td className="mono" style={{ padding: '12px 14px', fontWeight: 800, textAlign: 'right' }}>
                    ETB {Number(m.totalPayable).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Employee Salary Deductions & Net Payout Table */}
      <div
        style={{
          background: 'var(--fp-surface-1)',
          border: '1px solid var(--fp-border)',
          borderRadius: '16px',
          padding: '24px',
        }}
      >
        <h3 style={{ fontSize: '1.1rem', marginBottom: '16px' }}>Employee Net Pay & Pre-Salary Credit Deductions</h3>
        {(!preview?.employeeLines || preview.employeeLines.length === 0) ? (
          <p style={{ color: 'var(--fp-text-muted)', fontSize: '0.9rem' }}>No employee payroll lines recorded.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--fp-border)', color: 'var(--fp-text-muted)', textAlign: 'left' }}>
                <th style={{ padding: '10px 14px' }}>Employee</th>
                <th style={{ padding: '10px 14px' }}>FP-ID</th>
                <th style={{ padding: '10px 14px', textAlign: 'right' }}>Monthly Salary</th>
                <th style={{ padding: '10px 14px', textAlign: 'right' }}>Credit Used</th>
                <th style={{ padding: '10px 14px', textAlign: 'right' }}>Net to Pay</th>
              </tr>
            </thead>
            <tbody>
              {preview.employeeLines.map((line) => (
                <tr key={line.employee_id} style={{ borderBottom: '1px solid var(--fp-border-subtle)' }}>
                  <td style={{ padding: '12px 14px', fontWeight: 600 }}>{line.full_name}</td>
                  <td className="mono" style={{ padding: '12px 14px', color: 'var(--fp-text-muted)' }}>{line.fp_employee_id}</td>
                  <td className="mono" style={{ padding: '12px 14px', textAlign: 'right' }}>ETB {Number(line.monthly_salary).toFixed(2)}</td>
                  <td className="mono" style={{ padding: '12px 14px', textAlign: 'right', color: 'var(--fp-benefit)' }}>ETB {Number(line.credit_used).toFixed(2)}</td>
                  <td className="mono" style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 800 }}>ETB {Number(line.net_to_pay).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Settlement History */}
      {history.length > 0 && (
        <div
          style={{
            background: 'var(--fp-surface-1)',
            border: '1px solid var(--fp-border)',
            borderRadius: '16px',
            padding: '24px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <ClockAfternoon size={20} color="var(--fp-benefit)" />
            <h3 style={{ fontSize: '1.1rem', margin: 0 }}>Past Settlement Cycles</h3>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--fp-border)', color: 'var(--fp-text-muted)', textAlign: 'left' }}>
                <th style={{ padding: '10px 14px' }}>Settlement ID</th>
                <th style={{ padding: '10px 14px' }}>Total Amount</th>
                <th style={{ padding: '10px 14px' }}>Status</th>
                <th style={{ padding: '10px 14px' }}>Date</th>
              </tr>
            </thead>
            <tbody>
              {history.map((s) => (
                <tr key={s.id} style={{ borderBottom: '1px solid var(--fp-border-subtle)' }}>
                  <td className="mono" style={{ padding: '12px 14px' }}>{s.id}</td>
                  <td className="mono" style={{ padding: '12px 14px', fontWeight: 700 }}>
                    ETB {Number(s.total_amount).toLocaleString()}
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <span
                      style={{
                        padding: '3px 8px',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        background: s.status === 'COMPLETED' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                        color: s.status === 'COMPLETED' ? 'var(--fp-benefit)' : 'var(--fp-salary)',
                      }}
                    >
                      {s.status}
                    </span>
                  </td>
                  <td style={{ padding: '12px 14px', color: 'var(--fp-text-muted)' }}>
                    {new Date(s.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
