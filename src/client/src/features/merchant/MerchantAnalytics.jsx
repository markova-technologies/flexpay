import React, { useState, useEffect } from 'react';
import { ChartBar, TrendUp, Buildings, Users, Tag, CurrencyEth, CaretRight } from '@phosphor-icons/react';
import api from '../../services/api';
import { SkeletonDashboard } from '../../components/ui/Skeleton/SkeletonDashboard';

export function MerchantAnalytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get('/merchant/analytics')
      .then((res) => setData(res.data))
      .catch((err) => {
        console.warn('[MerchantAnalytics] Failed to fetch analytics data:', err);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <SkeletonDashboard />;

  const kpis = data?.kpis || {};
  const creditByOrg = data?.creditByOrg || [];
  const topEmployees = data?.topEmployees || [];
  const creditByCategory = data?.creditByCategory || [];

  // Robust metric resolution with full backward/forward compatibility
  const totalVolume = Number(
    kpis.totalVolume !== undefined
      ? kpis.totalVolume
      : (kpis.totalReceivables !== undefined
        ? kpis.totalReceivables
        : (kpis.totalReceivable !== undefined
          ? kpis.totalReceivable
          : (kpis.totalOutstandingReceivables || 0)))
  );

  const txnCount = Number(
    kpis.totalTransactions !== undefined
      ? kpis.totalTransactions
      : (kpis.transactionCount || 0)
  );

  const avgTicket = Number(
    kpis.avgTicket !== undefined
      ? kpis.avgTicket
      : (kpis.avgTicketSize !== undefined
        ? kpis.avgTicketSize
        : (txnCount > 0 ? totalVolume / txnCount : 0))
  );

  const splitRatio = kpis.splitRatio || (
    kpis.totalVolume > 0 && kpis.totalCredit
      ? `${Math.round((Number(kpis.totalCredit) / Number(kpis.totalVolume)) * 100)}%`
      : '100%'
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* KPI Cards Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
        {/* Monthly Volume */}
        <div
          style={{
            background: 'var(--fp-surface-1, var(--bg-surface, #0C1322))',
            border: '1px solid var(--fp-border, rgba(255, 255, 255, 0.08))',
            borderRadius: '18px',
            padding: '22px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxShadow: 'var(--fp-shadow-sm)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--fp-text-secondary, #94A3B8)', fontWeight: 600 }}>
              Monthly Sales Volume
            </span>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'rgba(16, 185, 129, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-primary, #10B981)',
              }}
            >
              <TrendUp size={18} weight="bold" />
            </div>
          </div>
          <div className="mono" style={{ fontSize: 'clamp(1.5rem, 3.5vw, 1.85rem)', fontWeight: 800, color: 'var(--accent-primary, #10B981)', margin: '12px 0 4px 0' }}>
            ETB {totalVolume.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--fp-text-muted, #64748B)' }}>
            Pre-salary benefit purchases & sales
          </span>
        </div>

        {/* Average Ticket Size */}
        <div
          style={{
            background: 'var(--fp-surface-1, var(--bg-surface, #0C1322))',
            border: '1px solid var(--fp-border, rgba(255, 255, 255, 0.08))',
            borderRadius: '18px',
            padding: '22px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxShadow: 'var(--fp-shadow-sm)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--fp-text-secondary, #94A3B8)', fontWeight: 600 }}>
              Average Ticket Size
            </span>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'rgba(245, 158, 11, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--fp-salary, #F59E0B)',
              }}
            >
              <ChartBar size={18} weight="bold" />
            </div>
          </div>
          <div className="mono" style={{ fontSize: 'clamp(1.5rem, 3.5vw, 1.85rem)', fontWeight: 800, color: 'var(--fp-salary, #F59E0B)', margin: '12px 0 4px 0' }}>
            ETB {avgTicket.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--fp-text-muted, #64748B)' }}>
            Per customer visit across {txnCount} transaction(s)
          </span>
        </div>

        {/* Split Pay Ratio */}
        <div
          style={{
            background: 'var(--fp-surface-1, var(--bg-surface, #0C1322))',
            border: '1px solid var(--fp-border, rgba(255, 255, 255, 0.08))',
            borderRadius: '18px',
            padding: '22px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxShadow: 'var(--fp-shadow-sm)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--fp-text-secondary, #94A3B8)', fontWeight: 600 }}>
              Split Pay Coverage
            </span>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'rgba(255, 77, 38, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--fp-orange, #FF4D26)',
              }}
            >
              <Tag size={18} weight="bold" />
            </div>
          </div>
          <div className="mono" style={{ fontSize: 'clamp(1.5rem, 3.5vw, 1.85rem)', fontWeight: 800, color: 'var(--fp-text-primary, #F8FAFC)', margin: '12px 0 4px 0' }}>
            {splitRatio}
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--fp-text-muted, #64748B)' }}>
            Salary credit vs direct co-pay coverage
          </span>
        </div>
      </div>

      {/* Analytics Breakdown Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        {/* Volume by Employer Organization */}
        <div
          style={{
            background: 'var(--fp-surface-1, var(--bg-surface, #0C1322))',
            border: '1px solid var(--fp-border, rgba(255, 255, 255, 0.08))',
            borderRadius: '18px',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            boxShadow: 'var(--fp-shadow-sm)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Buildings size={20} color="var(--accent-primary, #10B981)" weight="bold" />
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>Volume by Employer Organization</h3>
          </div>

          {creditByOrg.length === 0 ? (
            <div style={{ padding: '30px 10px', textAlign: 'center', color: 'var(--fp-text-muted)' }}>
              <p style={{ margin: 0, fontSize: '0.88rem' }}>No organizational transaction data recorded yet.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {creditByOrg.map((item, i) => {
                const orgName = item.orgName || item.org_name || 'Employer Partner';
                const orgAmount = Number(
                  item.totalCredit !== undefined
                    ? item.totalCredit
                    : (item.total_credit !== undefined
                      ? item.total_credit
                      : (item.amount !== undefined
                        ? item.amount
                        : (item.totalOwed !== undefined
                          ? item.totalOwed
                          : (item.totalVolume || 0))))
                );
                const empCount = item.employeeCount || (item.employees ? item.employees.length : null);

                return (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '12px 14px',
                      background: 'var(--fp-surface-2, rgba(255, 255, 255, 0.03))',
                      border: '1px solid var(--fp-border-subtle, rgba(255, 255, 255, 0.04))',
                      borderRadius: '12px',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--fp-text-primary, #F8FAFC)' }}>
                        {orgName}
                      </div>
                      {empCount !== null && (
                        <div style={{ fontSize: '0.74rem', color: 'var(--fp-text-muted, #64748B)', marginTop: '2px' }}>
                          {empCount} active employee shopper(s)
                        </div>
                      )}
                    </div>
                    <span className="mono" style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--accent-primary, #10B981)' }}>
                      ETB {orgAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Top Customer Spenders */}
        <div
          style={{
            background: 'var(--fp-surface-1, var(--bg-surface, #0C1322))',
            border: '1px solid var(--fp-border, rgba(255, 255, 255, 0.08))',
            borderRadius: '18px',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            boxShadow: 'var(--fp-shadow-sm)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users size={20} color="var(--fp-orange, #FF4D26)" weight="bold" />
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>Top Customer Spenders</h3>
          </div>

          {topEmployees.length === 0 ? (
            <div style={{ padding: '30px 10px', textAlign: 'center', color: 'var(--fp-text-muted)' }}>
              <p style={{ margin: 0, fontSize: '0.88rem' }}>No employee purchases recorded yet.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {topEmployees.map((emp, i) => {
                const empName = emp.name || emp.employee_name || 'Customer';
                const empFpId = emp.fpEmployeeId || emp.fp_employee_id || emp.fpId || '';
                const empOrg = emp.orgName || emp.org_name_snapshot || '';
                const empSpent = Number(
                  emp.totalSpent !== undefined
                    ? emp.totalSpent
                    : (emp.total_amount !== undefined
                      ? emp.total_amount
                      : (emp.spent || 0))
                );

                return (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '12px 14px',
                      background: 'var(--fp-surface-2, rgba(255, 255, 255, 0.03))',
                      border: '1px solid var(--fp-border-subtle, rgba(255, 255, 255, 0.04))',
                      borderRadius: '12px',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--fp-text-primary, #F8FAFC)' }}>
                        {empName}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                        {empFpId && (
                          <span className="mono" style={{ fontSize: '0.74rem', color: 'var(--fp-salary, #F59E0B)', fontWeight: 600 }}>
                            {empFpId}
                          </span>
                        )}
                        {empOrg && (
                          <span style={{ fontSize: '0.72rem', color: 'var(--fp-text-muted, #64748B)' }}>
                            • {empOrg}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="mono" style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--fp-text-primary, #F8FAFC)' }}>
                      ETB {empSpent.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Category Breakdown if available */}
      {creditByCategory.length > 0 && (
        <div
          style={{
            background: 'var(--fp-surface-1, var(--bg-surface, #0C1322))',
            border: '1px solid var(--fp-border, rgba(255, 255, 255, 0.08))',
            borderRadius: '18px',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            boxShadow: 'var(--fp-shadow-sm)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Tag size={20} color="var(--fp-salary, #F59E0B)" weight="bold" />
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>Sales by Retail Category</h3>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
            {creditByCategory.map((cat, i) => (
              <div
                key={i}
                style={{
                  padding: '14px',
                  background: 'var(--fp-surface-2, rgba(255, 255, 255, 0.03))',
                  borderRadius: '12px',
                  border: '1px solid var(--fp-border-subtle, rgba(255, 255, 255, 0.04))',
                }}
              >
                <div style={{ fontSize: '0.8rem', color: 'var(--fp-text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.04em' }}>
                  {cat.category || 'Retail'}
                </div>
                <div className="mono" style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--accent-primary, #10B981)', marginTop: '4px' }}>
                  ETB {Number(cat.totalCredit || cat.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--fp-text-muted)', marginTop: '2px' }}>
                  {cat.count || 0} purchase(s)
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default MerchantAnalytics;
