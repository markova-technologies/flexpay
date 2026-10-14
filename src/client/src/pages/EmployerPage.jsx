import React, { useState } from 'react';
import {
  Buildings, Users, CurrencyCircleDollar, CheckSquare, Sparkle
} from '@phosphor-icons/react';
import { formatETB } from '../utils/format.js';
import StatCard from '../components/ui/StatCard.jsx';
import Button from '../components/ui/Button.jsx';
import './EmployerPage.css';

const DEMO_EMPLOYEES_LIST = [
  { id: 'emp-001', name: 'Abebe Kebede', phone: '251912345678', department: 'Engineering', totalAllowance: 3000, usedAllowance: 1500, salaryLinkUsed: 500 },
  { id: 'emp-002', name: 'Sara Haile', phone: '251911987654', department: 'Operations', totalAllowance: 2000, usedAllowance: 2000, salaryLinkUsed: 0 },
  { id: 'emp-003', name: 'Dawit Tadesse', phone: '251911223344', department: 'Finance', totalAllowance: 3000, usedAllowance: 750, salaryLinkUsed: 250 },
  { id: 'emp-004', name: 'Marta Bekele', phone: '251911556677', department: 'Legal', totalAllowance: 3000, usedAllowance: 0, salaryLinkUsed: 0 },
];

export default function EmployerPage() {
  const [categories, setCategories] = useState({
    GROCERY: true,
    MEAL: true,
    TRANSPORT: true,
    ELECTRONICS: false,
    ENTERTAINMENT: false,
  });

  const toggleCategory = (cat) => {
    setCategories((prev) => ({ ...prev, [cat]: !prev[cat] }));
  };

  return (
    <div className="fp-page-enter employer-page">
      <div className="employer-header">
        <div>
          <h1>Employer Benefits Console</h1>
          <p>
            Ethio Telecom Corporate Benefit Program &middot; Policy rules, allowance pools, and employee allocations.
          </p>
        </div>
      </div>

      {/* Program Summary Stats */}
      <div className="employer-stats-grid">
        <StatCard
          label="Total Monthly Allowance Pool"
          value={formatETB(120000)}
          sub="ETB 3,000 allowance &times; 40 employees"
          icon={CurrencyCircleDollar}
          accent="benefit"
        />
        <StatCard
          label="Utilized Benefits This Cycle"
          value={formatETB(42500)}
          sub="35.4% of total allocated pool"
          icon={Sparkle}
          accent="salary"
        />
        <StatCard
          label="Enrolled Staff Members"
          value="40 Active"
          sub="Zero onboarding discrepancies"
          icon={Users}
          accent="success"
        />
      </div>

      <div className="employer-content-grid">
        {/* Left: Employee Directory */}
        <div className="fp-card">
          <div className="fp-card__header">
            <div>
              <h3 className="fp-card__title">Enrolled Employees</h3>
              <p style={{ fontSize: '0.8125rem' }}>Individual allowance balances and salary-linked deductions</p>
            </div>
          </div>

          <div className="employer-table-scroll">
            <table className="employer-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Department</th>
                  <th className="text-right">Available Benefit</th>
                  <th className="text-right">Salary Deduction</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {DEMO_EMPLOYEES_LIST.map((emp) => {
                  const available = emp.totalAllowance - emp.usedAllowance;
                  return (
                    <tr key={emp.id}>
                      <td>
                        <strong>{emp.name}</strong>
                        <span className="employer-phone mono">+{emp.phone}</span>
                      </td>
                      <td>{emp.department}</td>
                      <td className="text-right mono font-semibold" style={{ color: available > 0 ? 'var(--fp-benefit)' : 'var(--fp-danger)' }}>
                        {formatETB(available)}
                      </td>
                      <td className="text-right mono" style={{ color: 'var(--fp-salary)' }}>
                        {formatETB(emp.salaryLinkUsed)}
                      </td>
                      <td>
                        <span className="employer-active-pill">Active</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Policy Controls */}
        <div className="employer-policy-col">
          <div className="fp-card fp-card--elevated">
            <h3 className="fp-card__title" style={{ marginBottom: '14px' }}>
              Policy Rules &amp; Category Filters
            </h3>
            <p style={{ fontSize: '0.8125rem', marginBottom: '16px' }}>
              Only approved merchant categories are eligible for employer-subsidized point-of-sale checkouts.
            </p>

            <div className="employer-cat-list">
              {Object.entries(categories).map(([cat, enabled]) => (
                <div key={cat} className="employer-cat-item">
                  <div>
                    <strong>{cat}</strong>
                    <span className="employer-cat-sub">
                      {enabled ? 'Covered under benefits' : 'Excluded from benefits'}
                    </span>
                  </div>
                  <button
                    type="button"
                    className={`employer-cat-toggle ${enabled ? 'employer-cat-toggle--on' : ''}`}
                    onClick={() => toggleCategory(cat)}
                    role="switch"
                    aria-checked={enabled}
                  >
                    <span className="employer-cat-toggle__knob" />
                  </button>
                </div>
              ))}
            </div>

            <div className="employer-policy-caps">
              <div className="employer-policy-row">
                <span>Monthly Allowance Cap:</span>
                <strong className="mono">{formatETB(3000)}</strong>
              </div>
              <div className="employer-policy-row">
                <span>Salary-Link Overdraft Limit:</span>
                <strong className="mono">{formatETB(2000)}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
