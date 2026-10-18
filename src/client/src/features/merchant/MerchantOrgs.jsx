import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { SkeletonTable } from '../../components/ui/Skeleton/SkeletonTable';

export function MerchantOrgs() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get('/merchant/dashboard')
      .then((res) => {
        const orgs = res.data?.breakdownByOrg || [];
        setData(orgs);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <SkeletonTable rows={5} cols={4} />;

  return (
    <div style={{ background: 'var(--bg-surface, #0C1322)', border: '1px solid var(--border, rgba(255, 255, 255, 0.08))', borderRadius: '16px', padding: '24px' }}>
      <h3 style={{ margin: '0 0 8px 0', fontSize: '1.2rem' }}>Partner Employers</h3>
      <p style={{ margin: '0 0 20px 0', color: 'var(--text-secondary, #94A3B8)', fontSize: '0.875rem' }}>
        Corporations whose employees are authorized to spend benefits at your store.
      </p>

      {data.length === 0 ? (
        <p style={{ color: 'var(--text-muted, #64748B)', fontSize: '0.875rem' }}>No organization transaction data yet.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border, rgba(255, 255, 255, 0.08))', color: 'var(--text-muted, #64748B)', textAlign: 'left' }}>
              <th style={{ padding: '10px 14px' }}>Organization Name</th>
              <th style={{ padding: '10px 14px' }}>Purchases</th>
              <th style={{ padding: '10px 14px', textAlign: 'right' }}>Total Credit Spent</th>
              <th style={{ padding: '10px 14px', textAlign: 'right' }}>Settlement Status</th>
            </tr>
          </thead>
          <tbody>
            {data.map((org, i) => (
              <tr key={org.orgId || i} style={{ borderBottom: '1px solid var(--border, rgba(255, 255, 255, 0.04))' }}>
                <td style={{ padding: '12px 14px', fontWeight: 600 }}>{org.orgName || 'Employer Partner'}</td>
                <td style={{ padding: '12px 14px' }}>{org.transactionCount || 1}</td>
                <td className="mono" style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--accent-primary, #10B981)' }}>
                  ETB {Number(org.totalAmount || org.totalReceivable || 0).toFixed(2)}
                </td>
                <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                  <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700, background: 'rgba(16, 185, 129, 0.15)', color: 'var(--accent-primary, #10B981)' }}>
                    Active
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default MerchantOrgs;
