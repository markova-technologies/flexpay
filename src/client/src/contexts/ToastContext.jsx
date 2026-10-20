import React, { createContext, useContext, useState, useCallback } from 'react';
import {
  CheckCircle,
  WarningOctagon,
  Warning,
  Info,
  X,
  ShieldWarning,
} from '@phosphor-icons/react';

const ToastCtx = createContext(null);

let _id = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [confirmDialog, setConfirmDialog] = useState(null);

  const push = useCallback(({ message, type = 'info', duration = 4500 }) => {
    const id = ++_id;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
    return id;
  }, []);

  const success = useCallback((message, duration) => push({ message, type: 'success', duration }), [push]);
  const error = useCallback((message, duration) => push({ message, type: 'error', duration }), [push]);
  const warning = useCallback((message, duration) => push({ message, type: 'warning', duration }), [push]);
  const info = useCallback((message, duration) => push({ message, type: 'info', duration }), [push]);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const confirm = useCallback(
    ({
      title = 'Confirm Action',
      message = 'Are you sure you want to proceed?',
      confirmText = 'Confirm',
      cancelText = 'Cancel',
      variant = 'danger', // 'danger' | 'benefit' | 'warning'
    }) => {
      return new Promise((resolve) => {
        setConfirmDialog({
          title,
          message,
          confirmText,
          cancelText,
          variant,
          resolve,
        });
      });
    },
    []
  );

  const handleConfirmClose = (result) => {
    if (confirmDialog?.resolve) {
      confirmDialog.resolve(result);
    }
    setConfirmDialog(null);
  };

  const getToastIcon = (type) => {
    switch (type) {
      case 'success':
        return <CheckCircle size={20} color="var(--fp-success)" weight="fill" />;
      case 'error':
        return <WarningOctagon size={20} color="var(--fp-danger)" weight="fill" />;
      case 'warning':
        return <Warning size={20} color="var(--fp-pending)" weight="fill" />;
      default:
        return <Info size={20} color="var(--fp-sim)" weight="fill" />;
    }
  };

  return (
    <ToastCtx.Provider value={{ push, success, error, warning, info, confirm, dismiss }}>
      {children}

      {/* In-system Toast Notifications Container */}
      <div className="fp-toast-container" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`fp-toast fp-toast--${t.type}`} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
              {getToastIcon(t.type)}
            </div>
            <span className="fp-toast__msg" style={{ fontSize: '0.875rem', lineHeight: '1.4' }}>
              {t.message}
            </span>
            <button
              className="fp-toast__close"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss"
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--fp-text-muted)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                padding: '4px',
              }}
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>

      {/* In-system Confirmation Modal */}
      {confirmDialog && (
        <div
          className="fp-modal-overlay"
          style={{ zIndex: 10000 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) handleConfirmClose(false);
          }}
        >
          <div
            className="fp-modal"
            style={{
              width: '100%',
              maxWidth: '460px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="fp-sheet-handle" />
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', marginBottom: '16px' }}>
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '12px',
                  background:
                    confirmDialog.variant === 'danger'
                      ? 'rgba(239, 68, 68, 0.15)'
                      : confirmDialog.variant === 'warning'
                      ? 'rgba(245, 158, 11, 0.15)'
                      : 'rgba(16, 185, 129, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {confirmDialog.variant === 'danger' ? (
                  <WarningOctagon size={26} color="var(--fp-danger)" weight="bold" />
                ) : confirmDialog.variant === 'warning' ? (
                  <Warning size={26} color="var(--fp-pending)" weight="bold" />
                ) : (
                  <ShieldWarning size={26} color="var(--fp-benefit)" weight="bold" />
                )}
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: '0 0 6px', color: 'var(--fp-text-primary)' }}>
                  {confirmDialog.title}
                </h3>
                <p style={{ fontSize: '0.875rem', color: 'var(--fp-text-secondary)', lineHeight: '1.5', margin: 0 }}>
                  {confirmDialog.message}
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => handleConfirmClose(false)}
                className="fp-touch-target"
                style={{
                  padding: '12px 18px',
                  minHeight: 'var(--fp-touch-min)',
                  borderRadius: '8px',
                  background: 'var(--fp-surface-2)',
                  border: '1px solid var(--fp-border)',
                  color: 'var(--fp-text-primary)',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  flex: '1 1 120px',
                }}
              >
                {confirmDialog.cancelText}
              </button>
              <button
                type="button"
                autoFocus
                onClick={() => handleConfirmClose(true)}
                className="fp-touch-target"
                style={{
                  padding: '12px 20px',
                  minHeight: 'var(--fp-touch-min)',
                  borderRadius: '8px',
                  background:
                    confirmDialog.variant === 'danger'
                      ? 'var(--fp-danger)'
                      : confirmDialog.variant === 'warning'
                      ? 'var(--fp-salary)'
                      : 'var(--fp-benefit)',
                  color: confirmDialog.variant === 'warning' ? '#060A14' : '#FFFFFF',
                  fontWeight: 700,
                  fontSize: '0.875rem',
                  border: 'none',
                  cursor: 'pointer',
                  flex: '1 1 140px',
                  boxShadow:
                    confirmDialog.variant === 'danger'
                      ? '0 4px 16px rgba(239, 68, 68, 0.3)'
                      : confirmDialog.variant === 'warning'
                      ? '0 4px 16px rgba(245, 158, 11, 0.3)'
                      : '0 4px 16px rgba(16, 185, 129, 0.3)',
                }}
              >
                {confirmDialog.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
}
