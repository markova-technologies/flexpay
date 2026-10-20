import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, ArrowLeft, LockKey, IdentificationCard, ShieldCheck, Phone, CheckCircle, Warning } from '@phosphor-icons/react';
import { FlexPayLogo } from '../../components/ui/FlexPayLogo';
import api from '../../services/api';
import { useAuthStore } from '../../stores/authStore';

export default function EmployeeLoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Login inputs
  const [fpId, setFpId] = useState('');
  const [password, setPassword] = useState('');

  // Forgot password modal
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotFpId, setForgotFpId] = useState('');
  const [forgotPhone, setForgotPhone] = useState('251');
  const [forgotReason, setForgotReason] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState('');
  const [forgotError, setForgotError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/auth/employee/login', {
        fpEmployeeId: fpId.trim().toUpperCase(),
        password: password,
      });
      setAuth(res.data.user, res.data.accessToken);
      navigate('/employee', { replace: true });
    } catch (err) {
      const msg =
        err.response?.data?.details?.[0]?.message ||
        err.response?.data?.error ||
        err.response?.data?.message ||
        'Login failed. Verify your FP-ID and 16-character credential.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setForgotError('');
    setForgotLoading(true);
    try {
      const res = await api.post('/auth/employee/forgot-password', {
        fpEmployeeId: forgotFpId.trim().toUpperCase(),
        phoneNumber: forgotPhone.trim(),
        reason: forgotReason || 'Employee requested password reset from login portal',
      });
      setForgotSuccess(res.data?.message || 'Password reset request submitted successfully to your organization administrator.');
    } catch (err) {
      const msg =
        err.response?.data?.details?.[0]?.message ||
        err.response?.data?.error ||
        err.response?.data?.message ||
        'Failed to submit reset request. Verify your FP-ID and phone.';
      setForgotError(msg);
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--fp-bg)',
        color: 'var(--fp-text-primary)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <header
        style={{
          padding: 'clamp(12px, 3vw, 16px) clamp(16px, 4vw, 24px)',
          borderBottom: '1px solid var(--fp-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          minHeight: 'var(--fp-header-h-mob)',
        }}
      >
        <button
          onClick={() => navigate('/auth')}
          className="fp-touch-target"
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--fp-text-secondary)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            cursor: 'pointer',
            fontSize: '0.9rem',
            padding: '8px 12px',
            borderRadius: '6px',
          }}
        >
          <ArrowLeft size={18} />
          Back to Portals
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <FlexPayLogo variant="compact" size={26} onClick={() => navigate('/')} style={{ cursor: 'pointer' }} />
          <span style={{ fontSize: '0.78rem', background: 'rgba(255, 77, 38, 0.12)', color: 'var(--fp-orange, #FF4D26)', padding: '2px 8px', borderRadius: '4px', fontWeight: 700 }}>
            Employee Wallet
          </span>
        </div>
      </header>

      <main
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 'clamp(20px, 4vw, 40px) 16px',
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: '440px',
            background: 'var(--fp-surface-1)',
            border: '1px solid var(--fp-border)',
            borderRadius: '20px',
            padding: 'clamp(22px, 5vw, 36px) clamp(16px, 4vw, 28px)',
            boxShadow: 'var(--fp-shadow-lg)',
            boxSizing: 'border-box',
          }}
        >
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: '28px' }}>
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '16px',
                background: 'rgba(56, 189, 248, 0.12)',
                border: '1px solid rgba(56, 189, 248, 0.25)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '16px',
              }}
            >
              <User size={32} color="#38BDF8" weight="bold" />
            </div>
            <h2 style={{ fontSize: '1.6rem', fontWeight: 800 }}>Employee Sign In</h2>
            <p style={{ color: 'var(--fp-text-secondary)', fontSize: '0.875rem', marginTop: '6px', lineHeight: 1.5 }}>
              Enter your corporate FP-ID and 16-character password provided by your employer.
            </p>
          </div>

          {/* Institutional note banner */}
          <div
            style={{
              padding: '12px 14px',
              background: 'rgba(56, 189, 248, 0.08)',
              border: '1px solid rgba(56, 189, 248, 0.2)',
              borderRadius: '10px',
              display: 'flex',
              gap: '10px',
              marginBottom: '24px',
              fontSize: '0.825rem',
              color: 'var(--fp-text-secondary)',
            }}
          >
            <ShieldCheck size={20} color="#38BDF8" style={{ flexShrink: 0 }} />
            <span>
              Employees cannot self-register. Accounts are created and funded exclusively by your organization.
            </span>
          </div>

          {error && (
            <div
              style={{
                padding: '12px 16px',
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '8px',
                color: '#EF4444',
                fontSize: '0.85rem',
                marginBottom: '20px',
              }}
            >
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.825rem', color: 'var(--fp-text-secondary)', marginBottom: '6px' }}>
                FlexPay Employee ID (FP-ID)
              </label>
              <div style={{ position: 'relative' }}>
                <IdentificationCard size={18} color="var(--fp-text-muted)" style={{ position: 'absolute', left: '12px', top: '12px' }} />
                <input
                  type="text"
                  required
                  value={fpId}
                  onChange={(e) => setFpId(e.target.value.toUpperCase())}
                  placeholder="FP-ETH-2026-XXXXX-C"
                  autoCapitalize="characters"
                  autoCorrect="off"
                  spellCheck="false"
                  style={{
                    width: '100%',
                    padding: '12px 14px 12px 38px',
                    borderRadius: '8px',
                    background: 'var(--fp-surface-2)',
                    border: '1px solid var(--fp-border)',
                    color: 'var(--fp-text-primary)',
                    fontSize: '1rem',
                    fontFamily: 'var(--fp-font-mono)',
                    letterSpacing: '0.04em',
                    minHeight: '44px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <label style={{ fontSize: '0.825rem', color: 'var(--fp-text-secondary)' }}>
                  16-Character Password
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setForgotFpId(fpId);
                    setShowForgotModal(true);
                    setForgotSuccess('');
                    setForgotError('');
                  }}
                  className="fp-touch-target"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#38BDF8',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    padding: '4px 0',
                  }}
                >
                  Forgot / Lost Password?
                </button>
              </div>
              <div style={{ position: 'relative' }}>
                <LockKey size={18} color="var(--fp-text-muted)" style={{ position: 'absolute', left: '12px', top: '13px' }} />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••••••"
                  style={{
                    width: '100%',
                    padding: '12px 14px 12px 38px',
                    borderRadius: '8px',
                    background: 'var(--fp-surface-2)',
                    border: '1px solid var(--fp-border)',
                    color: 'var(--fp-text-primary)',
                    fontSize: '1rem',
                    fontFamily: 'var(--fp-font-mono)',
                    minHeight: '44px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="fp-touch-target"
              style={{
                marginTop: '8px',
                padding: '14px',
                minHeight: '48px',
                borderRadius: '8px',
                background: 'var(--fp-orange, #FF4D26)',
                color: '#080B10',
                fontWeight: 700,
                fontSize: '0.95rem',
                border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
                boxShadow: '0 4px 16px var(--fp-orange-glow, rgba(255, 77, 38, 0.25))',
              }}
            >
              {loading ? 'Verifying with Bank Invariant...' : 'Access My Benefits Portal'}
            </button>
          </form>
        </div>
      </main>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fp-modal-overlay" onClick={() => setShowForgotModal(false)}>
          <div
            className="fp-modal"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '460px',
              padding: 'clamp(20px, 4vw, 32px)',
              boxSizing: 'border-box',
            }}
          >
            <div className="fp-sheet-handle" />

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: 'rgba(245, 158, 11, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Warning size={24} color="var(--fp-salary)" weight="bold" />
              </div>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Request Password Reset</h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--fp-text-muted)' }}>Corporate Approval Workflow</span>
              </div>
            </div>

            <p style={{ color: 'var(--fp-text-secondary)', fontSize: '0.875rem', lineHeight: 1.5, marginBottom: '20px' }}>
              For institutional security, password resets must be approved by your company HR / Organization Admin.
              Once approved, a new 16-character password will be generated for you.
            </p>

            {forgotSuccess ? (
              <div
                style={{
                  padding: '16px',
                  background: 'rgba(16, 185, 129, 0.12)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  borderRadius: '10px',
                  color: 'var(--fp-benefit)',
                  fontSize: '0.9rem',
                  display: 'flex',
                  gap: '10px',
                  marginBottom: '20px',
                }}
              >
                <CheckCircle size={24} weight="fill" style={{ flexShrink: 0 }} />
                <div>
                  <strong>Request Dispatched</strong>
                  <p style={{ fontSize: '0.825rem', marginTop: '4px', color: 'var(--fp-text-secondary)' }}>
                    {forgotSuccess}
                  </p>
                </div>
              </div>
            ) : (
              <form onSubmit={handleForgotPassword} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {forgotError && (
                  <div style={{ padding: '10px', background: 'rgba(239, 68, 68, 0.12)', color: '#EF4444', borderRadius: '6px', fontSize: '0.85rem' }}>
                    {forgotError}
                  </div>
                )}

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--fp-text-secondary)', marginBottom: '6px' }}>
                    Your Employee FP-ID
                  </label>
                  <input
                    type="text"
                    required
                    value={forgotFpId}
                    onChange={(e) => setForgotFpId(e.target.value.toUpperCase())}
                    placeholder="FP-ETH-2026-XXXXX-C"
                    autoCapitalize="characters"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      background: 'var(--fp-surface-2)',
                      border: '1px solid var(--fp-border)',
                      color: 'var(--fp-text-primary)',
                      fontFamily: 'var(--fp-font-mono)',
                      fontSize: '1rem',
                      minHeight: '44px',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--fp-text-secondary)', marginBottom: '6px' }}>
                    Registered Safaricom Phone Number (251...)
                  </label>
                  <input
                    type="tel"
                    inputMode="tel"
                    required
                    value={forgotPhone}
                    onChange={(e) => setForgotPhone(e.target.value)}
                    placeholder="251911223344"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      background: 'var(--fp-surface-2)',
                      border: '1px solid var(--fp-border)',
                      color: 'var(--fp-text-primary)',
                      fontFamily: 'var(--fp-font-mono)',
                      fontSize: '1rem',
                      minHeight: '44px',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--fp-text-secondary)', marginBottom: '6px' }}>
                    Reason (Optional)
                  </label>
                  <input
                    type="text"
                    value={forgotReason}
                    onChange={(e) => setForgotReason(e.target.value)}
                    placeholder="e.g. Lost SIM card or forgot 16-character code"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      background: 'var(--fp-surface-2)',
                      border: '1px solid var(--fp-border)',
                      color: 'var(--fp-text-primary)',
                      fontSize: '1rem',
                      minHeight: '44px',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={forgotLoading}
                  className="fp-touch-target"
                  style={{
                    padding: '12px',
                    borderRadius: '8px',
                    background: '#38BDF8',
                    color: '#060A14',
                    fontWeight: 700,
                    border: 'none',
                    cursor: forgotLoading ? 'not-allowed' : 'pointer',
                    minHeight: '48px',
                    marginTop: '6px',
                  }}
                >
                  {forgotLoading ? 'Submitting...' : 'Send Reset Request to Company'}
                </button>
              </form>
            )}

            <button
              onClick={() => setShowForgotModal(false)}
              className="fp-touch-target"
              style={{
                width: '100%',
                marginTop: '12px',
                padding: '10px',
                minHeight: '44px',
                background: 'transparent',
                border: '1px solid var(--fp-border)',
                color: 'var(--fp-text-secondary)',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
