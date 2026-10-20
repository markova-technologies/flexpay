import React from 'react';

/**
 * FlexPay Official Brand Logo Component
 * Incorporates the brand interlocking ribbon mark and typography:
 * "Your Salary. More Possibilities."
 *
 * Theme: Electric Orange (#FF4D26) + Obsidian Ink (#080B10) + Warm Cream (#FAF8F5)
 *
 * @param {'full' | 'compact' | 'mark' | 'image'} variant
 * @param {'dark' | 'light' | 'auto'} theme
 * @param {number} size - base mark size in pixels (default: 32)
 * @param {boolean} showTagline - whether to show tagline under wordmark
 * @param {string} className - optional CSS classes
 * @param {object} style - optional CSS styles
 */
export function FlexPayLogo({
  variant = 'compact',
  theme = 'auto',
  size = 32,
  showTagline = false,
  className = '',
  style = {},
  onClick,
}) {
  // 1. Direct Image Variant (Uses exact raster asset for hero, cream cards or print)
  if (variant === 'image') {
    return (
      <div
        className={`flexpay-logo-image-wrap ${className}`}
        onClick={onClick}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          cursor: onClick ? 'pointer' : 'default',
          ...style,
        }}
      >
        <img
          src="/flexpay-logo.png"
          alt="FlexPay — Your Salary. More Possibilities."
          style={{
            height: `${size}px`,
            width: 'auto',
            objectFit: 'contain',
            borderRadius: '6px',
            display: 'block',
          }}
        />
      </div>
    );
  }

  // 2. Vector SVG Ribbon Geometry
  // Top ribbon: Vibrant Terracotta / Electric Orange (#FF4D26)
  // Bottom ribbon: Deep Obsidian Ink (#141413) on warm cream, Warm Cream (#FAF7F2) on dark
  const isDark = theme === 'dark';
  const bottomRibbonColor = isDark ? '#FAF7F2' : '#141413';
  const wordmarkColor = isDark ? '#FAF7F2' : '#141413';
  const taglineColor = isDark ? '#8C857B' : '#59544E';

  const markSvg = (
    <svg
      width={size}
      height={Math.round((size * 44) / 48)}
      viewBox="0 0 52 46"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ flexShrink: 0, display: 'block' }}
      aria-label="FlexPay Mark"
      role="img"
    >
      <defs>
        <linearGradient id="fp-mark-orange-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FF5733" />
          <stop offset="100%" stopColor="#FF3815" />
        </linearGradient>
        <filter id="fp-mark-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#FF4D26" floodOpacity="0.25" />
        </filter>
      </defs>

      {/* Top Folded Ribbon: Dynamic Electric Orange */}
      <path
        d="M3.2 27.8 C1.8 26.2 2.2 23.6 4.1 21.7 L16.8 9.0 C19.9 5.9 24.1 4.2 28.5 4.2 H40.5 C45.2 4.2 49.0 8.0 49.0 12.7 C49.0 17.4 45.2 21.2 40.5 21.2 H20.5 C17.8 21.2 15.4 22.8 14.2 25.2 L3.2 27.8 Z"
        fill="url(#fp-mark-orange-grad)"
        filter="url(#fp-mark-glow)"
      />

      {/* Bottom Counter-Loop Ribbon: Interlocking Warm Cream or Obsidian */}
      <path
        d="M8.0 41.5 L17.5 31.0 C20.6 27.6 25.1 25.8 29.8 25.8 H39.5 C44.2 25.8 48.0 29.6 48.0 34.3 C48.0 39.0 44.2 42.8 39.5 42.8 H23.5 C20.2 42.8 17.5 44.6 16.0 47.2 L8.0 41.5 Z"
        fill={bottomRibbonColor}
        opacity={isDark ? 0.95 : 1}
      />
    </svg>
  );

  // If mark-only requested
  if (variant === 'mark') {
    return (
      <div
        className={`flexpay-brand-mark ${className}`}
        onClick={onClick}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          cursor: onClick ? 'pointer' : 'default',
          ...style,
        }}
      >
        {markSvg}
      </div>
    );
  }

  const wordmarkFontSize = Math.max(14, Math.round(size * 0.72));
  const taglineFontSize = Math.max(9, Math.round(size * 0.28));

  return (
    <div
      className={`flexpay-brand-logo ${className}`}
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: `${Math.round(size * 0.3)}px`,
        textDecoration: 'none',
        userSelect: 'none',
        cursor: onClick ? 'pointer' : 'default',
        ...style,
      }}
    >
      {markSvg}
      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.05 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            fontWeight: 800,
            fontSize: `${wordmarkFontSize}px`,
            letterSpacing: '-0.035em',
            color: wordmarkColor,
            fontFamily: 'var(--fp-font-sans)',
          }}
        >
          <span>Flex</span>
          <span style={{ color: '#FF4D26' }}>Pay</span>
        </div>

        {(showTagline || variant === 'full') && (
          <span
            style={{
              fontSize: `${taglineFontSize}px`,
              fontWeight: 600,
              letterSpacing: '-0.01em',
              color: taglineColor,
              marginTop: '3px',
              fontFamily: 'var(--fp-font-sans)',
              whiteSpace: 'nowrap',
            }}
          >
            Your Salary. More Possibilities.
          </span>
        )}
      </div>
    </div>
  );
}

export default FlexPayLogo;
