import './BenefitWalletCard.css';

const CATEGORY_META = {
  FOOD: { label: 'Food & Meals', icon: '🍽️', colorClass: 'food' },
  TRANSPORT: { label: 'Transport & Commute', icon: '🚌', colorClass: 'transport' },
  HEALTH: { label: 'Health & Pharmacy', icon: '🏥', colorClass: 'health' },
  PAYLATER: { label: 'Salary PayLater', icon: '💳', colorClass: 'paylater' },
};

export default function BenefitWalletCard({
  category = 'FOOD',
  monthlyLimitETB = 2000,
  usedETB = 500,
  availableETB = 1500,
  utilizationRate = 25,
  cycleResetDate = 'Oct 31, 2026',
}) {
  const normCategory = String(category).toUpperCase();
  const meta = CATEGORY_META[normCategory] || { label: normCategory, icon: '🏷️', colorClass: 'food' };

  const safeLimit = Number(monthlyLimitETB) || 0;
  const safeUsed = Number(usedETB) || 0;
  const safeAvailable = Number(availableETB) || 0;
  const computedPercent = safeLimit > 0 ? Math.min(100, Math.round((safeUsed / safeLimit) * 100)) : 0;

  return (
    <div className={`fp-wallet-card ${meta.colorClass}`}>
      <div className="fp-wallet-header">
        <div className="fp-wallet-category">
          <div className="fp-wallet-icon-box">{meta.icon}</div>
          <span>{meta.label}</span>
        </div>
        <span className="fp-wallet-badge">{computedPercent}% Used</span>
      </div>

      <div className="fp-wallet-balance-wrap">
        <span className="fp-wallet-balance-label">Available Benefit</span>
        <div className="fp-wallet-balance-amount fp-tabular-nums">
          {safeAvailable.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          <span className="fp-wallet-currency">ETB</span>
        </div>
      </div>

      <div className="fp-wallet-bar-track">
        <div
          className="fp-wallet-bar-fill"
          style={{ width: `${computedPercent}%` }}
        />
      </div>

      <div className="fp-wallet-footer">
        <span>Limit: {safeLimit.toLocaleString()} ETB / mo</span>
        <span>Used: {safeUsed.toLocaleString()} ETB</span>
      </div>
    </div>
  );
}
