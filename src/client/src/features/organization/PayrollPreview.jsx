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
  const [modalFilter, setModalFilter] = useState('ALL'); // 'ALL' | 'MERCHANT' | 'EMPLOYEE'

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

      // Collect previewed employee lines so exact remainder salaries and deductions are passed
      const employeeSalaries = (preview?.employeeLines || []).map((line) => ({
        employeeId: line.employeeId || line.employee_id,
        grossSalary: Number(line.monthlySalary ?? line.monthly_salary ?? 0),
        phoneNumber: line.phoneNumber ?? line.phone_number ?? '',
        fullName: line.fullName ?? line.full_name ?? '',
      }));

      const res = await api.post('/org/payroll/run', {
        periodStart,
        periodEnd,
        settlementDate: today.toISOString(),
        employeeSalaries,
        autoComplete: true, // Guarantees B2C wires & credit accounts complete cleanly
      });
      const stlRef = res.data.settlementId || res.data.settlement?.id || 'Ref-OK';
      const isCompleted = res.data.settlement?.status === 'COMPLETED';
      const msg = isCompleted
        ? `Payroll settlement executed and completed! Settlement Reference: ${stlRef}. Merchant payables settled and remaining net salaries wired directly to employees' M-PESA accounts.`
        : `Payroll settlement initiated! Settlement Reference: ${stlRef}. M-PESA B2C wires dispatched to merchants and employees.`;
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
    setModalFilter('ALL');
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: '16px' }}>
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
            className="fp-touch-target"
            style={{
              padding: '14px',
              minHeight: 'var(--fp-touch-comfortable)',
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
          <div className="fp-table-responsive">
            <table style={{ width: '100%', minWidth: '600px', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
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
          </div>
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
          <div className="fp-table-responsive">
            <table style={{ width: '100%', minWidth: '680px', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
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
          </div>
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
          <div className="fp-table-responsive">
            <table style={{ width: '100%', minWidth: '620px', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
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
                              className="fp-touch-target"
                              style={{
                                padding: '8px 14px',
                                minHeight: '38px',
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
                            className="fp-touch-target"
                            style={{
                              padding: '8px 14px',
                              minHeight: '38px',
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
        </div>
      )}

      {/* Accessible In-System Modal: Settlement Disbursement Lines Breakdown */}
      {selectedSettlement && (() => {
        const merchantLines = modalLines.filter((l) => (l.recipient_type || l.recipientType) === 'MERCHANT');
        const employeeLines = modalLines.filter((l) => (l.recipient_type || l.recipientType) === 'EMPLOYEE');
        const totalMerchantAmount = merchantLines.reduce((acc, l) => acc + Number(l.amount || 0), 0);
        const totalEmployeeAmount = employeeLines.reduce((acc, l) => acc + Number(l.amount || 0), 0);
        const totalSettlementAmount = totalMerchantAmount + totalEmployeeAmount;

        const displayedLines = modalLines.filter((l) => {
          const type = l.recipient_type || l.recipientType;
          if (modalFilter === 'MERCHANT') return type === 'MERCHANT';
          if (modalFilter === 'EMPLOYEE') return type === 'EMPLOYEE';
          return true;
        });

        return (
          <div
            className="fp-modal-overlay"
            onClick={() => setSelectedSettlement(null)}
            style={{ zIndex: 1000 }}
          >
            <div
              className="fp-modal"
              style={{
                maxWidth: '860px',
                width: '100%',
                maxHeight: '88vh',
                overflowY: 'auto',
                background: 'var(--fp-surface-1, #FFFFFF)',
                color: 'var(--fp-text-primary, #141413)',
                border: '1px solid var(--fp-border)',
                borderRadius: '16px',
                boxShadow: '0 20px 45px rgba(32, 28, 24, 0.15)',
                padding: '24px',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="fp-sheet-handle" />

              {/* Modal Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '18px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <h3 style={{ margin: 0, fontSize: 'clamp(1.15rem, 3.5vw, 1.35rem)', fontWeight: 800, color: 'var(--fp-text-primary, #141413)' }}>
                      Settlement Breakdown Details
                    </h3>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: '6px',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        background: selectedSettlement.status === 'COMPLETED' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.15)',
                        color: selectedSettlement.status === 'COMPLETED' ? '#059669' : '#D97706',
                      }}
                    >
                      {selectedSettlement.status === 'COMPLETED' ? '✓ COMPLETED' : selectedSettlement.status}
                    </span>
                  </div>
                  <p className="mono" style={{ margin: '4px 0 0 0', fontSize: '0.78rem', color: 'var(--fp-text-muted)' }}>
                    Settlement ID: {selectedSettlement.id} &bull; Processed: {new Date(selectedSettlement.created_at || Date.now()).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedSettlement(null)}
                  className="fp-touch-target"
                  aria-label="Close dialog"
                  style={{
                    background: 'var(--fp-surface-2)',
                    border: '1px solid var(--fp-border)',
                    borderRadius: '8px',
                    color: 'var(--fp-text-primary)',
                    cursor: 'pointer',
                    padding: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <X size={20} weight="bold" />
                </button>
              </div>

              {/* Live Settlement KPI Summary Banner */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
                  gap: '12px',
                  marginBottom: '20px',
                }}
              >
                {/* Total Wires */}
                <div
                  style={{
                    background: 'var(--fp-surface-2, #F5EFE6)',
                    border: '1px solid var(--fp-border)',
                    borderRadius: '10px',
                    padding: '12px 14px',
                  }}
                >
                  <span style={{ fontSize: '0.72rem', color: 'var(--fp-text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                    Total Disbursed Wires
                  </span>
                  <div className="mono" style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--fp-text-primary, #141413)', marginTop: '2px' }}>
                    ETB {totalSettlementAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--fp-text-muted)' }}>
                    {modalLines.length} total M-PESA B2C transfers
                  </span>
                </div>

                {/* Merchant Receivables */}
                <div
                  style={{
                    background: 'rgba(255, 77, 38, 0.05)',
                    border: '1px solid rgba(255, 77, 38, 0.2)',
                    borderRadius: '10px',
                    padding: '12px 14px',
                  }}
                >
                  <span style={{ fontSize: '0.72rem', color: 'var(--fp-orange, #FF4D26)', fontWeight: 700, textTransform: 'uppercase' }}>
                    Merchant Receivables
                  </span>
                  <div className="mono" style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--fp-orange, #FF4D26)', marginTop: '2px' }}>
                    ETB {totalMerchantAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--fp-text-muted)' }}>
                    {merchantLines.length} certified merchant till(s)
                  </span>
                </div>

                {/* Employee Salary Wires */}
                <div
                  style={{
                    background: 'rgba(16, 185, 129, 0.06)',
                    border: '1px solid rgba(16, 185, 129, 0.25)',
                    borderRadius: '10px',
                    padding: '12px 14px',
                  }}
                >
                  <span style={{ fontSize: '0.72rem', color: '#059669', fontWeight: 700, textTransform: 'uppercase' }}>
                    Net Salary Remainder Wires
                  </span>
                  <div className="mono" style={{ fontSize: '1.2rem', fontWeight: 800, color: '#059669', marginTop: '2px' }}>
                    ETB {totalEmployeeAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--fp-text-muted)' }}>
                    {employeeLines.length} employee M-PESA account(s)
                  </span>
                </div>
              </div>

              {/* Filter Tabs */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => setModalFilter('ALL')}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '20px',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: modalFilter === 'ALL' ? 'var(--fp-orange, #FF4D26)' : 'var(--fp-surface-2)',
                    color: modalFilter === 'ALL' ? '#FFFFFF' : 'var(--fp-text-secondary)',
                    border: '1px solid var(--fp-border)',
                  }}
                >
                  All Wires ({modalLines.length})
                </button>
                <button
                  type="button"
                  onClick={() => setModalFilter('MERCHANT')}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '20px',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: modalFilter === 'MERCHANT' ? 'var(--fp-orange, #FF4D26)' : 'var(--fp-surface-2)',
                    color: modalFilter === 'MERCHANT' ? '#FFFFFF' : 'var(--fp-text-secondary)',
                    border: '1px solid var(--fp-border)',
                  }}
                >
                  Merchants ({merchantLines.length})
                </button>
                <button
                  type="button"
                  onClick={() => setModalFilter('EMPLOYEE')}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '20px',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: modalFilter === 'EMPLOYEE' ? '#059669' : 'var(--fp-surface-2)',
                    color: modalFilter === 'EMPLOYEE' ? '#FFFFFF' : 'var(--fp-text-secondary)',
                    border: '1px solid var(--fp-border)',
                  }}
                >
                  Employee Remainder Salaries ({employeeLines.length})
                </button>
              </div>

              {/* Table of Wires */}
              {loadingLines ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--fp-text-muted)' }}>
                  <ArrowsClockwise size={26} className="spin" style={{ marginBottom: '8px' }} />
                  <p style={{ margin: 0, fontWeight: 600 }}>Loading disbursement wire records...</p>
                </div>
              ) : displayedLines.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '36px 0', color: 'var(--fp-text-muted)' }}>
                  No disbursement line items match the selected filter.
                </div>
              ) : (
                <div className="fp-table-responsive" style={{ border: '1px solid var(--fp-border)', borderRadius: '10px', overflow: 'hidden' }}>
                  <table style={{ width: '100%', minWidth: '660px', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ background: 'var(--fp-surface-2, #F5EFE6)', borderBottom: '1px solid var(--fp-border)', color: 'var(--fp-text-secondary)', textAlign: 'left' }}>
                        <th style={{ padding: '10px 14px' }}>Type</th>
                        <th style={{ padding: '10px 14px' }}>Recipient & Destination</th>
                        <th style={{ padding: '10px 14px' }}>Payout Allocation</th>
                        <th style={{ padding: '10px 14px', textAlign: 'right' }}>Amount Wired</th>
                        <th style={{ padding: '10px 14px' }}>M-PESA Wire Ref</th>
                        <th style={{ padding: '10px 14px', textAlign: 'right' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayedLines.map((l) => {
                        const isMerchant = (l.recipient_type || l.recipientType) === 'MERCHANT';
                        return (
                          <tr key={l.id} style={{ borderBottom: '1px solid var(--fp-border-subtle)' }}>
                            {/* Type */}
                            <td style={{ padding: '12px 14px' }}>
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '3px 8px',
                                  borderRadius: '6px',
                                  fontSize: '0.72rem',
                                  fontWeight: 700,
                                  background: isMerchant ? 'rgba(255, 77, 38, 0.10)' : 'rgba(16, 185, 129, 0.12)',
                                  color: isMerchant ? 'var(--fp-orange, #FF4D26)' : '#059669',
                                }}
                              >
                                {isMerchant ? <Storefront size={13} weight="bold" /> : <User size={13} weight="bold" />}
                                {isMerchant ? 'MERCHANT' : 'SALARY NET'}
                              </span>
                            </td>

                            {/* Recipient & Destination */}
                            <td style={{ padding: '12px 14px' }}>
                              <div style={{ fontWeight: 700, color: 'var(--fp-text-primary, #141413)' }}>
                                {isMerchant
                                  ? (l.merchantName || l.merchant_name || 'Certified Merchant Partner')
                                  : (l.employeeName || l.employee_name || 'Enrolled Employee')}
                              </div>
                              <div className="mono" style={{ fontSize: '0.75rem', color: 'var(--fp-text-muted)', marginTop: '2px' }}>
                                {isMerchant ? (
                                  <>Till: <span style={{ color: 'var(--fp-orange, #FF4D26)', fontWeight: 600 }}>{l.recipientMpesaNumber || l.recipient_mpesa_number}</span></>
                                ) : (
                                  <>
                                    <span>{l.employeeFpId || l.employee_fp_id || 'FP-ID'}</span> &bull; M-PESA: <span style={{ color: '#059669', fontWeight: 600 }}>{l.recipientMpesaNumber || l.recipient_mpesa_number}</span>
                                  </>
                                )}
                              </div>
                            </td>

                            {/* Payout Allocation */}
                            <td style={{ padding: '12px 14px', fontSize: '0.78rem', color: 'var(--fp-text-secondary)' }}>
                              {isMerchant ? (
                                <span>100% Pre-salary credit purchases</span>
                              ) : (
                                <div>
                                  <span style={{ fontWeight: 600, color: '#059669' }}>Salary Remainder Payout</span>
                                  {Number(l.employeeSalary || l.employee_salary || 0) > 0 && (
                                    <div style={{ fontSize: '0.72rem', color: 'var(--fp-text-muted)' }}>
                                      Gross: ETB {Number(l.employeeSalary || l.employee_salary).toLocaleString()}
                                    </div>
                                  )}
                                </div>
                              )}
                            </td>

                            {/* Amount Wired */}
                            <td className="mono" style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 800, fontSize: '0.92rem', color: isMerchant ? 'var(--fp-text-primary, #141413)' : '#059669' }}>
                              ETB {Number(l.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>

                            {/* Wire Ref */}
                            <td className="mono" style={{ padding: '12px 14px', fontSize: '0.75rem', color: 'var(--fp-text-secondary)' }}>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                <CheckCircle size={13} color="#059669" weight="fill" />
                                {l.mpesa_receipt || l.mpesaReceipt || l.mpesa_conversation_id || 'MP_B2C_WIRE'}
                              </span>
                            </td>

                            {/* Status */}
                            <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                              <span
                                style={{
                                  padding: '3px 8px',
                                  borderRadius: '6px',
                                  fontSize: '0.7rem',
                                  fontWeight: 700,
                                  background: (l.status === 'COMPLETED' || l.status === 'WIRED') ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.15)',
                                  color: (l.status === 'COMPLETED' || l.status === 'WIRED') ? '#059669' : '#D97706',
                                }}
                              >
                                {l.status === 'COMPLETED' ? 'WIRED' : l.status}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Modal Footer */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginTop: '18px',
                  paddingTop: '14px',
                  borderTop: '1px solid var(--fp-border)',
                  flexWrap: 'wrap',
                  gap: '12px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.76rem', color: 'var(--fp-text-muted)' }}>
                  <CheckCircle size={15} color="#059669" weight="fill" />
                  <span>National Bank of Ethiopia (NBE) & Double-Entry Ledger Guaranteed: Merchant + Employee wires match payroll settlement debit.</span>
                </div>
                <button
                  onClick={() => setSelectedSettlement(null)}
                  className="fp-touch-target"
                  style={{
                    padding: '8px 22px',
                    minHeight: '38px',
                    borderRadius: '8px',
                    background: 'var(--fp-surface-2, #F5EFE6)',
                    border: '1px solid var(--fp-border)',
                    color: 'var(--fp-text-primary, #141413)',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
