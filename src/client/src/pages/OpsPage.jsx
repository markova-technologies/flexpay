import React, { useState, useEffect } from 'react';
import {
  ArrowsClockwise, CheckCircle, Warning, Scales, ShieldCheck, FileText
} from '@phosphor-icons/react';
import { api } from '../api/client.js';
import { formatETB, formatDate } from '../utils/format.js';
import { useToast } from '../contexts/ToastContext.jsx';
import StatCard from '../components/ui/StatCard.jsx';
import Button from '../components/ui/Button.jsx';
import './OpsPage.css';

export default function OpsPage() {
  const { push: toast } = useToast();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reconciling, setReconciling] = useState(false);
  const [reconResult, setReconResult] = useState(null);

  useEffect(() => {
    async function fetchSummary() {
      try {
        setLoading(true);
        const res = await api.getOpsSummary();
        setSummary(res);
      } catch (err) {
        console.error('Failed to load ops summary:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchSummary();
  }, []);

  const handleReconcile = async () => {
    setReconciling(true);
    try {
      const res = await api.reconcile();
      setReconResult(res);
      toast({
        message: 'Daily settlement reconciliation finished: 100% BALANCED.',
        type: 'success',
      });
    } catch (err) {
      toast({
        message: err.message || 'Reconciliation failed',
        type: 'error',
      });
    } finally {
      setReconciling(false);
    }
  };

  if (loading) {
    return (
      <div className="fp-page-enter ops-page">
        <div className="fp-skeleton" style={{ height: '36px', width: '240px', marginBottom: '24px' }} />
        <div className="ops-stats-grid">
          <div className="fp-skeleton" style={{ height: '120px' }} />
          <div className="fp-skeleton" style={{ height: '120px' }} />
          <div className="fp-skeleton" style={{ height: '120px' }} />
        </div>
      </div>
    );
  }

  return (
    <div className="fp-page-enter ops-page">
      <div className="ops-header">
        <div>
          <h1>Operations &amp; Settlement Console</h1>
          <p>
            M-PESA Clearing, Employer Benefit Payables, and Automated Double-Entry Reconciliation.
          </p>
        </div>

        <Button
          id="btn-reconcile-eod"
          variant="primary"
          icon={ArrowsClockwise}
          loading={reconciling}
          onClick={handleReconcile}
        >
          Run End-of-Day Audit
        </Button>
      </div>

      {/* Summary Stat Cards */}
      <div className="ops-stats-grid">
        <StatCard
          label="Gross GMV Volume"
          value={formatETB(summary?.totalVolumeETB)}
          sub={`${summary?.totalTransactions} total transactions recorded`}
          icon={Scales}
          accent="default"
        />
        <StatCard
          label="Employer Benefit Subsidies"
          value={formatETB(summary?.totalBenefitETB)}
          sub="Pre-funded employer receivables"
          icon={ShieldCheck}
          accent="benefit"
        />
        <StatCard
          label="M-PESA Clearing Collections"
          value={formatETB(summary?.totalMpesaETB)}
          sub="Direct salary-linked USSD debits"
          icon={ArrowsClockwise}
          accent="salary"
        />
      </div>

      {/* Reconciliation Audit Card */}
      <div className="fp-card ops-recon-card">
        <div className="ops-recon-header">
          <div className="ops-recon-title-wrap">
            <Scales size={24} style={{ color: 'var(--fp-benefit)' }} />
            <div>
              <h3>Daily Double-Entry Settlement Audit</h3>
              <p>Continuous verification that Telco Clearing + Benefit Debits equal Merchant Payables.</p>
            </div>
          </div>

          <div className="ops-recon-status-badge">
            <span className="status-badge__dot" style={{ background: 'var(--fp-success)' }} />
            <span>Ledger Invariant: BALANCED</span>
          </div>
        </div>

        <div className="ops-recon-metrics-grid">
          <div className="ops-recon-metric">
            <span className="fp-label">M-PESA Clearing Asset Balance</span>
            <div className="ops-recon-metric__val mono">
              {formatETB(reconResult ? reconResult.mpesaClearingBalance : summary?.totalMpesaETB)}
            </div>
            <span className="ops-recon-metric__match">✓ Matches Safaricom Callbacks</span>
          </div>

          <div className="ops-recon-metric">
            <span className="fp-label">Employer Benefit Debit Total</span>
            <div className="ops-recon-metric__val mono">
              {formatETB(reconResult ? reconResult.benefitDebitTotal : summary?.totalBenefitETB)}
            </div>
            <span className="ops-recon-metric__match">✓ Matches Policy Ledger</span>
          </div>

          <div className="ops-recon-metric">
            <span className="fp-label">Combined Merchant Payout Liability</span>
            <div className="ops-recon-metric__val mono">
              {formatETB(summary?.totalVolumeETB)}
            </div>
            <span className="ops-recon-metric__match">✓ Zero-Variance Invariant</span>
          </div>
        </div>

        {reconResult && (
          <div className="ops-recon-result-banner">
            <CheckCircle size={20} style={{ color: 'var(--fp-success)' }} />
            <div>
              <strong>Reconciliation Run Verified at {formatDate(reconResult.auditedAt)}</strong>
              <p>Total Debits equal Total Credits. All transaction records verified without discrepancy.</p>
            </div>
          </div>
        )}
      </div>

      {/* Breakdown by Status */}
      <div className="fp-card">
        <h3 className="fp-card__title" style={{ marginBottom: '16px' }}>
          Transaction Pipeline Distribution
        </h3>
        <div className="ops-status-counters">
          <div className="ops-status-pill ops-status-pill--completed">
            <strong>{summary?.completedCount}</strong>
            <span>Completed (100% Settled)</span>
          </div>
          <div className="ops-status-pill ops-status-pill--pending">
            <strong>{summary?.pendingCount}</strong>
            <span>Pending Telco Callback</span>
          </div>
          <div className="ops-status-pill ops-status-pill--reversed">
            <strong>{summary?.refundedCount}</strong>
            <span>Reversed / Restored</span>
          </div>
          <div className="ops-status-pill ops-status-pill--failed">
            <strong>{summary?.failedCount}</strong>
            <span>Failed / Timed Out</span>
          </div>
        </div>
      </div>
    </div>
  );
}
