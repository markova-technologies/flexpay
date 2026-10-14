import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CalendarBlank,
  CreditCard,
  CheckCircle,
  Clock,
  ShieldCheck,
  ArrowLeft,
  Receipt,
  Sparkle,
} from '@phosphor-icons/react';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { api } from '../../api/client.js';
import Button from '../../components/ui/Button.jsx';
import { formatETB } from '../../utils/format.js';

export default function RepaymentPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const employeeId = user?.entityId || 'emp-001';

  const [account, setAccount] = useState(null);
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [emp, acct] = await Promise.all([
          api.getEmployee(employeeId).catch(() => null),
          api.getBenefitAccount(employeeId).catch(() => null),
        ]);
        setEmployee(emp || { name: user?.name, employerName: 'Ethio Telecom' });
        setAccount(acct);
      } catch (err) {
        console.error('Failed to load repayment schedule:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [employeeId, user]);

  const outstandingETB = account?.usedSalaryLinkETB || 500;
  const limitETB = account?.salaryLinkLimitETB || 2000;
  const availableETB = account?.availableSalaryLinkETB || 1500;

  return (
    <div className="emp-dashboard fp-page-enter" style={{ maxWidth: '840px', margin: '0 auto', gap: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <Button variant="ghost" onClick={() => navigate(-1)} icon={ArrowLeft}>
          Back
        </Button>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--fp-text-primary)' }}>
          Salary Deduction & Repayment Schedule
        </h1>
      </div>

      {/* Hero Overview */}
      <div style={{
        background: 'var(--fp-surface-1)',
        border: '1px solid var(--fp-border-strong)',
        borderRadius: 'var(--fp-r-xl)',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--fp-salary)' }}>
              Total Outstanding Balance
            </span>
            <div className="fp-tabular-nums" style={{ fontSize: '2.25rem', fontWeight: 800, color: 'var(--fp-text-primary)', marginTop: '4px' }}>
              {formatETB(outstandingETB)}
            </div>
            <p style={{ fontSize: '0.875rem', color: 'var(--fp-text-muted)', marginTop: '4px' }}>
              Pre-authorized payroll deduction scheduled for <strong>October 31, 2026</strong>
            </p>
          </div>

          <div style={{
            padding: '12px 18px',
            borderRadius: 'var(--fp-r-md)',
            background: 'var(--fp-surface-2)',
            border: '1px solid var(--fp-border)',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
          }}>
            <span style={{ fontSize: '0.6875rem', color: 'var(--fp-text-muted)', textTransform: 'uppercase' }}>
              Line of Credit Status
            </span>
            <span style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--fp-text-primary)' }}>
              {formatETB(availableETB)} Available
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--fp-benefit)' }}>
              {formatETB(limitETB)} approved limit
            </span>
          </div>
        </div>

        {/* Integration proof */}
        <div style={{
          padding: '12px 16px',
          borderRadius: 'var(--fp-r-md)',
          background: 'rgba(16, 185, 129, 0.08)',
          border: '1px solid rgba(16, 185, 129, 0.25)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}>
          <ShieldCheck size={24} weight="fill" color="var(--fp-benefit)" />
          <div style={{ fontSize: '0.8125rem', color: 'var(--fp-text-secondary)' }}>
            <strong>Payroll Synchronized:</strong> Integrated with {employee?.employerName || 'Ethio Telecom'} SAP / HR Payroll system. No manual transfer required.
          </div>
        </div>
      </div>

      {/* Schedule Table */}
      <div style={{
        background: 'var(--fp-surface-1)',
        border: '1px solid var(--fp-border)',
        borderRadius: 'var(--fp-r-lg)',
        overflow: 'hidden',
      }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--fp-border)' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--fp-text-primary)' }}>
            Deduction Lifecycle
          </h2>
        </div>

        <table className="emp-tx-table">
          <thead>
            <tr>
              <th>Cycle Date</th>
              <th>Type</th>
              <th>Description</th>
              <th>Amount</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <div style={{ fontWeight: 600, color: 'var(--fp-text-primary)' }}>Oct 31, 2026</div>
                <span style={{ fontSize: '0.75rem', color: 'var(--fp-text-muted)' }}>Month-End Payroll</span>
              </td>
              <td>Payroll Automated</td>
              <td>October Salary-Linked Co-Pay Settlement</td>
              <td className="fp-tabular-nums" style={{ fontWeight: 700, color: 'var(--fp-salary)' }}>
                {formatETB(outstandingETB)}
              </td>
              <td>
                <span style={{
                  padding: '3px 8px',
                  borderRadius: '4px',
                  background: 'var(--fp-salary-dim)',
                  color: 'var(--fp-salary)',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                }}>
                  SCHEDULED
                </span>
              </td>
            </tr>
            <tr>
              <td>
                <div style={{ fontWeight: 600, color: 'var(--fp-text-primary)' }}>Sep 30, 2026</div>
                <span style={{ fontSize: '0.75rem', color: 'var(--fp-text-muted)' }}>Month-End Payroll</span>
              </td>
              <td>Payroll Automated</td>
              <td>September Salary-Linked Co-Pay Settlement</td>
              <td className="fp-tabular-nums" style={{ fontWeight: 700, color: 'var(--fp-benefit)' }}>
                {formatETB(1200)}
              </td>
              <td>
                <span style={{
                  padding: '3px 8px',
                  borderRadius: '4px',
                  background: 'var(--fp-benefit-dim)',
                  color: 'var(--fp-benefit)',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                }}>
                  SETTLED
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
