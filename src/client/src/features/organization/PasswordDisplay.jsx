import React, { useState, useEffect } from 'react';
import { LockKey, Copy, Check, Warning, ChatCircleDots } from '@phosphor-icons/react';

export default function PasswordDisplay({ fpEmployeeId, plainPassword, employeeName, onClose }) {
  const [copied, setCopied] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(60);
  const [smsSent, setSmsSent] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onClose();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [onClose]);

  const handleCopy = () => {
    navigator.clipboard.writeText(plainPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleSendSMS = () => {
    setSmsSent(true);
    setTimeout(() => setSmsSent(false), 3000);
  };

  return (
    <div
      className="fp-modal-overlay"
      onClick={onClose}
      style={{ zIndex: 200 }}
    >
      <div
        className="fp-modal"
        style={{
          width: '100%',
          maxWidth: '520px',
          border: '2px solid var(--fp-salary)',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.7), 0 0 30px rgba(245, 158, 11, 0.2)',
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="fp-sheet-handle" />
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px' }}>
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              background: 'rgba(245, 158, 11, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <LockKey size={26} color="var(--fp-salary)" weight="bold" />
          </div>
          <div>
            <h3 style={{ fontSize: 'clamp(1.05rem, 3.5vw, 1.25rem)', fontWeight: 800, margin: 0 }}>
              One-Time Cryptographic Credential
            </h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--fp-salary)', fontWeight: 700 }}>
              CSPRNG REJECTION-SAMPLED 16-CHAR CODE
            </span>
          </div>
        </div>

        {/* Warning Callout */}
        <div
          style={{
            padding: '12px 14px',
            background: 'rgba(245, 158, 11, 0.1)',
            border: '1px solid rgba(245, 158, 11, 0.25)',
            borderRadius: '12px',
            display: 'flex',
            gap: '10px',
            marginBottom: '20px',
            fontSize: '0.825rem',
            color: 'var(--fp-text-primary)',
            lineHeight: 1.4,
          }}
        >
          <Warning size={20} color="var(--fp-salary)" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <strong>Strict Security Invariant:</strong> This password will NEVER be displayed again.
            It is not stored in plain text anywhere in our database. Transmit it to the employee now.
          </div>
        </div>

        {/* Employee & FP-ID Box */}
        <div
          style={{
            background: 'var(--fp-surface-2)',
            borderRadius: '12px',
            padding: '14px 16px',
            marginBottom: '16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '8px',
          }}
        >
          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--fp-text-muted)', textTransform: 'uppercase' }}>
              Employee Name
            </span>
            <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{employeeName || 'Staff Member'}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--fp-text-muted)', textTransform: 'uppercase' }}>
              FlexPay ID (FP-ID)
            </span>
            <div className="mono" style={{ fontWeight: 800, color: 'var(--fp-benefit)', fontSize: '0.95rem' }}>
              {fpEmployeeId}
            </div>
          </div>
        </div>

        {/* Password Display Box */}
        <div
          style={{
            background: 'var(--fp-surface-3)',
            border: '1px solid var(--fp-border-strong)',
            borderRadius: '14px',
            padding: '16px 14px',
            textAlign: 'center',
            marginBottom: '20px',
          }}
        >
          <span style={{ fontSize: '0.75rem', color: 'var(--fp-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Generated 16-Character Password
          </span>
          <div
            className="mono"
            style={{
              fontSize: 'clamp(1.15rem, 4.5vw, 1.55rem)',
              fontWeight: 800,
              color: 'var(--fp-text-primary)',
              letterSpacing: '0.1em',
              margin: '8px 0',
              wordBreak: 'break-all',
              userSelect: 'all',
            }}
          >
            {plainPassword}
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--fp-text-muted)' }}>
            Excludes confusing and SMS-breaking characters
          </span>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '18px', flexWrap: 'wrap' }}>
          <button
            onClick={handleCopy}
            className="fp-touch-target"
            style={{
              flex: '1 1 180px',
              padding: '12px 14px',
              minHeight: 'var(--fp-touch-comfortable)',
              borderRadius: '10px',
              background: copied ? 'var(--fp-benefit)' : 'var(--fp-salary)',
              color: '#060A14',
              fontWeight: 700,
              fontSize: '0.925rem',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'all 0.2s ease',
            }}
          >
            {copied ? <Check size={20} weight="bold" /> : <Copy size={20} weight="bold" />}
            {copied ? 'Copied to Clipboard!' : 'Copy Password'}
          </button>

          <button
            onClick={handleSendSMS}
            className="fp-touch-target"
            style={{
              flex: '1 1 140px',
              padding: '12px 16px',
              minHeight: 'var(--fp-touch-comfortable)',
              borderRadius: '10px',
              background: 'var(--fp-surface-2)',
              border: '1px solid var(--fp-border)',
              color: smsSent ? 'var(--fp-benefit)' : 'var(--fp-text-primary)',
              fontWeight: 600,
              fontSize: '0.9rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            <ChatCircleDots size={20} />
            {smsSent ? 'SMS Queued!' : 'Send via SMS'}
          </button>
        </div>

        {/* Footer countdown */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--fp-text-muted)' }}>
            Auto-closing for security in{' '}
            <strong style={{ color: secondsRemaining <= 10 ? '#EF4444' : 'var(--fp-text-secondary)' }}>
              {secondsRemaining}s
            </strong>
          </span>
          <button
            onClick={onClose}
            className="fp-touch-target"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--fp-text-secondary)',
              cursor: 'pointer',
              fontSize: '0.85rem',
              fontWeight: 600,
              textDecoration: 'underline',
              minHeight: 'var(--fp-touch-min)',
              display: 'inline-flex',
              alignItems: 'center',
            }}
          >
            I have recorded it (Dismiss)
          </button>
        </div>
      </div>
    </div>
  );
}
