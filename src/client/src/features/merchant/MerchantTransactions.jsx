import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import { downloadReceipt } from '../../utils/download';
import { SkeletonTable } from '../../components/ui/Skeleton/SkeletonTable';

export function MerchantTransactions() {
  const toast = useToast();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchTransactions = () => {
    setLoading(true);
    api
      .get('/merchant/transactions?limit=100')
      .then((res) => {
        setTransactions(res.data?.transactions || []);
      })
      .catch(() => {
        // Fallback to dashboard summary
        api
          .get('/merchant/dashboard')
          .then((res) => {
            setTransactions(res.data?.recentTransactions || []);
          })
          .catch(() => toast.error('Failed to load transaction history'));
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchTransactions();
  }, []);

  const handleDownload = async (txnId, ref) => {
    try {
      await downloadReceipt(txnId, `flexpay-receipt-${ref || txnId}.pdf`);
      toast.success('Receipt PDF downloaded successfully.');
    } catch (err) {
      toast.error('Failed to download transaction receipt.');
    }
  };

  if (loading) return <SkeletonTable rows={8} cols={6} />;

  return (
    <div style={{ background: 'var(--bg-surface, #0C1322)', border: '1px solid var(--border, rgba(255, 255, 255, 0.08))', borderRadius: '16px', padding: 'clamp(16px, 4vw, 24px)', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.2rem' }}>Sales Transactions</h3>
          <p style={{ margin: '4px 0 0 0', color: 'var(--text-secondary, #94A3B8)', fontSize: '0.875rem' }}>
            Full ledger of POS and split payment transactions.
          </p>
        </div>
        <button
          type="button"
          onClick={fetchTransactions}
          className="fp-touch-target"
          style={{ background: 'transparent', border: '1px solid var(--border, rgba(255, 255, 255, 0.08))', borderRadius: '8px', padding: '8px 14px', minHeight: '40px', color: 'var(--text-secondary, #94A3B8)', cursor: 'pointer', fontSize: '0.85rem' }}
        >
          Refresh
        </button>
      </div>

      {transactions.length === 0 ? (
        <p style={{ color: 'var(--text-muted, #64748B)', fontSize: '0.875rem' }}>No transactions recorded.</p>
      ) : (
        <div className="fp-table-responsive">
          <table style={{ width: '100%', minWidth: '640px', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border, rgba(255, 255, 255, 0.08))', color: 'var(--text-muted, #64748B)', textAlign: 'left' }}>
                <th style={{ padding: '10px 14px' }}>Date</th>
                <th style={{ padding: '10px 14px' }}>Reference</th>
                <th style={{ padding: '10px 14px' }}>Employee</th>
                <th style={{ padding: '10px 14px' }}>Employer</th>
                <th style={{ padding: '10px 14px', textAlign: 'right' }}>Credit Portion</th>
                <th style={{ padding: '10px 14px', textAlign: 'right' }}>Total</th>
                <th style={{ padding: '10px 14px', textAlign: 'center' }}>Receipt</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((t) => (
                <tr key={t.id} style={{ borderBottom: '1px solid var(--border, rgba(255, 255, 255, 0.04))' }}>
                  <td style={{ padding: '12px 14px' }}>{new Date(t.created_at).toLocaleDateString()}</td>
                  <td className="mono" style={{ padding: '12px 14px' }}>{t.fp_transaction_ref || t.id.slice(0, 8)}</td>
                  <td style={{ padding: '12px 14px', fontWeight: 600 }}>{t.employee_name_snapshot || 'Customer'}</td>
                  <td style={{ padding: '12px 14px', color: 'var(--text-secondary, #94A3B8)' }}>{t.org_name_snapshot || 'Employer'}</td>
                  <td className="mono" style={{ padding: '12px 14px', textAlign: 'right', color: 'var(--accent-primary, #10B981)' }}>
                    ETB {Number(t.credit_portion || 0).toFixed(2)}
                  </td>
                  <td className="mono" style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700 }}>
                    ETB {Number(t.total_amount || 0).toFixed(2)}
                  </td>
                  <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                    <button
                      type="button"
                      onClick={() => handleDownload(t.id, t.fp_transaction_ref)}
                      className="fp-touch-target"
                      style={{
                        background: 'rgba(16, 185, 129, 0.1)',
                        border: '1px solid rgba(16, 185, 129, 0.3)',
                        color: 'var(--accent-primary, #10B981)',
                        padding: '6px 12px',
                        minHeight: '36px',
                        borderRadius: '6px',
                        fontSize: '0.8rem',
                        fontWeight: 600,
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
  );
}

export default MerchantTransactions;
