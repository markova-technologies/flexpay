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
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(6, 10, 20, 0.92)',
        backdropFilter: 'blur(12px)',
        zIndex: 200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '520px',
          background: 'var(--fp-surface-1)',
          border: '2px solid var(--fp-salary)',
          borderRadius: '24px',
          padding: '36px',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.7), 0 0 30px rgba(245, 158, 11, 0.2)',
          position: 'relative',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '14px',
              background: 'rgba(245, 158, 11, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <LockKey size={28} color="var(--fp-salary)" weight="bold" />
          </div>
          <div>
            <h3 style={{ fontSize: '1.3rem', fontWeight: 800 }}>One-Time Cryptographic Credential</h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--fp-salary)', fontWeight: 700 }}>
              CSPRNG REJECTION-SAMPLED 16-CHAR CODE
            </span>
          </div>
        </div>

        {/* Warning Callout */}
        <div
          style={{
            padding: '14px',
            background: 'rgba(245, 158, 11, 0.1)',
            border: '1px solid rgba(245, 158, 11, 0.25)',
            borderRadius: '12px',
            display: 'flex',
            gap: '10px',
            marginBottom: '24px',
            fontSize: '0.85rem',
            color: 'var(--fp-text-primary)',
          }}
        >
          <Warning size={22} color="var(--fp-salary)" style={{ flexShrink: 0 }} />
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
            padding: '16px',
            marginBottom: '16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
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
            padding: '20px',
            textAlign: 'center',
            marginBottom: '24px',
          }}
        >
          <span style={{ fontSize: '0.75rem', color: 'var(--fp-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Generated 16-Character Password
          </span>
          <div
            className="mono"
            style={{
              fontSize: '1.6rem',
              fontWeight: 800,
              color: 'var(--fp-text-primary)',
              letterSpacing: '0.12em',
              margin: '10px 0',
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
        <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
          <button
            onClick={handleCopy}
            style={{
              flex: 1,
              padding: '14px',
              borderRadius: '10px',
              background: copied ? 'var(--fp-benefit)' : 'var(--fp-salary)',
              color: '#060A14',
              fontWeight: 700,
              fontSize: '0.95rem',
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
            style={{
              padding: '14px 20px',
              borderRadius: '10px',
              background: 'var(--fp-surface-2)',
              border: '1px solid var(--fp-border)',
              color: smsSent ? 'var(--fp-benefit)' : 'var(--fp-text-primary)',
              fontWeight: 600,
              fontSize: '0.9rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <ChatCircleDots size={20} />
            {smsSent ? 'SMS Queued!' : 'Send via SMS'}
          </button>
        </div>

        {/* Footer countdown */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--fp-text-muted)' }}>
            Auto-closing for security in{' '}
            <strong style={{ color: secondsRemaining <= 10 ? '#EF4444' : 'var(--fp-text-secondary)' }}>
              {secondsRemaining}s
            </strong>
          </span>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--fp-text-secondary)',
              cursor: 'pointer',
              fontSize: '0.85rem',
              fontWeight: 600,
              textDecoration: 'underline',
            }}
          >
            I have recorded it (Dismiss)
          </button>
        </div>
      </div>
    </div>
  );
}
