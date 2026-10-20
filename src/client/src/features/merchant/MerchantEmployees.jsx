import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { SkeletonTable } from '../../components/ui/Skeleton/SkeletonTable';

export function MerchantEmployees() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get('/merchant/dashboard')
      .then((res) => {
        const txns = res.data?.recentTransactions || [];
        const empMap = new Map();
        for (const t of txns) {
          const key = t.employee_id || t.employee_fp_id_snapshot;
          if (!key) continue;
          const prev = empMap.get(key) || {
            fpId: t.employee_fp_id_snapshot || 'FP-ETH',
            name: t.employee_name_snapshot || 'Customer',
            orgName: t.org_name_snapshot || 'Employer',
            totalSpent: 0,
            visits: 0,
            lastVisit: t.created_at,
          };
          prev.totalSpent += Number(t.total_amount || 0);
          prev.visits += 1;
          empMap.set(key, prev);
        }
        setEmployees(Array.from(empMap.values()));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <SkeletonTable rows={5} cols={5} />;

  return (
    <div style={{ background: 'var(--bg-surface, #0C1322)', border: '1px solid var(--border, rgba(255, 255, 255, 0.08))', borderRadius: '16px', padding: 'clamp(16px, 4vw, 24px)', boxSizing: 'border-box' }}>
      <h3 style={{ margin: '0 0 8px 0', fontSize: '1.2rem' }}>Customer Directory</h3>
      <p style={{ margin: '0 0 20px 0', color: 'var(--text-secondary, #94A3B8)', fontSize: '0.875rem' }}>
        Enrolled employees who have visited your point of sale with FlexPay benefits.
      </p>

      {employees.length === 0 ? (
        <p style={{ color: 'var(--text-muted, #64748B)', fontSize: '0.875rem' }}>No customer activity logged yet.</p>
      ) : (
        <div className="fp-table-responsive">
          <table style={{ width: '100%', minWidth: '560px', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border, rgba(255, 255, 255, 0.08))', color: 'var(--text-muted, #64748B)', textAlign: 'left' }}>
                <th style={{ padding: '10px 14px' }}>FP-ID</th>
                <th style={{ padding: '10px 14px' }}>Employee Name</th>
                <th style={{ padding: '10px 14px' }}>Employer</th>
                <th style={{ padding: '10px 14px' }}>Total Visits</th>
                <th style={{ padding: '10px 14px', textAlign: 'right' }}>Lifetime Spend</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((e, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--border, rgba(255, 255, 255, 0.04))' }}>
                  <td className="mono" style={{ padding: '12px 14px', color: 'var(--accent-primary, #10B981)' }}>{e.fpId}</td>
                  <td style={{ padding: '12px 14px', fontWeight: 600 }}>{e.name}</td>
                  <td style={{ padding: '12px 14px', color: 'var(--text-secondary, #94A3B8)' }}>{e.orgName}</td>
                  <td style={{ padding: '12px 14px' }}>{e.visits}</td>
                  <td className="mono" style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700 }}>
                    ETB {Number(e.totalSpent).toFixed(2)}
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

export default MerchantEmployees;
