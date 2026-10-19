import React, { useState, useEffect } from 'react';
import {
  CurrencyDollar,
  ArrowsClockwise,
  CheckCircle,
  Warning,
  Storefront,
  User,
  PaperPlaneTilt,
  ClockAfternoon,
  Eye,
  X,
  Receipt
} from '@phosphor-icons/react';
import api from '../../services/api';
import { useToast } from '../../contexts/ToastContext';

export default function PayrollPreview() {
  const toast = useToast();
  const [preview, setPreview] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [runningPayroll, setRunningPayroll] = useState(false);
  const [completingId, setCompletingId] = useState(null);
  const [finalizingAll, setFinalizingAll] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Modal breakdown state
  const [selectedSettlement, setSelectedSettlement] = useState(null);
  const [modalLines, setModalLines] = useState([]);
  const [loadingLines, setLoadingLines] = useState(false);

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
        autoComplete: true, // Guarantees B2C wires & credit accounts complete cleanly
      });
      const stlRef = res.data.settlementId || res.data.settlement?.id || 'Ref-OK';
      const isCompleted = res.data.settlement?.status === 'COMPLETED';
      const msg = isCompleted
        ? `Payroll settlement executed and completed! Settlement Reference: ${stlRef}. Merchant M-PESA B2C wires confirmed and employee credit reset.`
        : `Payroll settlement initiated! Settlement Reference: ${stlRef}. M-PESA B2C wires dispatched.`;
      setSuccessMsg(msg);
      toast.success(isCompleted ? 'Automated payroll settlement executed and completed.' : 'Payroll settlement initiated.');
      await loadData();
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.error || 'Failed to execute payroll settlement.';
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setRunningPayroll(false);
    }
  };

  const handleCompleteSettlement = async (settlementId) => {
    setCompletingId(settlementId);
    setErrorMsg('');
    try {
      const res = await api.post(`/org/payroll/${settlementId}/complete`);
      toast.success(res.data?.message || 'Settlement finalized! Merchant payouts confirmed and credit reset.');
      setSuccessMsg(`Settlement ${settlementId} successfully finalized. All merchant wires confirmed.`);
      await loadData();
    } catch (err) {
      const msg = err.response?.data?.error || err.response?.data?.message || 'Failed to finalize settlement.';
      toast.error(msg);
      setErrorMsg(msg);
    } finally {
      setCompletingId(null);
    }
  };

  const handleFinalizeAll = async () => {
    setFinalizingAll(true);
    setErrorMsg('');
    try {
      const res = await api.post('/org/payroll/finalize-all');
      const count = res.data?.count || runningSettlements.length;
      toast.success(res.data?.message || `Successfully finalized ${count} running settlement(s)!`);
      setSuccessMsg(`All running settlements successfully finalized! Merchant wires confirmed and employee credit reset.`);
      await loadData();
    } catch (err) {
      const msg = err.response?.data?.error || err.response?.data?.message || 'Failed to finalize settlements.';
      toast.error(msg);
      setErrorMsg(msg);
    } finally {
      setFinalizingAll(false);
    }
  };

  const handleViewLines = async (settlement) => {
    setSelectedSettlement(settlement);
    setModalLines([]);
    setLoadingLines(true);
    try {
      const res = await api.get(`/org/payroll/${settlement.id}/lines`);
      setModalLines(res.data?.lines || []);
    } catch (err) {
      toast.error('Unable to fetch disbursement lines.');
    } finally {
      setLoadingLines(false);
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

  const runningSettlements = history.filter((s) => s.status === 'RUNNING');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* Running Settlement Recovery Banner (Handles single or multiple distributions) */}
      {runningSettlements.length > 0 && (
        <div
          style={{
            padding: '18px 22px',
            background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.16) 0%, rgba(217, 119, 6, 0.08) 100%)',
            border: '1px solid rgba(245, 158, 11, 0.4)',
            borderRadius: '14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '18px',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: '1 1 300px' }}>
            <ArrowsClockwise size={26} className="spin" color="var(--fp-salary)" />
            <div>
              <strong style={{ color: 'var(--fp-salary)', fontSize: '0.95rem' }}>
                {runningSettlements.length === 1
                  ? 'Settlement Execution in Progress (RUNNING)'
                  : `${runningSettlements.length} Payment Distributions in Progress (RUNNING)`}
              </strong>
              <p style={{ fontSize: '0.85rem', color: 'var(--fp-text-secondary)', marginTop: '4px', lineHeight: 1.4 }}>
                {runningSettlements.length === 1 ? (
                  <>
                    Settlement <span className="mono" style={{ color: '#F1F5F9' }}>{runningSettlements[0].id}</span> is awaiting callback confirmation. You can finalize all merchant payouts and complete employee credit reset now.
                  </>
                ) : (
                  <>
                    You have <strong style={{ color: '#F1F5F9' }}>{runningSettlements.length} payment distributions</strong> pending B2C wire confirmation. Click below to confirm and finalize all merchant payouts at once.
                  </>
                )}
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            {runningSettlements.length > 1 ? (
              <button
                onClick={handleFinalizeAll}
                disabled={finalizingAll}
                style={{
                  padding: '11px 20px',
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                  color: '#FFFFFF',
                  fontWeight: 700,
                  fontSize: '0.875rem',
                  border: 'none',
                  cursor: finalizingAll ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 2px 12px rgba(16, 185, 129, 0.35)',
                }}
              >
                <CheckCircle size={18} weight="bold" />
                {finalizingAll ? 'Finalizing All Distributions...' : `Finalize All Running Distributions (${runningSettlements.length})`}
              </button>
            ) : (
              <button
                onClick={() => handleCompleteSettlement(runningSettlements[0].id)}
                disabled={completingId === runningSettlements[0].id}
                style={{
                  padding: '10px 18px',
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                  color: '#FFFFFF',
                  fontWeight: 700,
                  fontSize: '0.875rem',
                  border: 'none',
                  cursor: completingId === runningSettlements[0].id ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 2px 10px rgba(16, 185, 129, 0.3)',
                }}
              >
                <CheckCircle size={18} weight="bold" />
                {completingId === runningSettlements[0].id ? 'Finalizing Wires...' : 'Finalize & Confirm Payouts'}
              </button>
            )}
          </div>
        </div>
      )}

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
            <strong>Settlement Confirmed</strong>
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
            {preview?.totalMerchantDisbursements > 0
              ? `Across ${preview?.merchantDisbursements?.length || 0} certified merchant partner(s)`
              : 'All merchant receivables settled for this billing cycle.'}
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
              background: (preview?.totalMerchantDisbursements === 0)
                ? 'var(--fp-surface-3, #1E293B)'
                : 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
              color: '#FFFFFF',
              fontWeight: 800,
              fontSize: '0.95rem',
              border: 'none',
              cursor: runningPayroll || (preview?.totalMerchantDisbursements === 0) ? 'not-allowed' : 'pointer',
              opacity: runningPayroll || (preview?.totalMerchantDisbursements === 0) ? 0.7 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              boxShadow: (preview?.totalMerchantDisbursements === 0) ? 'none' : '0 4px 20px rgba(16, 185, 129, 0.3)',
            }}
          >
            {preview?.totalMerchantDisbursements === 0 ? (
              <>
                <CheckCircle size={20} color="var(--fp-benefit)" weight="bold" />
                Settlement Up to Date
              </>
            ) : (
              <>
                <PaperPlaneTilt size={20} weight="bold" />
                {runningPayroll ? 'Executing M-PESA B2C Wires...' : 'Execute Payroll Settlement'}
              </>
            )}
          </button>
          <span style={{ fontSize: '0.75rem', color: 'var(--fp-text-muted)', textAlign: 'center', marginTop: '8px' }}>
            {preview?.totalMerchantDisbursements === 0
              ? 'All current credit receivables have been settled.'
              : 'Automatically resets all employee credit limits upon completion.'}
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
          <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--fp-text-muted)' }}>
            <CheckCircle size={32} color="var(--fp-benefit)" style={{ marginBottom: '8px' }} />
            <p style={{ margin: 0, fontWeight: 600, color: 'var(--fp-text-secondary)' }}>
              All merchant payables are settled!
            </p>
            <span style={{ fontSize: '0.8rem' }}>
              Pending merchant receivables will accrue dynamically on new employee POS purchases.
            </span>
          </div>
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
                <tr key={m.merchantId || m.merchant_id} style={{ borderBottom: '1px solid var(--fp-border-subtle)' }}>
                  <td style={{ padding: '12px 14px', fontWeight: 600 }}>{m.merchantName || m.merchant_name || 'Merchant Partner'}</td>
                  <td className="mono" style={{ padding: '12px 14px', color: 'var(--fp-salary)' }}>
                    {m.mpesaPhone || m.merchantMpesaNumber || m.merchant_mpesa_snapshot || '—'}
                  </td>
                  <td style={{ padding: '12px 14px' }}>{m.transactionCount ?? m.transaction_count ?? 0}</td>
                  <td className="mono" style={{ padding: '12px 14px', fontWeight: 800, textAlign: 'right' }}>
                    ETB {(Number(m.totalPayable ?? m.totalOwed ?? m.amount ?? 0) || 0).toLocaleString()}
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
                <th style={{ padding: '10px 14px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {history.map((s) => {
                const merchantTotal = Number(s.total_merchant_disbursements ?? s.total_amount ?? s.totalAmount ?? 0) || 0;
                return (
                  <tr key={s.id} style={{ borderBottom: '1px solid var(--fp-border-subtle)' }}>
                    <td className="mono" style={{ padding: '12px 14px' }}>{s.id}</td>
                    <td className="mono" style={{ padding: '12px 14px', fontWeight: 700, color: 'var(--fp-salary)' }}>
                      ETB {merchantTotal.toLocaleString()}
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
                    <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '8px' }}>
                        {s.status === 'RUNNING' && (
                          <button
                            onClick={() => handleCompleteSettlement(s.id)}
                            disabled={completingId === s.id}
                            style={{
                              padding: '6px 12px',
                              borderRadius: '6px',
                              background: 'var(--fp-benefit)',
                              color: '#FFFFFF',
                              border: 'none',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            {completingId === s.id ? 'Finalizing...' : 'Finalize Payouts'}
                          </button>
                        )}
                        <button
                          onClick={() => handleViewLines(s)}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '6px',
                            background: 'var(--fp-surface-2)',
                            color: 'var(--fp-text-primary, #F8FAFC)',
                            border: '1px solid var(--fp-border)',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <Eye size={14} />
                          Details
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Accessible In-System Modal: Settlement Disbursement Lines Breakdown */}
      {selectedSettlement && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
          onClick={() => setSelectedSettlement(null)}
        >
          <div
            style={{
              background: 'var(--fp-surface-1, #0F172A)',
              border: '1px solid var(--fp-border, #334155)',
              borderRadius: '20px',
              maxWidth: '720px',
              width: '100%',
              maxHeight: '85vh',
              overflowY: 'auto',
              padding: '28px',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#F8FAFC' }}>
                  Settlement Breakdown Details
                </h3>
                <p className="mono" style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--fp-text-muted)' }}>
                  ID: {selectedSettlement.id} &bull; Status: {selectedSettlement.status}
                </p>
              </div>
              <button
                onClick={() => setSelectedSettlement(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--fp-text-muted)',
                  cursor: 'pointer',
                  padding: '4px',
                }}
              >
                <X size={22} />
              </button>
            </div>

            {loadingLines ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--fp-text-muted)' }}>
                <ArrowsClockwise size={24} className="spin" style={{ marginBottom: '8px' }} />
                <p>Loading disbursement wires...</p>
              </div>
            ) : modalLines.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--fp-text-muted)' }}>
                No disbursement line items found for this settlement.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--fp-border)', color: 'var(--fp-text-muted)', textAlign: 'left' }}>
                      <th style={{ padding: '8px 12px' }}>Type</th>
                      <th style={{ padding: '8px 12px' }}>Recipient M-PESA</th>
                      <th style={{ padding: '8px 12px' }}>Amount</th>
                      <th style={{ padding: '8px 12px' }}>Receipt / Wire Ref</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {modalLines.map((l) => (
                      <tr key={l.id} style={{ borderBottom: '1px solid var(--fp-border-subtle)' }}>
                        <td style={{ padding: '10px 12px', fontWeight: 600 }}>
                          <span
                            style={{
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontSize: '0.7rem',
                              background: l.recipient_type === 'MERCHANT' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                              color: l.recipient_type === 'MERCHANT' ? 'var(--fp-salary)' : 'var(--fp-benefit)',
                            }}
                          >
                            {l.recipient_type}
                          </span>
                        </td>
                        <td className="mono" style={{ padding: '10px 12px', color: '#F1F5F9' }}>
                          {l.recipient_mpesa_number}
                        </td>
                        <td className="mono" style={{ padding: '10px 12px', fontWeight: 700 }}>
                          ETB {Number(l.amount).toLocaleString()}
                        </td>
                        <td className="mono" style={{ padding: '10px 12px', color: 'var(--fp-text-muted)', fontSize: '0.75rem' }}>
                          {l.mpesa_receipt || l.mpesa_conversation_id || 'Pending Dispatch'}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                          <span
                            style={{
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              background: l.status === 'COMPLETED' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                              color: l.status === 'COMPLETED' ? 'var(--fp-benefit)' : 'var(--fp-salary)',
                            }}
                          >
                            {l.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
              <button
                onClick={() => setSelectedSettlement(null)}
                style={{
                  padding: '8px 18px',
                  borderRadius: '8px',
                  background: 'var(--fp-surface-2)',
                  border: '1px solid var(--fp-border)',
                  color: '#FFFFFF',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
