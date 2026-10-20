import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import { SkeletonDashboard } from '../../components/ui/Skeleton/SkeletonDashboard';
import { downloadReceipt, downloadSettlementReceipt } from '../../utils/download';
import { SettlementReceiptModal } from './SettlementReceiptModal';
import { CheckCircle, Clock, Receipt, DownloadSimple } from '@phosphor-icons/react';

export function MerchantDashboard({ onNavigateToPos, onNavigateToSettlements }) {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedSettlement, setSelectedSettlement] = useState(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);

  useEffect(() => {
    api
      .get('/merchant/dashboard')
      .then((res) => setData(res.data))
      .catch(() => toast.error('Failed to load merchant dashboard metrics'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <SkeletonDashboard />;

  const stats = data?.stats || {};
  const receivables = data?.receivablesSummary || data?.summary || {};
  const recent = data?.recentTransactions || [];
  const settlements = data?.recentSettlements || [];
  const receivablesByOrg = data?.receivablesByOrg || [];

  // Live Metrics with zero NaN/undefined fallbacks
  const pendingReceivables = Number(
    stats.totalOutstandingReceivables !== undefined
      ? stats.totalOutstandingReceivables
      : (receivables.totalReceivables || receivables.totalDue || 0)
  );

  const totalSettled = Number(
    stats.totalSettledAmount !== undefined
      ? stats.totalSettledAmount
      : (receivables.totalSettled || 0)
  );

  const partnerOrgs = Number(
    stats.uniqueOrganizations !== undefined
      ? stats.uniqueOrganizations
      : (data?.partnerOrgCount || receivables.partnerOrgCount || receivablesByOrg.length || 0)
  );

  const totalTxnCount = Number(
    stats.totalTransactions !== undefined
      ? stats.totalTransactions
      : (receivables.transactionCount || recent.length || 0)
  );

  const handleDownloadTxnReceipt = async (txnId, ref) => {
    try {
      await downloadReceipt(txnId, `flexpay-receipt-${ref || txnId}.pdf`);
      toast.success('Transaction receipt PDF downloaded.');
    } catch {
      toast.error('Failed to download transaction receipt.');
    }
  };

  const handleOpenSettlementReceipt = (settlement) => {
    setSelectedSettlement(settlement);
    setIsReceiptModalOpen(true);
  };

  const handleDownloadSettlementPdf = async (settlement) => {
    const receiptNo = settlement.mpesaReceipt || settlement.mpesa_receipt || (settlement.id || '').slice(0, 8);
    try {
      await downloadSettlementReceipt(settlement.id, `flexpay-settlement-${receiptNo}.pdf`);
      toast.success('Settlement PDF receipt downloaded.');
    } catch {
      toast.error('Failed to download settlement receipt.');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* 4 Primary Top KPI Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        {/* Card 1: Pending Receivables */}
        <div style={{ background: 'var(--bg-surface, #0C1322)', border: '1px solid var(--border, rgba(255, 255, 255, 0.08))', borderRadius: '16px', padding: '20px' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #94A3B8)' }}>Pending Receivables</span>
          <div className="mono" style={{ fontSize: 'clamp(1.5rem, 4vw, 1.75rem)', fontWeight: 800, color: 'var(--accent-primary, #10B981)', marginTop: '4px' }}>
            ETB {pendingReceivables.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #64748B)' }}>Owed by partner employers</span>
        </div>

        {/* Card 2: Settled Payouts Received */}
        <div style={{ background: 'var(--bg-surface, #0C1322)', border: '1px solid var(--border, rgba(255, 255, 255, 0.08))', borderRadius: '16px', padding: '20px' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #94A3B8)' }}>Settled Payouts Received</span>
          <div className="mono" style={{ fontSize: 'clamp(1.5rem, 4vw, 1.75rem)', fontWeight: 800, color: 'var(--text-primary, #F8FAFC)', marginTop: '4px' }}>
            ETB {totalSettled.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--accent-primary, #10B981)', display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
            <CheckCircle size={13} weight="fill" /> Paid via M-PESA B2C Wire
          </span>
        </div>

        {/* Card 3: Partner Organizations */}
        <div style={{ background: 'var(--bg-surface, #0C1322)', border: '1px solid var(--border, rgba(255, 255, 255, 0.08))', borderRadius: '16px', padding: '20px' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #94A3B8)' }}>Partner Organizations</span>
          <div className="mono" style={{ fontSize: 'clamp(1.5rem, 4vw, 1.75rem)', fontWeight: 800, marginTop: '4px', color: 'var(--text-primary, #F8FAFC)' }}>
            {partnerOrgs}
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #64748B)' }}>Active billing partnerships</span>
        </div>

        {/* Card 4: Total In-Store Transactions */}
        <div style={{ background: 'var(--bg-surface, #0C1322)', border: '1px solid var(--border, rgba(255, 255, 255, 0.08))', borderRadius: '16px', padding: '20px' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #94A3B8)' }}>Total Transactions</span>
          <div className="mono" style={{ fontSize: 'clamp(1.5rem, 4vw, 1.75rem)', fontWeight: 800, marginTop: '4px', color: 'var(--text-primary, #F8FAFC)' }}>
            {totalTxnCount}
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #64748B)' }}>Completed POS checkouts</span>
        </div>
      </div>

      {/* POS Scanner Launcher Banner */}
      {onNavigateToPos && (
        <div style={{ background: 'var(--bg-surface, #0C1322)', border: '1px solid var(--border, rgba(255, 255, 255, 0.08))', borderRadius: '16px', padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h3 style={{ margin: '0 0 4px 0', fontSize: '1.15rem' }}>POS Terminal Ready</h3>
            <p style={{ margin: 0, color: 'var(--text-secondary, #94A3B8)', fontSize: '0.875rem' }}>
              Verify employee customer QR codes or accept FP-ID manual checkout at cashier.
            </p>
          </div>
          <button
            type="button"
            className="btn btn--primary fp-touch-target"
            onClick={onNavigateToPos}
            style={{ padding: '10px 22px', borderRadius: '8px', fontWeight: 700, minHeight: '44px' }}
          >
            Open POS Scanner →
          </button>
        </div>
      )}

      {/* Corporate Payroll Settlements & M-PESA Payout Receipts */}
      <div style={{ background: 'var(--bg-surface, #0C1322)', border: '1px solid var(--border, rgba(255, 255, 255, 0.08))', borderRadius: '16px', padding: 'clamp(16px, 4vw, 24px)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.15rem', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
              <Receipt size={20} style={{ color: 'var(--accent-primary, #10B981)' }} />
              Payroll Settlements & Payout Receipts
            </h3>
            <p style={{ margin: '4px 0 0 0', color: 'var(--text-secondary, #94A3B8)', fontSize: '0.85rem' }}>
              Direct employer settlements wired to your M-PESA till with verifiable receipts.
            </p>
          </div>
          {onNavigateToSettlements && (
            <button
              type="button"
              className="fp-touch-target"
              onClick={onNavigateToSettlements}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--accent-primary, #10B981)',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer',
              }}
            >
              View All Settlements →
            </button>
          )}
        </div>

        {settlements.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '28px 16px', color: 'var(--text-muted, #64748B)', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '12px' }}>
            <p style={{ margin: '0 0 4px 0', fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-secondary, #94A3B8)' }}>
              No corporate settlements processed yet
            </p>
            <p style={{ margin: 0, fontSize: '0.8rem' }}>
              When partner employers run their monthly payroll settlement, funds wire directly to your till and official receipts appear here.
            </p>
          </div>
        ) : (
          <div className="fp-table-responsive">
            <table style={{ width: '100%', minWidth: '640px', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border, rgba(255, 255, 255, 0.08))', color: 'var(--text-muted, #64748B)', textAlign: 'left' }}>
                  <th style={{ padding: '10px 12px' }}>Date</th>
                  <th style={{ padding: '10px 12px' }}>M-PESA Receipt</th>
                  <th style={{ padding: '10px 12px' }}>Paying Employer</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right' }}>Amount Paid</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center' }}>Status</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center' }}>Receipt</th>
                </tr>
              </thead>
              <tbody>
                {settlements.map((s) => {
                  const isComp = (s.status || 'COMPLETED') === 'COMPLETED';
                  const receiptNo = s.mpesaReceipt || s.mpesa_receipt || (s.id || '').slice(0, 8);
                  const dateStr = s.completedAt ? new Date(s.completedAt).toLocaleDateString() : new Date().toLocaleDateString();

                  return (
                    <tr key={s.id} style={{ borderBottom: '1px solid var(--border, rgba(255, 255, 255, 0.04))' }}>
                      <td style={{ padding: '12px' }}>{dateStr}</td>
                      <td className="mono" style={{ padding: '12px', fontWeight: 700, color: 'var(--accent-primary, #10B981)' }}>
                        {receiptNo}
                      </td>
                      <td style={{ padding: '12px', fontWeight: 600 }}>
                        {s.organizationName || s.organization?.name || 'Corporate Employer'}
                      </td>
                      <td className="mono" style={{ padding: '12px', textAlign: 'right', fontWeight: 800, color: 'var(--text-primary, #F8FAFC)' }}>
                        ETB {Number(s.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'center' }}>
                        {isComp ? (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              background: 'rgba(16, 185, 129, 0.1)',
                              color: 'var(--accent-primary, #10B981)',
                              padding: '4px 8px',
                              borderRadius: '6px',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                            }}
                          >
                            <CheckCircle size={14} weight="fill" />
                            WIRED
                          </span>
                        ) : (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              background: 'rgba(245, 158, 11, 0.1)',
                              color: 'var(--fp-salary, #F59E0B)',
                              padding: '4px 8px',
                              borderRadius: '6px',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                            }}
                          >
                            <Clock size={14} />
                            PENDING
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
                          <button
                            type="button"
                            className="fp-touch-target"
                            onClick={() => handleOpenSettlementReceipt(s)}
                            style={{
                              background: 'rgba(16, 185, 129, 0.12)',
                              border: '1px solid rgba(16, 185, 129, 0.3)',
                              color: 'var(--accent-primary, #10B981)',
                              padding: '6px 12px',
                              minHeight: '36px',
                              borderRadius: '6px',
                              fontSize: '0.8rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            View Receipt
                          </button>
                          <button
                            type="button"
                            className="fp-touch-target"
                            onClick={() => handleDownloadSettlementPdf(s)}
                            aria-label="Download Settlement PDF"
                            style={{
                              background: 'rgba(255, 255, 255, 0.05)',
                              border: '1px solid var(--border, rgba(255, 255, 255, 0.08))',
                              color: 'var(--text-secondary, #94A3B8)',
                              padding: '6px 10px',
                              minHeight: '36px',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <DownloadSimple size={15} />
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
      </div>

      {/* Outstanding Receivables by Employer Breakdown */}
      {receivablesByOrg.length > 0 && (
        <div style={{ background: 'var(--bg-surface, #0C1322)', border: '1px solid var(--border, rgba(255, 255, 255, 0.08))', borderRadius: '16px', padding: 'clamp(16px, 4vw, 24px)' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem' }}>Receivables by Partner Organization</h3>
          <div className="fp-table-responsive">
            <table style={{ width: '100%', minWidth: '500px', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border, rgba(255, 255, 255, 0.08))', color: 'var(--text-muted, #64748B)', textAlign: 'left' }}>
                  <th style={{ padding: '10px 12px' }}>Organization</th>
                  <th style={{ padding: '10px 12px' }}>Employees on Credit</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right' }}>Total Outstanding</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center' }}>Settlement Status</th>
                </tr>
              </thead>
              <tbody>
                {receivablesByOrg.map((org) => (
                  <tr key={org.orgId} style={{ borderBottom: '1px solid var(--border, rgba(255, 255, 255, 0.04))' }}>
                    <td style={{ padding: '12px', fontWeight: 600 }}>{org.orgName || 'Corporate Partner'}</td>
                    <td style={{ padding: '12px', color: 'var(--text-secondary, #94A3B8)' }}>{org.employeeCount} employee(s)</td>
                    <td className="mono" style={{ padding: '12px', textAlign: 'right', fontWeight: 700, color: 'var(--accent-primary, #10B981)' }}>
                      ETB {Number(org.totalOwed || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--fp-salary, #F59E0B)', background: 'rgba(245, 158, 11, 0.1)', padding: '3px 8px', borderRadius: '6px', fontWeight: 600 }}>
                        Pending Payroll Run
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent In-Store Purchases */}
      <div style={{ background: 'var(--bg-surface, #0C1322)', border: '1px solid var(--border, rgba(255, 255, 255, 0.08))', borderRadius: '16px', padding: 'clamp(16px, 4vw, 24px)' }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem' }}>Recent In-Store Purchases</h3>
        {recent.length === 0 ? (
          <p style={{ color: 'var(--text-muted, #64748B)', fontSize: '0.875rem' }}>No recent customer transactions recorded.</p>
        ) : (
          <div className="fp-table-responsive">
            <table style={{ width: '100%', minWidth: '600px', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border, rgba(255, 255, 255, 0.08))', color: 'var(--text-muted, #64748B)', textAlign: 'left' }}>
                  <th style={{ padding: '10px 12px' }}>Date</th>
                  <th style={{ padding: '10px 12px' }}>Reference</th>
                  <th style={{ padding: '10px 12px' }}>Customer</th>
                  <th style={{ padding: '10px 12px' }}>Employer</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right' }}>Total</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center' }}>Receipt</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((t) => (
                  <tr key={t.id} style={{ borderBottom: '1px solid var(--border, rgba(255, 255, 255, 0.04))' }}>
                    <td style={{ padding: '12px' }}>{new Date(t.created_at).toLocaleDateString()}</td>
                    <td className="mono" style={{ padding: '12px' }}>{t.fp_transaction_ref || t.id.slice(0, 8)}</td>
                    <td style={{ padding: '12px', fontWeight: 600 }}>{t.employee_name_snapshot || 'Customer'}</td>
                    <td style={{ padding: '12px', color: 'var(--text-secondary, #94A3B8)' }}>{t.org_name_snapshot || 'Corporate Partner'}</td>
                    <td className="mono" style={{ padding: '12px', textAlign: 'right', fontWeight: 700 }}>
                      ETB {Number(t.total_amount).toFixed(2)}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      <button
                        type="button"
                        onClick={() => handleDownloadTxnReceipt(t.id, t.fp_transaction_ref)}
                        className="fp-touch-target"
                        style={{
                          background: 'rgba(255, 255, 255, 0.05)',
                          border: '1px solid var(--border, rgba(255, 255, 255, 0.08))',
                          color: 'var(--text-secondary, #94A3B8)',
                          padding: '4px 10px',
                          borderRadius: '6px',
                          fontSize: '0.75rem',
                          cursor: 'pointer',
                        }}
                      >
                        PDF
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Settlement Payout Receipt Modal */}
      <SettlementReceiptModal
        isOpen={isReceiptModalOpen}
        onClose={() => setIsReceiptModalOpen(false)}
        settlement={selectedSettlement}
      />
    </div>
  );
}

export default MerchantDashboard;
