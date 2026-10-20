import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import { SkeletonTable } from '../../components/ui/Skeleton/SkeletonTable';
import { downloadSettlementReceipt } from '../../utils/download';
import { SettlementReceiptModal } from './SettlementReceiptModal';
import { Receipt, DownloadSimple, CheckCircle, Clock } from '@phosphor-icons/react';

export function MerchantSettlements() {
  const toast = useToast();
  const [settlements, setSettlements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSettlement, setSelectedSettlement] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [search, setSearch] = useState('');

  const fetchSettlements = () => {
    setLoading(true);
    api
      .get('/merchant/settlements')
      .then((res) => {
        setSettlements(res.data?.settlements || []);
      })
      .catch(() => toast.error('Failed to load corporate payroll settlements'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchSettlements();
  }, []);

  const handleOpenReceipt = (settlement) => {
    setSelectedSettlement(settlement);
    setIsModalOpen(true);
  };

  const handleDownloadPdf = async (settlement) => {
    const receiptNo = settlement.mpesaReceipt || settlement.mpesa_receipt || (settlement.id || '').slice(0, 8);
    try {
      await downloadSettlementReceipt(settlement.id, `flexpay-settlement-${receiptNo}.pdf`);
      toast.success('Settlement PDF receipt downloaded.');
    } catch {
      toast.error('Failed to download PDF receipt.');
    }
  };

  if (loading) return <SkeletonTable rows={8} cols={6} />;

  const filtered = settlements.filter((s) => {
    const q = search.toLowerCase();
    const org = (s.organizationName || s.organization?.name || '').toLowerCase();
    const rec = (s.mpesaReceipt || s.mpesa_receipt || '').toLowerCase();
    const batch = (s.settlementId || s.settlement_id || '').toLowerCase();
    return org.includes(q) || rec.includes(q) || batch.includes(q);
  });

  const totalSettledSum = settlements.reduce((acc, s) => acc + Number(s.amount || 0), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header & Metrics */}
      <div
        style={{
          background: 'var(--bg-surface, #0C1322)',
          border: '1px solid var(--border, rgba(255, 255, 255, 0.08))',
          borderRadius: '16px',
          padding: 'clamp(16px, 4vw, 24px)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          <h2 style={{ margin: '0 0 6px 0', fontSize: '1.35rem', fontWeight: 800 }}>
            Corporate Payroll Settlements
          </h2>
          <p style={{ margin: 0, color: 'var(--text-secondary, #94A3B8)', fontSize: '0.875rem' }}>
            Official wire payouts from employer payroll deduction runs, settled directly to your M-PESA till.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: '12px', padding: '10px 18px' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #94A3B8)', display: 'block' }}>Total Payouts Settled</span>
            <span className="mono" style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--accent-primary, #10B981)' }}>
              ETB {totalSettledSum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>

          <button
            type="button"
            className="btn btn--secondary fp-touch-target"
            onClick={fetchSettlements}
            style={{ minHeight: '44px', padding: '0 18px', fontWeight: 600 }}
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Search Input */}
      <div style={{ display: 'flex', gap: '12px' }}>
        <input
          type="text"
          className="fp-touch-target"
          placeholder="Search by employer name, M-PESA receipt, or batch ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            flex: 1,
            background: 'var(--bg-surface, #0C1322)',
            border: '1px solid var(--border, rgba(255, 255, 255, 0.08))',
            borderRadius: '10px',
            padding: '12px 16px',
            color: 'var(--text-primary, #F8FAFC)',
            fontSize: '0.9rem',
            outline: 'none',
          }}
        />
      </div>

      {/* Settlements Table */}
      <div
        style={{
          background: 'var(--bg-surface, #0C1322)',
          border: '1px solid var(--border, rgba(255, 255, 255, 0.08))',
          borderRadius: '16px',
          padding: 'clamp(16px, 4vw, 24px)',
        }}
      >
        {settlements.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--text-muted, #64748B)' }}>
            <Receipt size={48} style={{ opacity: 0.4, marginBottom: '12px' }} />
            <p style={{ margin: '0 0 6px 0', fontSize: '1rem', fontWeight: 600, color: 'var(--text-secondary, #94A3B8)' }}>
              No corporate settlements processed yet
            </p>
            <p style={{ margin: 0, fontSize: '0.85rem', maxWidth: '420px', marginLeft: 'auto', marginRight: 'auto' }}>
              When partner organizations execute monthly payroll clearing runs, funds are wired automatically to your M-PESA till with verifiable digital receipts.
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <p style={{ color: 'var(--text-muted, #64748B)', textAlign: 'center', padding: '24px' }}>
            No settlements match your search criteria.
          </p>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="merchant-table-desktop fp-table-responsive">
              <table style={{ width: '100%', minWidth: '700px', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border, rgba(255, 255, 255, 0.08))', color: 'var(--text-muted, #64748B)', textAlign: 'left' }}>
                    <th style={{ padding: '12px 14px' }}>Settled Date</th>
                    <th style={{ padding: '12px 14px' }}>M-PESA Receipt</th>
                    <th style={{ padding: '12px 14px' }}>Paying Employer</th>
                    <th style={{ padding: '12px 14px' }}>Cycle</th>
                    <th style={{ padding: '12px 14px', textAlign: 'right' }}>Amount Paid</th>
                    <th style={{ padding: '12px 14px', textAlign: 'center' }}>Status</th>
                    <th style={{ padding: '12px 14px', textAlign: 'center' }}>Receipt</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s) => {
                    const isComp = (s.status || 'COMPLETED') === 'COMPLETED';
                    const receiptNo = s.mpesaReceipt || s.mpesa_receipt || (s.id || '').slice(0, 8);
                    const dateStr = s.completedAt ? new Date(s.completedAt).toLocaleDateString() : new Date().toLocaleDateString();

                    return (
                      <tr key={s.id} style={{ borderBottom: '1px solid var(--border, rgba(255, 255, 255, 0.04))' }}>
                        <td style={{ padding: '14px' }}>{dateStr}</td>
                        <td className="mono" style={{ padding: '14px', fontWeight: 700, color: 'var(--accent-primary, #10B981)' }}>
                          {receiptNo}
                        </td>
                        <td style={{ padding: '14px', fontWeight: 600 }}>
                          {s.organizationName || s.organization?.name || 'Corporate Employer'}
                        </td>
                        <td style={{ padding: '14px', color: 'var(--text-secondary, #94A3B8)', fontSize: '0.8rem' }}>
                          {s.periodStart ? `${s.periodStart.slice(5)} → ${s.periodEnd.slice(5)}` : 'Monthly'}
                        </td>
                        <td className="mono" style={{ padding: '14px', textAlign: 'right', fontWeight: 800, color: 'var(--text-primary, #F8FAFC)', fontSize: '0.95rem' }}>
                          ETB {Number(s.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: '14px', textAlign: 'center' }}>
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
                        <td style={{ padding: '14px', textAlign: 'center' }}>
                          <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
                            <button
                              type="button"
                              className="fp-touch-target"
                              onClick={() => handleOpenReceipt(s)}
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
                              onClick={() => handleDownloadPdf(s)}
                              aria-label="Download PDF Receipt"
                              style={{
                                background: 'rgba(255, 255, 255, 0.05)',
                                border: '1px solid var(--border, rgba(255, 255, 255, 0.08))',
                                color: 'var(--text-secondary, #94A3B8)',
                                padding: '6px 10px',
                                minHeight: '36px',
                                borderRadius: '6px',
                                fontSize: '0.8rem',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <DownloadSimple size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View */}
            <div className="merchant-cards-mobile">
              {filtered.map((s) => {
                const isComp = (s.status || 'COMPLETED') === 'COMPLETED';
                const receiptNo = s.mpesaReceipt || s.mpesa_receipt || (s.id || '').slice(0, 8);
                const dateStr = s.completedAt ? new Date(s.completedAt).toLocaleDateString() : new Date().toLocaleDateString();

                return (
                  <div key={s.id} className="merchant-card-item">
                    <div className="merchant-card-item__header">
                      <div>
                        <div className="merchant-card-item__title">
                          {s.organizationName || s.organization?.name || 'Corporate Employer'}
                        </div>
                        <div className="merchant-card-item__sub">{dateStr} • {s.periodStart ? `${s.periodStart.slice(5)} → ${s.periodEnd.slice(5)}` : 'Monthly'}</div>
                      </div>
                      {isComp ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--accent-primary, #10B981)', padding: '3px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700 }}>
                          <CheckCircle size={13} weight="fill" /> WIRED
                        </span>
                      ) : (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(245, 158, 11, 0.1)', color: 'var(--fp-salary, #F59E0B)', padding: '3px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700 }}>
                          <Clock size={13} /> PENDING
                        </span>
                      )}
                    </div>

                    <div className="merchant-card-item__meta">
                      <div>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted, #64748B)', display: 'block', textTransform: 'uppercase' }}>M-PESA Receipt</span>
                        <span className="mono" style={{ fontWeight: 700, color: 'var(--accent-primary, #10B981)', fontSize: '0.85rem' }}>{receiptNo}</span>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted, #64748B)', display: 'block', textTransform: 'uppercase' }}>Amount Paid</span>
                        <span className="mono merchant-card-item__amount">
                          ETB {Number(s.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>

                    <div className="merchant-card-item__actions">
                      <button
                        type="button"
                        className="fp-touch-target"
                        onClick={() => handleOpenReceipt(s)}
                        style={{
                          flex: 1,
                          background: 'rgba(16, 185, 129, 0.12)',
                          border: '1px solid rgba(16, 185, 129, 0.3)',
                          color: 'var(--accent-primary, #10B981)',
                          padding: '8px 14px',
                          minHeight: '40px',
                          borderRadius: '8px',
                          fontSize: '0.82rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        View Receipt
                      </button>
                      <button
                        type="button"
                        className="fp-touch-target"
                        onClick={() => handleDownloadPdf(s)}
                        aria-label="Download Settlement PDF"
                        style={{
                          background: 'rgba(255, 255, 255, 0.05)',
                          border: '1px solid var(--border, rgba(255, 255, 255, 0.08))',
                          color: 'var(--text-secondary, #94A3B8)',
                          padding: '8px 14px',
                          minHeight: '40px',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          fontSize: '0.82rem',
                        }}
                      >
                        <DownloadSimple size={15} />
                        <span>PDF</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Digital Receipt Modal */}
      <SettlementReceiptModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        settlement={selectedSettlement}
      />
    </div>
  );
}

export default MerchantSettlements;
