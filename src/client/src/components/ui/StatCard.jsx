import React from 'react';
import './StatCard.css';

/**
 * StatCard for financial metric display.
 * @param {string} label - Top label (e.g. "Available Benefit")
 * @param {string} value - Formatted value or number
 * @param {string} sub - Secondary text (e.g. "of ETB 3,000.00 allowance")
 * @param {React.Component} icon - Icon component
 * @param {string} accent - 'benefit' | 'salary' | 'success' | 'default'
 */
export default function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  accent = 'default',
}) {
  return (
    <div className={`stat-card stat-card--${accent}`}>
      <div className="stat-card__top">
        <span className="fp-label">{label}</span>
        {Icon && (
          <div className="stat-card__icon">
            <Icon size={18} weight="regular" />
          </div>
        )}
      </div>
      <div className="stat-card__value mono fp-tabular-nums">{value}</div>
      {sub && <div className="stat-card__sub">{sub}</div>}
    </div>
  );
}
