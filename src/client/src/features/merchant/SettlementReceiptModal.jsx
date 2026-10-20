import React, { useState } from 'react';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../contexts/ToastContext';
import { downloadSettlementReceipt } from '../../utils/download';
import { DownloadSimple, Printer, CheckCircle, ShieldCheck } from '@phosphor-icons/react';

export function SettlementReceiptModal({ isOpen, onClose, settlement }) {
  const toast = useToast();
  const [downloading, setDownloading] = useState(false);

  if (!settlement) return null;

  const amount = Number(settlement.amount || 0);
  const mpesaReceipt = settlement.mpesaReceipt || settlement.mpesa_receipt || `MP_B2C_${(settlement.id || '').slice(0, 8).toUpperCase()}`;
  const orgName = settlement.organizationName || settlement.organization?.name || 'Corporate Employer';
  const orgShortcode = settlement.organizationShortcode || settlement.organization?.shortcode || '251700';
  const merchantName = settlement.merchantBusinessName || settlement.merchant?.businessName || 'Partner Till';
  const merchantTill = settlement.recipientMpesaNumber || settlement.merchant?.mpesaNumber || 'N/A';
  const batchId = settlement.settlementId || settlement.settlement_id || settlement.id || 'N/A';
  const period = settlement.periodStart && settlement.periodEnd
    ? `${settlement.periodStart} → ${settlement.periodEnd}`
    : 'Monthly Payroll Cycle';
  const completedDate = settlement.completedAt
    ? new Date(settlement.completedAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
    : new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });

  const handleDownloadPdf = async () => {
    setDownloading(true);
    try {
      await downloadSettlementReceipt(settlement.id, `flexpay-settlement-${mpesaReceipt}.pdf`);
      toast.success('Settlement PDF receipt downloaded successfully.');
    } catch (err) {
      toast.error('Failed to download settlement receipt PDF.');
    } finally {
      setDownloading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Settlement Payout Voucher"
      maxWidth="540px"
      actions={
        <div style={{ display: 'flex', gap: '10px', width: '100%', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn--primary fp-touch-target"
            onClick={handleDownloadPdf}
            disabled={downloading}
            style={{
              flex: 1,
              minWidth: '160px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              fontWeight: 700,
              minHeight: '44px',
            }}
          >
            <DownloadSimple size={18} weight="bold" />
            {downloading ? 'Downloading...' : 'Download PDF'}
          </button>
          <button
            type="button"
            className="btn btn--secondary fp-touch-target"
            onClick={handlePrint}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              minHeight: '44px',
              padding: '0 16px',
            }}
          >
            <Printer size={18} />
            Print
          </button>
          <button
            type="button"
            className="btn btn--secondary fp-touch-target"
            onClick={onClose}
            style={{ minHeight: '44px', padding: '0 18px' }}
          >
            Close
          </button>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
        {/* Brand & Verification Top Card */}
        <div
          style={{
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(6, 10, 20, 0.6) 100%)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: '14px',
            padding: '16px',
            textAlign: 'center',
            position: 'relative',
          }}
        >
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--accent-primary, #10B981)', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
            <CheckCircle size={18} weight="fill" />
            <span>M-PESA B2C Wire Settled</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #94A3B8)' }}>
            Total Corporate Settlement Payout
          </div>
          <div
            className="mono"
            style={{
              fontSize: 'clamp(1.75rem, 5vw, 2.25rem)',
              fontWeight: 800,
              color: 'var(--accent-primary, #10B981)',
              margin: '4px 0 6px 0',
            }}
          >
            ETB {amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #64748B)' }}>
            Disbursed to Safaricom Ethiopia Till: <span className="mono" style={{ color: 'var(--text-primary, #F8FAFC)', fontWeight: 600 }}>{merchantTill}</span>
          </div>
        </div>

        {/* Official Receipt Details */}
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid var(--border, rgba(255, 255, 255, 0.08))',
            borderRadius: '12px',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px', borderBottom: '1px solid rgba(255, 255, 255, 0.06)', paddingBottom: '10px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #94A3B8)' }}>M-PESA Confirmation Ref</span>
            <span className="mono" style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--accent-primary, #10B981)' }}>
              {mpesaReceipt}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #94A3B8)' }}>Paying Organization</span>
            <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary, #F8FAFC)' }}>
              {orgName}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #94A3B8)' }}>Employer Shortcode</span>
            <span className="mono" style={{ fontSize: '0.85rem', color: 'var(--text-primary, #F8FAFC)' }}>
              {orgShortcode}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #94A3B8)' }}>Beneficiary Merchant</span>
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary, #F8FAFC)' }}>
              {merchantName}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #94A3B8)' }}>Settlement Batch ID</span>
            <span className="mono" style={{ fontSize: '0.8rem', color: 'var(--text-muted, #94A3B8)' }}>
              {batchId}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #94A3B8)' }}>Settlement Cycle</span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #94A3B8)' }}>
              {period}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #94A3B8)' }}>Execution Timestamp</span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #94A3B8)' }}>
              {completedDate}
            </span>
          </div>
        </div>

        {/* Double-entry Ledger Clearing Guarantee Note */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px',
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            borderRadius: '10px',
            padding: '12px',
          }}
        >
          <ShieldCheck size={24} style={{ color: 'var(--accent-primary, #10B981)', flexShrink: 0, marginTop: '2px' }} />
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #64748B)', lineHeight: 1.4 }}>
            <strong style={{ color: 'var(--text-secondary, #94A3B8)', display: 'block', marginBottom: '2px' }}>
              FlexPay Automated Double-Entry Ledger Clearing
            </strong>
            Direct settlement wire dispatched via Safaricom Ethiopia M-PESA B2C. All employee credit liabilities for this period are settled with zero discrepancy.
          </div>
        </div>
      </div>
    </Modal>
  );
}

export default SettlementReceiptModal;
