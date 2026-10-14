import React from 'react';
import { motion } from 'motion/react';
import { Buildings, DeviceMobile, Sparkle, CheckCircle } from '@phosphor-icons/react';
import { formatETB } from '../../utils/format.js';
import './SplitBar.css';

/**
 * SplitBar: Elevated visual representation of co-funded transaction split.
 * Invariant: benefitETB + coPayETB === totalETB
 * Displays proportion, employer quota share, and salary deduction co-pay.
 */
export default function SplitBar({
  totalETB = 0,
  benefitETB = 0,
  coPayETB = 0,
  employerName = 'Ethio Telecom',
  animated = true,
}) {
  const safeTotal = totalETB > 0 ? totalETB : benefitETB + coPayETB;
  const benefitPct = safeTotal > 0 ? Math.round((benefitETB / safeTotal) * 100) : 0;
  const coPayPct = safeTotal > 0 ? 100 - benefitPct : 0;

  return (
    <div className={`split-bar-card ${animated ? 'split-bar-card--animated' : ''}`}>
      <div className="split-bar-card__header">
        <div className="split-bar-card__title-group">
          <span className="fp-label">Payment Allocation</span>
          <span className="split-bar-card__subtitle">Benefits-First Intelligent Split</span>
        </div>
        <div className="split-bar-card__total-wrapper">
          <span className="split-bar-card__total mono">{formatETB(safeTotal)}</span>
          <span className="split-bar-card__total-badge">100% Total Due</span>
        </div>
      </div>

      {/* Interactive Progress Track */}
      <div
        className="split-bar-track"
        role="progressbar"
        aria-valuemin="0"
        aria-valuemax="100"
        aria-valuenow={benefitPct}
      >
        {benefitETB > 0 && (
          <motion.div
            className="split-bar-segment split-bar-segment--benefit"
            initial={animated ? { width: 0 } : false}
            animate={{ width: `${benefitPct}%` }}
            transition={{ duration: 0.45, ease: [0.23, 1, 0.32, 1] }}
            title={`Employer Benefit: ${formatETB(benefitETB)} (${benefitPct}%)`}
          >
            <div className="split-bar-segment__sheen" />
            {benefitPct >= 18 && (
              <span className="split-bar-segment__label">
                <span className="split-bar-segment__tag">Benefit</span>
                <strong>{benefitPct}%</strong>
              </span>
            )}
          </motion.div>
        )}

        {coPayETB > 0 && (
          <motion.div
            className="split-bar-segment split-bar-segment--salary"
            initial={animated ? { width: 0 } : false}
            animate={{ width: `${coPayPct}%` }}
            transition={{ duration: 0.45, ease: [0.23, 1, 0.32, 1] }}
            title={`Salary-Linked Co-Pay: ${formatETB(coPayETB)} (${coPayPct}%)`}
          >
            <div className="split-bar-segment__sheen" />
            {coPayPct >= 18 && (
              <span className="split-bar-segment__label">
                <span className="split-bar-segment__tag">Co-Pay</span>
                <strong>{coPayPct}%</strong>
              </span>
            )}
          </motion.div>
        )}
      </div>

      {/* Proportional Split Cards */}
      <div className="split-bar-legend">
        {/* Benefit Column */}
        <div className="split-bar-legend__item split-bar-legend__item--benefit">
          <div className="split-bar-legend__icon-box split-bar-legend__icon-box--benefit">
            <Buildings size={16} weight="duotone" />
          </div>
          <div className="split-bar-legend__info">
            <div className="split-bar-legend__top">
              <span className="split-bar-legend__title">{employerName}</span>
              <span className="split-bar-legend__share split-bar-legend__share--benefit">{benefitPct}%</span>
            </div>
            <span className="split-bar-legend__amount mono">{formatETB(benefitETB)}</span>
            <span className="split-bar-legend__caption">Employer Subsidized</span>
          </div>
        </div>

        {/* Co-Pay Column */}
        <div className="split-bar-legend__item split-bar-legend__item--salary">
          <div className="split-bar-legend__icon-box split-bar-legend__icon-box--salary">
            <DeviceMobile size={16} weight="duotone" />
          </div>
          <div className="split-bar-legend__info">
            <div className="split-bar-legend__top">
              <span className="split-bar-legend__title">Salary-Linked (M-PESA)</span>
              <span className="split-bar-legend__share split-bar-legend__share--salary">{coPayPct}%</span>
            </div>
            <span className="split-bar-legend__amount mono">{formatETB(coPayETB)}</span>
            <span className="split-bar-legend__caption">Pre-authorized Co-Pay</span>
          </div>
        </div>
      </div>

      {/* Verification Formula Footer */}
      <div className="split-bar-card__footer">
        <CheckCircle size={14} weight="fill" className="split-bar-card__verified-icon" />
        <span>Balanced Allocation: {formatETB(benefitETB)} + {formatETB(coPayETB)} = {formatETB(safeTotal)}</span>
      </div>
    </div>
  );
}
