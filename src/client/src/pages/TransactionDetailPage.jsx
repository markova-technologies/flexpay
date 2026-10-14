import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ArrowsClockwise, ShieldCheck, Receipt, WarningCircle
} from '@phosphor-icons/react';
import { api } from '../api/client.js';
import { formatETB, formatDate } from '../utils/format.js';
import { useToast } from '../contexts/ToastContext.jsx';
import StatusBadge from '../components/ui/StatusBadge.jsx';
import SplitBar from '../components/ui/SplitBar.jsx';
import LedgerTable from '../components/ui/LedgerTable.jsx';
import Button from '../components/ui/Button.jsx';
import Modal from '../components/ui/Modal.jsx';
import './TransactionDetailPage.css';

export default function TransactionDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { push: toast } = useToast();

  const [transaction, setTransaction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isRefundModalOpen, setIsRefundModalOpen] = useState(false);
  const [refundReason, setRefundReason] = useState('Customer goods exchange');
  const [refundLoading, setRefundLoading] = useState(false);

  useEffect(() => {
    async function fetchDetail() {
      try {
        setLoading(true);
        const tx = await api.getTransactionDetail(id);
        setTransaction(tx);
      } catch (err) {
        console.error('Failed to load transaction detail:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchDetail();
  }, [id]);

  const handleRefundSubmit = async () => {
    if (!refundReason.trim()) {
      toast({ message: 'Please provide a valid refund reason.', type: 'error' });
      return;
    }
    setRefundLoading(true);
    try {
      const res = await api.requestRefund(transaction.id, { reason: refundReason });
      setTransaction((prev) => ({
        ...prev,
        status: res.status,
        refundReason,
      }));
      setIsRefundModalOpen(false);
      toast({
        message: 'Refund reversal initiated. Benefit balance will be restored.',
        type: 'info',
      });
    } catch (err) {
      toast({ message: err.message || 'Refund request failed', type: 'error' });
    } finally {
      setRefundLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="fp-page-enter tx-detail-page">
        <div className="fp-skeleton" style={{ height: '36px', width: '200px', marginBottom: '24px' }} />
        <div className="fp-skeleton" style={{ height: '300px' }} />
      </div>
    );
  }

  if (!transaction) {
    return (
      <div className="fp-page-enter tx-detail-page">
        <Button variant="ghost" icon={ArrowLeft} onClick={() => navigate('/transactions')}>
          Back to Transactions
        </Button>
        <div className="fp-empty">
          <WarningCircle size={48} className="fp-empty__icon" />
          <div className="fp-empty__title">Transaction Not Found</div>
          <div className="fp-empty__body">Could not locate record for ID {id}.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="fp-page-enter tx-detail-page">
      {/* Top Navigation & Actions */}
      <div className="tx-detail-top">
        <Button
          id="btn-back-tx"
          variant="ghost"
          size="sm"
          icon={ArrowLeft}
          onClick={() => navigate('/transactions')}
        >
          Back
        </Button>

        {transaction.status === 'COMPLETED' && (
          <Button
            id="btn-request-refund"
            variant="danger"
            size="sm"
            icon={ArrowsClockwise}
            onClick={() => setIsRefundModalOpen(true)}
          >
            Initiate Refund
          </Button>
        )}
      </div>

      {/* Main Header Card */}
      <div className="fp-card tx-detail-header-card">
        <div className="tx-detail-header-left">
          <div className="tx-detail-badge-row">
            <span className="fp-label">Payment ID: <code className="mono">{transaction.id}</code></span>
            <StatusBadge status={transaction.status} />
          </div>
          <h2>{transaction.merchantName}</h2>
          <p className="tx-detail-meta">
            Order Reference: <code className="mono">{transaction.orderId}</code> &middot; Category: {transaction.merchantCategory} &middot; Recorded on {formatDate(transaction.createdAt)}
          </p>
        </div>

        <div className="tx-detail-header-right">
          <span className="fp-label">Total Amount Settled</span>
          <div className="tx-detail-total mono">{formatETB(transaction.totalETB)}</div>
        </div>
      </div>

      {/* Split Allocation Visual */}
      <div className="tx-detail-split-wrap">
        <SplitBar
          totalETB={transaction.totalETB}
          benefitETB={transaction.benefitETB}
          coPayETB={transaction.mpesaETB}
          employerName="Employer Benefit"
        />
      </div>

      {/* Metadata Grid */}
      <div className="tx-detail-meta-grid">
        <div className="fp-card">
          <span className="fp-label">M-PESA Clearing Reference</span>
          <div className="tx-meta-value mono">{transaction.mpesaReceiptNumber || 'Not Applicable / Zero Co-Pay'}</div>
          <span className="tx-meta-sub">Safaricom Ethiopia Confirmation</span>
        </div>

        <div className="fp-card">
          <span className="fp-label">Settlement Mode</span>
          <div className="tx-meta-value">Dual-Funded Split</div>
          <span className="tx-meta-sub">Employer Benefit + Salary Link</span>
        </div>

        <div className="fp-card">
          <span className="fp-label">Reconciliation Status</span>
          <div className="tx-meta-value" style={{ color: 'var(--fp-success)' }}>
            Balanced &amp; Audited
          </div>
          <span className="tx-meta-sub">Zero-Variance Invariant</span>
        </div>
      </div>

      {/* Refund Note if Applicable */}
      {transaction.refundReason && (
        <div className="tx-refund-banner">
          <ArrowsClockwise size={20} />
          <div>
            <strong>Reversal / Refund Logged</strong>
            <p>Reason: &ldquo;{transaction.refundReason}&rdquo;</p>
          </div>
        </div>
      )}

      {/* Double-Entry Ledger Table */}
      <div className="fp-card">
        <LedgerTable entries={transaction.ledgerEntries} />
      </div>

      {/* Refund Modal */}
      <Modal
        isOpen={isRefundModalOpen}
        onClose={() => setIsRefundModalOpen(false)}
        title="Initiate Transaction Refund"
      >
        <div className="tx-refund-modal-content">
          <p>
            You are requesting a refund for payment <code className="mono">{transaction.id}</code> totaling{' '}
            <strong>{formatETB(transaction.totalETB)}</strong>.
          </p>
          <div className="tx-refund-modal-split">
            <div>
              <span>Employer Benefit Restored:</span>
              <strong className="mono">{formatETB(transaction.benefitETB)}</strong>
            </div>
            <div>
              <span>M-PESA Reversal to Employee:</span>
              <strong className="mono">{formatETB(transaction.mpesaETB)}</strong>
            </div>
          </div>

          <div className="checkout-field" style={{ marginTop: '16px' }}>
            <label htmlFor="input-refund-reason" className="fp-label">
              Reason for Refund
            </label>
            <input
              id="input-refund-reason"
              type="text"
              className="checkout-input"
              value={refundReason}
              onChange={(e) => setRefundReason(e.target.value)}
              placeholder="e.g. Defective merchandise, customer return"
            />
          </div>

          <div className="tx-refund-modal-actions">
            <Button
              variant="secondary"
              onClick={() => setIsRefundModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              id="btn-confirm-refund"
              variant="danger"
              loading={refundLoading}
              onClick={handleRefundSubmit}
            >
              Confirm &amp; Reverse Payment
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
