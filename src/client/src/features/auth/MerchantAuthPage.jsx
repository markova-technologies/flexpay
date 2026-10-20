import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Storefront, ArrowLeft, LockKey, Phone, IdentificationCard } from '@phosphor-icons/react';
import { FlexPayLogo } from '../../components/ui/FlexPayLogo';
import api from '../../services/api';
import { useAuthStore } from '../../stores/authStore';

export default function MerchantAuthPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Login form state (M-PESA Number + Password)
  const [loginMpesaNumber, setLoginMpesaNumber] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register form state (businessName, mpesaNumber, category, contactPhone, password)
  const [businessName, setBusinessName] = useState('');
  const [category, setCategory] = useState('GROCERY');
  const [mpesaNumber, setMpesaNumber] = useState('');
  const [contactPhone, setContactPhone] = useState('251');
  const [regPassword, setRegPassword] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/auth/merchant/login', {
        mpesaNumber: loginMpesaNumber.trim(),
        password: loginPassword,
      });
      setAuth(res.data.user, res.data.accessToken);
      navigate('/merchant', { replace: true });
    } catch (err) {
      const msg =
        err.response?.data?.details?.[0]?.message ||
        err.response?.data?.error ||
        err.response?.data?.message ||
        (typeof err.response?.data === 'string' && err.response.data.length < 200 ? err.response.data : null) ||
        (err.code === 'ECONNABORTED'
          ? 'Request timed out. Render backend may be waking up from sleep. Please try again in a few seconds.'
          : !err.response
          ? 'Network error: Cannot reach backend server. Please verify VITE_API_URL.'
          : `Server error (${err.response?.status || '500'}): Merchant login failed. Check your credentials.`);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/auth/merchant/register', {
        businessName: businessName.trim(),
        mpesaNumber: mpesaNumber.trim(),
        category,
        contactPhone: contactPhone.trim(),
        password: regPassword,
      });
      if (res.data.user && res.data.accessToken) {
        setAuth(res.data.user, res.data.accessToken);
        navigate('/merchant', { replace: true });
      } else {
        setMode('login');
        setLoginMpesaNumber(mpesaNumber.trim());
        setError('');
      }
    } catch (err) {
      const msg =
        err.response?.data?.details?.[0]?.message ||
        err.response?.data?.error ||
        err.response?.data?.message ||
        (typeof err.response?.data === 'string' && err.response.data.length < 200 ? err.response.data : null) ||
        (err.code === 'ECONNABORTED'
          ? 'Request timed out. Render backend may be waking up from sleep. Please try again in a few seconds.'
          : !err.response
          ? 'Network error: Cannot reach backend server. Please verify VITE_API_URL.'
          : `Server error (${err.response?.status || '500'}): Merchant registration failed. Please try again.`);
      setError(msg);
    } finally {
      setLoading(false);
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
          <span style={{ fontSize: '0.78rem', background: 'rgba(245, 158, 11, 0.14)', color: '#F59E0B', padding: '2px 8px', borderRadius: '4px', fontWeight: 700 }}>
            Merchant POS
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
            maxWidth: '480px',
            background: 'var(--fp-surface-1)',
            border: '1px solid var(--fp-border)',
            borderRadius: '20px',
            padding: 'clamp(22px, 5vw, 36px) clamp(16px, 4vw, 28px)',
            boxShadow: 'var(--fp-shadow-lg)',
            boxSizing: 'border-box',
          }}
        >
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 'clamp(20px, 4vw, 28px)' }}>
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '16px',
                background: 'rgba(245, 158, 11, 0.12)',
                border: '1px solid rgba(245, 158, 11, 0.25)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '16px',
              }}
            >
              <Storefront size={32} color="var(--fp-salary)" weight="bold" />
            </div>
            <h2 style={{ fontSize: 'clamp(1.35rem, 4vw, 1.6rem)', fontWeight: 800 }}>
              {mode === 'login' ? 'Merchant Sign In' : 'Register Merchant'}
            </h2>
            <p style={{ color: 'var(--fp-text-secondary)', fontSize: '0.875rem', marginTop: '6px' }}>
              {mode === 'login'
                ? 'Accept FlexPay QR payments & check settlement balance'
                : 'Join the Ethiopian merchant network with direct M-PESA wires'}
            </p>
          </div>

          {/* Switcher */}
          <div
            style={{
              display: 'flex',
              background: 'var(--fp-surface-2)',
              borderRadius: '10px',
              padding: '4px',
              marginBottom: '24px',
              gap: '4px',
            }}
          >
            <button
              onClick={() => { setMode('login'); setError(''); }}
              className="fp-touch-target"
              style={{
                flex: 1,
                padding: '10px',
                minHeight: '44px',
                border: 'none',
                borderRadius: '8px',
                background: mode === 'login' ? 'var(--fp-salary)' : 'transparent',
                color: mode === 'login' ? '#FFFFFF' : 'var(--fp-text-secondary)',
                fontWeight: 700,
                fontSize: '0.875rem',
                cursor: 'pointer',
              }}
            >
              Sign In
            </button>
            <button
              onClick={() => { setMode('register'); setError(''); }}
              className="fp-touch-target"
              style={{
                flex: 1,
                padding: '10px',
                minHeight: '44px',
                border: 'none',
                borderRadius: '8px',
                background: mode === 'register' ? 'var(--fp-salary)' : 'transparent',
                color: mode === 'register' ? '#FFFFFF' : 'var(--fp-text-secondary)',
                fontWeight: 700,
                fontSize: '0.875rem',
                cursor: 'pointer',
              }}
            >
              Register Merchant
            </button>
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

          {mode === 'login' ? (
            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.825rem', color: 'var(--fp-text-secondary)', marginBottom: '6px' }}>
                  M-PESA Till / Paybill Number
                </label>
                <div style={{ position: 'relative' }}>
                  <IdentificationCard size={18} color="var(--fp-text-muted)" style={{ position: 'absolute', left: '12px', top: '13px' }} />
                  <input
                    type="text"
                    inputMode="numeric"
                    required
                    value={loginMpesaNumber}
                    onChange={(e) => setLoginMpesaNumber(e.target.value)}
                    placeholder="174379"
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
                <span style={{ fontSize: '0.75rem', color: 'var(--fp-text-muted)', marginTop: '4px', display: 'block' }}>
                  Enter your registered M-PESA shortcode, till, or paybill number
                </span>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.825rem', color: 'var(--fp-text-secondary)', marginBottom: '6px' }}>
                  Password
                </label>
                <div style={{ position: 'relative' }}>
                  <LockKey size={18} color="var(--fp-text-muted)" style={{ position: 'absolute', left: '12px', top: '13px' }} />
                  <input
                    type="password"
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••••••"
                    style={{
                      width: '100%',
                      padding: '12px 14px 12px 38px',
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
                  background: 'var(--fp-salary)',
                  color: '#FFFFFF',
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  border: 'none',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.7 : 1,
                  boxShadow: '0 4px 16px rgba(245, 158, 11, 0.25)',
                }}
              >
                {loading ? 'Authenticating...' : 'Sign In to Merchant POS'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.825rem', color: 'var(--fp-text-secondary)', marginBottom: '6px' }}>
                  Business / Store Name
                </label>
                <input
                  type="text"
                  required
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="Friendship Supermarket"
                  style={{
                    width: '100%',
                    padding: '12px 14px',
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

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.825rem', color: 'var(--fp-text-secondary)', marginBottom: '6px' }}>
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
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
                  >
                    <option value="GROCERY">GROCERY</option>
                    <option value="FOOD">FOOD / RESTAURANT</option>
                    <option value="HEALTH">HEALTH / MEDICAL</option>
                    <option value="TRANSPORT">TRANSPORT</option>
                    <option value="FUEL">FUEL / STATION</option>
                    <option value="EDUCATION">EDUCATION</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.825rem', color: 'var(--fp-text-secondary)', marginBottom: '6px' }}>
                    M-PESA Till / Paybill No
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    required
                    value={mpesaNumber}
                    onChange={(e) => setMpesaNumber(e.target.value)}
                    placeholder="174379"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
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

              <div>
                <label style={{ display: 'block', fontSize: '0.825rem', color: 'var(--fp-text-secondary)', marginBottom: '6px' }}>
                  Safaricom Contact Phone Number (12 digits)
                </label>
                <div style={{ position: 'relative' }}>
                  <Phone size={18} color="var(--fp-text-muted)" style={{ position: 'absolute', left: '12px', top: '13px' }} />
                  <input
                    type="tel"
                    inputMode="tel"
                    required
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    placeholder="251711223344"
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
                <span style={{ fontSize: '0.75rem', color: 'var(--fp-text-muted)', marginTop: '4px', display: 'block' }}>
                  Must start with 2517 or 2519 (e.g., 251711223344)
                </span>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.825rem', color: 'var(--fp-text-secondary)', marginBottom: '6px' }}>
                  Password (min 8 chars)
                </label>
                <div style={{ position: 'relative' }}>
                  <LockKey size={18} color="var(--fp-text-muted)" style={{ position: 'absolute', left: '12px', top: '13px' }} />
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="••••••••••••"
                    style={{
                      width: '100%',
                      padding: '12px 14px 12px 38px',
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
                  background: 'var(--fp-salary)',
                  color: '#FFFFFF',
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  border: 'none',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.7 : 1,
                  boxShadow: '0 4px 16px rgba(245, 158, 11, 0.25)',
                }}
              >
                {loading ? 'Registering...' : 'Complete Merchant Registration'}
              </button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
