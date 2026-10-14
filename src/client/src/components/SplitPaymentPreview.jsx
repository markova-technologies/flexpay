import { ShieldCheck, Sparkle } from '@phosphor-icons/react';
import './SplitPaymentPreview.css';

export default function SplitPaymentPreview({
  orderTotalETB = 2000,
  benefitCoveredETB = 1500,
  employeeCoPayETB = 500,
  benefitCategory = 'FOOD',
  employerName = 'Ethio Telecom',
}) {
  const total = Number(orderTotalETB) || 0;
  const benefit = Number(benefitCoveredETB) || 0;
  const coPay = Number(employeeCoPayETB) || 0;

  const benefitPercent = total > 0 ? Math.round((benefit / total) * 100) : 0;
  const coPayPercent = Math.max(0, 100 - benefitPercent);

  const categoryEmoji = {
    FOOD: '🍽️',
    MEAL: '🍽️',
    TRANSPORT: '🚌',
    HEALTH: '🏥',
  }[benefitCategory.toUpperCase()] || '✨';

  return (
    <div className="fp-split-preview">
      <div className="fp-split-header">
        <div className="fp-split-title">
          <Sparkle size={18} weight="fill" color="var(--fp-benefit)" />
          <span>FlexPay Split Calculation</span>
        </div>
        <div className="fp-split-total-block">
          <span className="fp-split-total-label">Total Order</span>
          <div className="fp-split-total-val fp-tabular-nums">
            {total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB
          </div>
        </div>
      </div>

      {/* Visual stacked allocation bar */}
      <div className="fp-split-stacked-bar">
        {benefitPercent > 0 && (
          <div
            className="fp-split-segment-benefit"
            style={{ width: `${benefitPercent}%` }}
            title={`Benefit: ${benefitPercent}%`}
          />
        )}
        {coPayPercent > 0 && (
          <div
            className="fp-split-segment-salary"
            style={{ width: `${coPayPercent}%` }}
            title={`Co-Pay: ${coPayPercent}%`}
          />
        )}
      </div>

      <div className="fp-split-rows">
        <div className="fp-split-row benefit">
          <div className="fp-split-row-meta">
            <span className="fp-split-row-name">
              {categoryEmoji} {benefitCategory} Benefit ({benefitPercent}%)
            </span>
            <span className="fp-split-row-desc">
              Directly funded by {employerName}
            </span>
          </div>
          <div className="fp-split-row-amount fp-tabular-nums">
            {benefit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB
          </div>
        </div>

        <div className="fp-split-row salary">
          <div className="fp-split-row-meta">
            <span className="fp-split-row-name">
              💳 Employee Co-Pay / PayLater ({coPayPercent}%)
            </span>
            <span className="fp-split-row-desc">
              {coPay > 0 ? 'Authorized via Safaricom M-PESA STK Push' : 'Fully covered by corporate benefit'}
            </span>
          </div>
          <div className="fp-split-row-amount fp-tabular-nums">
            {coPay.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB
          </div>
        </div>
      </div>

      <div className="fp-split-guarantee">
        <ShieldCheck size={18} weight="fill" color="var(--fp-benefit)" />
        <span>Merchant receives single atomic settlement of {total.toLocaleString()} ETB</span>
      </div>
    </div>
  );
}
