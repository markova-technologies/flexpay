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
  // 1. Direct Image Variant (Uses exact official mark icon)
  if (variant === 'image') {
    const markSrc = isDark ? '/flexpay-mark-light.png' : '/flexpay-mark.png';
    return (
      <div
        className={`flexpay-logo-image-wrap ${className}`}
        onClick={onClick}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: onClick ? 'pointer' : 'default',
          flexShrink: 0,
          ...style,
        }}
      >
        <img
          src={markSrc}
          alt="FlexPay Mark"
          width={size}
          height={Math.round((size * 196) / 190)}
          style={{
            height: `${size}px`,
            width: 'auto',
            maxHeight: `${size}px`,
            objectFit: 'contain',
            display: 'block',
            userSelect: 'none',
          }}
          draggable={false}
        />
      </div>
    );
  }

  // 2. Official Brand Mark Asset (interlocking ribbon mark)
  const isDark = theme === 'dark';
  const bottomRibbonColor = isDark ? '#FAF7F2' : '#141413';
  const wordmarkColor = isDark ? '#FAF7F2' : '#141413';
  const taglineColor = isDark ? '#8C857B' : '#59544E';
  const markSrc = isDark ? '/flexpay-mark-light.png' : '/flexpay-mark.png';

  const markElement = (
    <img
      src={markSrc}
      alt="FlexPay Official Mark"
      width={size}
      height={Math.round((size * 196) / 190)}
      style={{
        width: `${size}px`,
        height: 'auto',
        maxHeight: `${Math.round((size * 196) / 190)}px`,
        objectFit: 'contain',
        display: 'block',
        flexShrink: 0,
        userSelect: 'none',
        pointerEvents: 'none',
      }}
      draggable={false}
    />
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
          justifyContent: 'center',
          cursor: onClick ? 'pointer' : 'default',
          flexShrink: 0,
          ...style,
        }}
      >
        {markElement}
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
      {markElement}
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
