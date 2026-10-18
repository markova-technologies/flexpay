import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { SkeletonDashboard } from '../../components/ui/Skeleton/SkeletonDashboard';

export function MerchantAnalytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get('/merchant/analytics')
      .then((res) => setData(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <SkeletonDashboard />;

  const kpis = data?.kpis || {};
  const creditByOrg = data?.creditByOrg || [];
  const topEmployees = data?.topEmployees || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <div style={{ background: 'var(--bg-surface, #0C1322)', border: '1px solid var(--border, rgba(255, 255, 255, 0.08))', borderRadius: '16px', padding: '20px' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #94A3B8)' }}>Monthly Volume</span>
          <div className="mono" style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--accent-primary, #10B981)', marginTop: '4px' }}>
            ETB {Number(kpis.totalVolume || kpis.totalReceivables || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #64748B)' }}>Pre-salary benefit sales</span>
        </div>

        <div style={{ background: 'var(--bg-surface, #0C1322)', border: '1px solid var(--border, rgba(255, 255, 255, 0.08))', borderRadius: '16px', padding: '20px' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #94A3B8)' }}>Average Ticket Size</span>
          <div className="mono" style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--fp-salary, #F59E0B)', marginTop: '4px' }}>
            ETB {Number(kpis.avgTicket || (kpis.transactionCount ? (kpis.totalReceivables / kpis.transactionCount) : 0)).toFixed(2)}
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #64748B)' }}>Per customer visit</span>
        </div>

        <div style={{ background: 'var(--bg-surface, #0C1322)', border: '1px solid var(--border, rgba(255, 255, 255, 0.08))', borderRadius: '16px', padding: '20px' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #94A3B8)' }}>Split Pay Ratio</span>
          <div className="mono" style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary, #F8FAFC)', marginTop: '4px' }}>
            {kpis.splitRatio || '100%'}
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #64748B)' }}>Credit vs Co-pay</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        <div style={{ background: 'var(--bg-surface, #0C1322)', border: '1px solid var(--border, rgba(255, 255, 255, 0.08))', borderRadius: '16px', padding: '24px' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem' }}>Volume by Employer Organization</h3>
          {creditByOrg.length === 0 ? (
            <p style={{ color: 'var(--text-muted, #64748B)', fontSize: '0.875rem' }}>No organizational data available.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {creditByOrg.map((item, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border, rgba(255, 255, 255, 0.04))' }}>
                  <span style={{ fontSize: '0.9rem', color: 'var(--text-primary, #F8FAFC)' }}>{item.org_name || item.orgName || 'Employer'}</span>
                  <span className="mono" style={{ fontWeight: 700, color: 'var(--accent-primary, #10B981)' }}>
                    ETB {Number(item.total_credit || item.amount || 0).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ background: 'var(--bg-surface, #0C1322)', border: '1px solid var(--border, rgba(255, 255, 255, 0.08))', borderRadius: '16px', padding: '24px' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem' }}>Top Customer Spenders</h3>
          {topEmployees.length === 0 ? (
            <p style={{ color: 'var(--text-muted, #64748B)', fontSize: '0.875rem' }}>No employee transaction rankings recorded.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {topEmployees.map((emp, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border, rgba(255, 255, 255, 0.04))' }}>
                  <div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{emp.employee_name || emp.name || 'Customer'}</div>
                    <div className="mono" style={{ fontSize: '0.75rem', color: 'var(--text-muted, #64748B)' }}>{emp.fp_employee_id || emp.fpId}</div>
                  </div>
                  <span className="mono" style={{ fontWeight: 700 }}>
                    ETB {Number(emp.total_amount || emp.spent || 0).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default MerchantAnalytics;
