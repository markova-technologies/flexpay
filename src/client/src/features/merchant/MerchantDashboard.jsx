import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import { SkeletonDashboard } from '../../components/ui/Skeleton/SkeletonDashboard';

export function MerchantDashboard({ onNavigateToPos }) {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get('/merchant/dashboard')
      .then((res) => setData(res.data))
      .catch((err) => toast.error('Failed to load merchant dashboard metrics'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <SkeletonDashboard />;

  const receivables = data?.receivablesSummary || data?.summary || {};
  const recent = data?.recentTransactions || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <div style={{ background: 'var(--bg-surface, #0C1322)', border: '1px solid var(--border, rgba(255, 255, 255, 0.08))', borderRadius: '16px', padding: '20px' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #94A3B8)' }}>Total Receivables Pending</span>
          <div className="mono" style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--accent-primary, #10B981)', marginTop: '4px' }}>
            ETB {Number(receivables.totalReceivables || receivables.totalDue || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #64748B)' }}>From corporate employers</span>
        </div>

        <div style={{ background: 'var(--bg-surface, #0C1322)', border: '1px solid var(--border, rgba(255, 255, 255, 0.08))', borderRadius: '16px', padding: '20px' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #94A3B8)' }}>Partner Organizations</span>
          <div className="mono" style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '4px', color: 'var(--text-primary, #F8FAFC)' }}>
            {data?.partnerOrgCount || data?.breakdownByOrg?.length || 0}
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #64748B)' }}>Active billing partnerships</span>
        </div>

        <div style={{ background: 'var(--bg-surface, #0C1322)', border: '1px solid var(--border, rgba(255, 255, 255, 0.08))', borderRadius: '16px', padding: '20px' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #94A3B8)' }}>Today's POS Sales</span>
          <div className="mono" style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--fp-salary, #F59E0B)', marginTop: '4px' }}>
            ETB {Number(data?.todayTotal || receivables.todaySales || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #64748B)' }}>Live POS counter</span>
        </div>

        <div style={{ background: 'var(--bg-surface, #0C1322)', border: '1px solid var(--border, rgba(255, 255, 255, 0.08))', borderRadius: '16px', padding: '20px' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #94A3B8)' }}>Total Transactions</span>
          <div className="mono" style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '4px', color: 'var(--text-primary, #F8FAFC)' }}>
            {recent.length || receivables.transactionCount || 0}
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #64748B)' }}>Successful checkouts</span>
        </div>
      </div>

      {onNavigateToPos && (
        <div style={{ background: 'var(--bg-surface, #0C1322)', border: '1px solid var(--border, rgba(255, 255, 255, 0.08))', borderRadius: '16px', padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: '0 0 6px 0', fontSize: '1.15rem' }}>POS Terminal Ready</h3>
            <p style={{ margin: 0, color: 'var(--text-secondary, #94A3B8)', fontSize: '0.875rem' }}>
              Verify customer employee QR codes or accept FP-ID manual checkout at cashier.
            </p>
          </div>
          <button
            type="button"
            className="btn btn--primary"
            onClick={onNavigateToPos}
            style={{ padding: '12px 24px', borderRadius: '8px', fontWeight: 700, cursor: 'pointer' }}
          >
            Open POS Scanner →
          </button>
        </div>
      )}

      <div style={{ background: 'var(--bg-surface, #0C1322)', border: '1px solid var(--border, rgba(255, 255, 255, 0.08))', borderRadius: '16px', padding: '24px' }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem' }}>Recent In-Store Purchases</h3>
        {recent.length === 0 ? (
          <p style={{ color: 'var(--text-muted, #64748B)', fontSize: '0.875rem' }}>No recent customer transactions recorded.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border, rgba(255, 255, 255, 0.08))', color: 'var(--text-muted, #64748B)', textAlign: 'left' }}>
                <th style={{ padding: '10px 12px' }}>Date</th>
                <th style={{ padding: '10px 12px' }}>Reference</th>
                <th style={{ padding: '10px 12px' }}>Customer</th>
                <th style={{ padding: '10px 12px' }}>Employer</th>
                <th style={{ padding: '10px 12px', textAlign: 'right' }}>Total</th>
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
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default MerchantDashboard;
