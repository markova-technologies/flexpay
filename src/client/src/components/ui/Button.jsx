import React from 'react';
import './Button.css';

/**
 * Button component with built-in loading spinner, duplicate-click prevention,
 * and Emil Kowalski press mechanics.
 */
export default function Button({
  children,
  variant = 'primary', // 'primary' | 'secondary' | 'danger' | 'ghost'
  size = 'md',         // 'sm' | 'md' | 'lg'
  loading = false,
  disabled = false,
  icon: Icon,
  iconPosition = 'left',
  type = 'button',
  onClick,
  className = '',
  id,
  ...props
}) {
  const isDisabled = disabled || loading;

  const handleClick = (e) => {
    if (isDisabled) {
      e.preventDefault();
      return;
    }
    onClick?.(e);
  };

  return (
    <button
      id={id}
      type={type}
      className={`fp-btn fp-btn--${variant} fp-btn--${size} ${loading ? 'fp-btn--loading' : ''} ${className}`}
      disabled={isDisabled}
      aria-busy={loading}
      onClick={handleClick}
      {...props}
    >
      {loading ? (
        <span className="fp-btn__spinner" aria-hidden="true" />
      ) : Icon && iconPosition === 'left' ? (
        <Icon size={size === 'sm' ? 14 : size === 'lg' ? 20 : 16} weight="bold" />
      ) : null}

      <span className="fp-btn__text">{children}</span>

      {!loading && Icon && iconPosition === 'right' ? (
        <Icon size={size === 'sm' ? 14 : size === 'lg' ? 20 : 16} weight="bold" />
      ) : null}
    </button>
  );
}
