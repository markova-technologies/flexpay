export function CreditRing({
  limit,
  available,
  spent,
  creditLimit = limit || 10000,
  availableCredit = available !== undefined ? available : 7500,
  monthlySalary,
  size = 220,
}) {
  const calcSpent = spent !== undefined ? spent : Math.max(0, creditLimit - availableCredit);
  const strokeWidth = 14;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const utilizationPercent = creditLimit > 0 ? Math.min(100, Math.round((calcSpent / creditLimit) * 100)) : 0;
  const strokeDashoffset = circumference - (utilizationPercent / 100) * circumference;

  // Dynamic status color based on utilization
  let strokeColor = '#10B981'; // Green (< 65%)
  if (utilizationPercent >= 85) {
    strokeColor = '#EF4444'; // Red (Critical)
  } else if (utilizationPercent >= 65) {
    strokeColor = '#F59E0B'; // Amber (Moderate)
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        width: '100%',
        maxWidth: size,
        aspectRatio: '1',
      }}
    >
      <svg
        viewBox={`0 0 ${size} ${size}`}
        style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}
      >
        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="var(--fp-surface-3)"
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        {/* Progress Arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          style={{
            transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1), stroke 0.3s ease',
          }}
        />
      </svg>

      {/* Center content */}
      <div
        style={{
          position: 'absolute',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          pointerEvents: 'none',
        }}
      >
        <span style={{ fontSize: '0.75rem', color: 'var(--fp-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Available Credit
        </span>
        <span
          className="mono"
          style={{
            fontSize: '1.5rem',
            fontWeight: 800,
            color: 'var(--fp-text-primary)',
            marginTop: '2px',
          }}
        >
          ETB {Number(availableCredit).toLocaleString()}
        </span>
        <span
          style={{
            fontSize: '0.75rem',
            fontWeight: 600,
            color: strokeColor,
            marginTop: '4px',
            background: 'var(--fp-surface-2)',
            padding: '2px 8px',
            borderRadius: '999px',
          }}
        >
          {utilizationPercent}% Used
        </span>
        {monthlySalary && (
          <span style={{ fontSize: '0.7rem', color: 'var(--fp-text-muted)', marginTop: '4px' }}>
            Salary: ETB {Number(monthlySalary).toLocaleString()}
          </span>
        )}
      </div>
    </div>
  );
}

export default CreditRing;
