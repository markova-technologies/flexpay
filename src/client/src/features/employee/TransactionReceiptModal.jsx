import React, { useState } from 'react';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../contexts/ToastContext';
import { downloadReceipt } from '../../utils/download';
import {
  DownloadSimple,
  Printer,
  CheckCircle,
  Clock,
  ShieldCheck,
  ForkKnife,
  FirstAid,
  Bus,
  Lightning,
  ShoppingBag,
  CreditCard,
  Buildings,
} from '@phosphor-icons/react';

export function TransactionReceiptModal({ isOpen, onClose, transaction }) {
  const toast = useToast();
  const [downloading, setDownloading] = useState(false);

  if (!transaction) return null;

  const totalAmount = Number(transaction.total_amount || 0);
  const creditPortion = Number(transaction.credit_portion || 0);
  const copayPortion = Number(transaction.copay_portion || 0);
  const isCompleted = (transaction.status || 'COMPLETED') === 'COMPLETED';
  const fpRef = transaction.fp_transaction_ref || transaction.id;
  const merchantName = transaction.merchant_name_snapshot || 'Certified Partner';
  const merchantTill = transaction.merchant_mpesa_snapshot || 'N/A';
  const category = transaction.category_snapshot || 'GENERAL';
  const orgName = transaction.org_name_snapshot || 'Corporate Employer';
  const empName = transaction.employee_name_snapshot || 'Employee';
  const empFpId = transaction.employee_fp_id_snapshot || 'FP-EMP';
  const mpesaReceipt = transaction.mpesa_receipt;
  const dateStr = transaction.created_at
    ? new Date(transaction.created_at).toLocaleString('en-ET', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : new Date().toLocaleString('en-ET', { dateStyle: 'medium', timeStyle: 'short' });

  const getCategoryIcon = (cat) => {
    switch (cat) {
      case 'FOOD':
      case 'GROCERY':
        return <ForkKnife size={15} color="var(--fp-salary)" />;
      case 'PHARMACY':
      case 'HEALTH':
        return <FirstAid size={15} color="var(--fp-orange)" />;
      case 'TRANSPORT':
        return <Bus size={15} color="#0284C7" />;
      case 'UTILITIES':
        return <Lightning size={15} color="#A855F7" />;
      default:
        return <ShoppingBag size={15} color="var(--fp-text-muted)" />;
    }
  };

  const handleDownloadPdf = async () => {
    setDownloading(true);
    try {
      await downloadReceipt(
        transaction.id,
        `flexpay-receipt-${fpRef.slice(0, 24)}.pdf`
      );
      toast.success('Official PDF transaction receipt downloaded.');
    } catch (err) {
      toast.error('Failed to download transaction receipt PDF.');
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
      title="Official Transaction Receipt"
      maxWidth="540px"
      actions={
        <div style={{ display: 'flex', gap: '10px', width: '100%', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="fp-touch-target"
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
              padding: '0 16px',
              borderRadius: '8px',
              background: 'var(--fp-orange, #FF4D26)',
              color: '#FFFFFF',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.875rem',
              boxShadow: 'var(--fp-shadow-orange)',
            }}
          >
            <DownloadSimple size={18} weight="bold" />
            {downloading ? 'Downloading...' : 'Download PDF Receipt'}
          </button>
          <button
            type="button"
            className="fp-touch-target"
            onClick={handlePrint}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              minHeight: '44px',
              padding: '0 16px',
              borderRadius: '8px',
              background: 'var(--fp-surface-2, #F5EFE6)',
              color: 'var(--fp-text-primary, #141413)',
              border: '1px solid var(--fp-border, rgba(32, 28, 24, 0.08))',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.875rem',
            }}
          >
            <Printer size={18} />
            Print
          </button>
          <button
            type="button"
            className="fp-touch-target"
            onClick={onClose}
            style={{
              minHeight: '44px',
              padding: '0 18px',
              borderRadius: '8px',
              background: 'transparent',
              color: 'var(--fp-text-secondary, #59544E)',
              border: '1px solid var(--fp-border, rgba(32, 28, 24, 0.08))',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.875rem',
            }}
          >
            Close
          </button>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Brand & Verification Top Card */}
        <div
          style={{
            background: 'linear-gradient(135deg, rgba(255, 77, 38, 0.08) 0%, rgba(245, 239, 230, 0.6) 100%)',
            border: '1px solid rgba(255, 77, 38, 0.22)',
            borderRadius: '16px',
            padding: '18px',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              color: isCompleted ? '#059669' : 'var(--fp-salary, #D97706)',
              fontSize: '0.78rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              marginBottom: '6px',
              background: isCompleted ? 'rgba(5, 150, 105, 0.10)' : 'rgba(217, 119, 6, 0.10)',
              padding: '3px 10px',
              borderRadius: '999px',
            }}
          >
            {isCompleted ? <CheckCircle size={15} weight="fill" /> : <Clock size={15} />}
            <span>{isCompleted ? '✓ Purchase Settled' : transaction.status}</span>
          </div>

          <div style={{ fontSize: '0.75rem', color: 'var(--fp-text-muted, #8C857B)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Total Purchase Amount
          </div>

          <div
            className="mono"
            style={{
              fontSize: 'clamp(1.85rem, 5vw, 2.4rem)',
              fontWeight: 800,
              color: 'var(--fp-text-primary, #141413)',
              margin: '4px 0 6px 0',
              lineHeight: 1.1,
            }}
          >
            ETB {totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>

          <div style={{ fontSize: '0.8rem', color: 'var(--fp-text-secondary, #59544E)' }}>
            Cleared at: <strong style={{ color: 'var(--fp-text-primary, #141413)' }}>{merchantName}</strong>
          </div>
        </div>

        {/* SplitEngine Payment Breakdown Card */}
        <div
          style={{
            background: 'var(--fp-surface-2, #F5EFE6)',
            border: '1px solid var(--fp-border, rgba(32, 28, 24, 0.08))',
            borderRadius: '12px',
            padding: '14px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--fp-text-muted, #8C857B)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            SplitEngine™ Payment Allocation
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div
              style={{
                background: 'var(--fp-surface-1, #FFFFFF)',
                border: '1px solid var(--fp-border, rgba(32, 28, 24, 0.08))',
                borderRadius: '8px',
                padding: '10px 12px',
              }}
            >
              <span style={{ fontSize: '0.72rem', color: 'var(--fp-text-muted, #8C857B)', display: 'block' }}>FlexPay Benefit Credit</span>
              <span className="mono" style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--fp-orange, #FF4D26)' }}>
                ETB {creditPortion.toFixed(2)}
              </span>
            </div>

            <div
              style={{
                background: 'var(--fp-surface-1, #FFFFFF)',
                border: '1px solid var(--fp-border, rgba(32, 28, 24, 0.08))',
                borderRadius: '8px',
                padding: '10px 12px',
              }}
            >
              <span style={{ fontSize: '0.72rem', color: 'var(--fp-text-muted, #8C857B)', display: 'block' }}>Safaricom M-PESA Co-Pay</span>
              <span className="mono" style={{ fontSize: '1.05rem', fontWeight: 800, color: copayPortion > 0 ? 'var(--fp-salary, #D97706)' : 'var(--fp-text-muted, #8C857B)' }}>
                ETB {copayPortion.toFixed(2)}
              </span>
            </div>
          </div>

          {copayPortion === 0 && (
            <div style={{ fontSize: '0.75rem', color: '#059669', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
              <CheckCircle size={14} weight="fill" />
              <span>100% Employer Benefit Allowance (Zero Out-of-Pocket)</span>
            </div>
          )}
        </div>

        {/* Transaction Specification Details */}
        <div
          style={{
            background: 'var(--fp-surface-1, #FFFFFF)',
            border: '1px solid var(--fp-border, rgba(32, 28, 24, 0.08))',
            borderRadius: '12px',
            padding: '14px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px', borderBottom: '1px solid var(--fp-border, rgba(32, 28, 24, 0.06))', paddingBottom: '8px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--fp-text-secondary, #59544E)' }}>Transaction Ref</span>
            <span className="mono" style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--fp-text-primary, #141413)' }}>
              {fpRef}
            </span>
          </div>

          {mpesaReceipt && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px', borderBottom: '1px solid var(--fp-border, rgba(32, 28, 24, 0.06))', paddingBottom: '8px' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--fp-text-secondary, #59544E)' }}>M-PESA Co-Pay Receipt</span>
              <span className="mono" style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--fp-salary, #D97706)' }}>
                {mpesaReceipt}
              </span>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--fp-text-secondary, #59544E)' }}>Merchant Partner</span>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--fp-text-primary, #141413)' }}>
              {merchantName}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--fp-text-secondary, #59544E)' }}>Benefit Category</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', fontWeight: 700, color: 'var(--fp-text-primary, #141413)' }}>
              {getCategoryIcon(category)}
              {category}
            </span>
          </div>

          {merchantTill && merchantTill !== 'N/A' && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--fp-text-secondary, #59544E)' }}>Merchant M-PESA Till</span>
              <span className="mono" style={{ fontSize: '0.85rem', color: 'var(--fp-text-primary, #141413)' }}>
                {merchantTill}
              </span>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--fp-text-secondary, #59544E)' }}>Corporate Employer</span>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--fp-text-primary, #141413)' }}>
              {orgName}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--fp-text-secondary, #59544E)' }}>Employee (FP-ID)</span>
            <span className="mono" style={{ fontSize: '0.8rem', color: 'var(--fp-text-secondary, #59544E)' }}>
              {empName} ({empFpId})
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--fp-text-secondary, #59544E)' }}>Transaction Timestamp</span>
            <span style={{ fontSize: '0.8rem', color: 'var(--fp-text-secondary, #59544E)' }}>
              {dateStr}
            </span>
          </div>
        </div>

        {/* Double-Entry Ledger Clearing Guarantee Note */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px',
            background: 'rgba(5, 150, 105, 0.06)',
            border: '1px solid rgba(5, 150, 105, 0.20)',
            borderRadius: '10px',
            padding: '12px',
          }}
        >
          <ShieldCheck size={22} style={{ color: '#059669', flexShrink: 0, marginTop: '2px' }} />
          <div style={{ fontSize: '0.74rem', color: 'var(--fp-text-secondary, #59544E)', lineHeight: 1.45 }}>
            <strong style={{ color: 'var(--fp-text-primary, #141413)', display: 'block', marginBottom: '2px' }}>
              FlexPay Double-Entry Ledger Verified
            </strong>
            Official corporate pre-salary benefit record cleared via National Bank of Ethiopia regulatory guidelines. Authenticated for payroll deduction reconciliation.
          </div>
        </div>
      </div>
    </Modal>
  );
}

export default TransactionReceiptModal;
