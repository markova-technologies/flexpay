import React from 'react';

export default function CreditRing({ limit = 10000, available = 7500, spent = 2500, size = 220 }) {
  const strokeWidth = 14;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const utilizationPercent = limit > 0 ? Math.min(100, Math.round((spent / limit) * 100)) : 0;
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
        width: size,
        height: size,
      }}
    >
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
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
          ETB {Number(available).toLocaleString()}
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
      </div>
    </div>
  );
}
