import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Buildings, ArrowLeft, LockKey, Phone, IdentificationCard, ShieldCheck } from '@phosphor-icons/react';
import api from '../../services/api';
import { useAuthStore } from '../../stores/authStore';

export default function OrgAuthPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Login form state (TIN + Password)
  const [loginTin, setLoginTin] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register form state (orgName, tinNumber, contactPhone, mpesaShortcode, password)
  const [orgName, setOrgName] = useState('');
  const [tinNumber, setTinNumber] = useState('');
  const [contactPhone, setContactPhone] = useState('251');
  const [mpesaShortcode, setMpesaShortcode] = useState('');
  const [regPassword, setRegPassword] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/auth/org/login', {
        tinNumber: loginTin.trim(),
        password: loginPassword,
      });
      setAuth(res.data.user, res.data.accessToken);
      navigate('/org', { replace: true });
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
          : `Server error (${err.response?.status || '500'}): Login failed. Please verify your credentials.`);
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
      const payload = {
        orgName: orgName.trim(),
        tinNumber: tinNumber.trim(),
        contactPhone: contactPhone.trim(),
        password: regPassword,
      };
      if (mpesaShortcode.trim()) {
        payload.mpesaShortcode = mpesaShortcode.trim();
      }

      const res = await api.post('/auth/org/register', payload);
      if (res.data.user && res.data.accessToken) {
        setAuth(res.data.user, res.data.accessToken);
        navigate('/org', { replace: true });
      } else {
        setMode('login');
        setLoginTin(tinNumber.trim());
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
          : `Server error (${err.response?.status || '500'}): Registration failed. Please check inputs.`);
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
          padding: '16px 24px',
          borderBottom: '1px solid var(--fp-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <button
          onClick={() => navigate('/auth')}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--fp-text-secondary)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            cursor: 'pointer',
            fontSize: '0.9rem',
          }}
        >
          <ArrowLeft size={18} />
          Back to Portals
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Buildings size={22} color="var(--fp-benefit)" />
          <span style={{ fontWeight: 700 }}>Organization Portal</span>
        </div>
      </header>

      <main
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px 20px',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: '460px',
            background: 'var(--fp-surface-1)',
            border: '1px solid var(--fp-border)',
            borderRadius: '20px',
            padding: '36px',
            boxShadow: 'var(--fp-shadow-lg)',
          }}
        >
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: '28px' }}>
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '16px',
                background: 'rgba(16, 185, 129, 0.12)',
                border: '1px solid rgba(16, 185, 129, 0.25)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '16px',
              }}
            >
              <Buildings size={32} color="var(--fp-benefit)" weight="bold" />
            </div>
            <h2 style={{ fontSize: '1.6rem', fontWeight: 800 }}>
              {mode === 'login' ? 'Organization Sign In' : 'Register Organization'}
            </h2>
            <p style={{ color: 'var(--fp-text-secondary)', fontSize: '0.9rem', marginTop: '6px' }}>
              {mode === 'login'
                ? 'Manage company employees, credit policies & payroll'
                : 'Empower your Ethiopian workforce with benefit allowances'}
            </p>
          </div>

          {/* Tab Switcher */}
          <div
            style={{
              display: 'flex',
              background: 'var(--fp-surface-2)',
              borderRadius: '10px',
              padding: '4px',
              marginBottom: '24px',
            }}
          >
            <button
              onClick={() => { setMode('login'); setError(''); }}
              style={{
                flex: 1,
                padding: '10px',
                border: 'none',
                borderRadius: '8px',
                background: mode === 'login' ? 'var(--fp-benefit)' : 'transparent',
                color: mode === 'login' ? '#060A14' : 'var(--fp-text-secondary)',
                fontWeight: 700,
                fontSize: '0.875rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              Sign In
            </button>
            <button
              onClick={() => { setMode('register'); setError(''); }}
              style={{
                flex: 1,
                padding: '10px',
                border: 'none',
                borderRadius: '8px',
                background: mode === 'register' ? 'var(--fp-benefit)' : 'transparent',
                color: mode === 'register' ? '#060A14' : 'var(--fp-text-secondary)',
                fontWeight: 700,
                fontSize: '0.875rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              Register New Org
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
                  Organization TIN (10 digits)
                </label>
                <div style={{ position: 'relative' }}>
                  <IdentificationCard size={18} color="var(--fp-text-muted)" style={{ position: 'absolute', left: '12px', top: '12px' }} />
                  <input
                    type="text"
                    required
                    value={loginTin}
                    onChange={(e) => setLoginTin(e.target.value)}
                    placeholder="0012345678"
                    style={{
                      width: '100%',
                      padding: '12px 14px 12px 38px',
                      borderRadius: '8px',
                      background: 'var(--fp-surface-2)',
                      border: '1px solid var(--fp-border)',
                      color: 'var(--fp-text-primary)',
                      fontSize: '0.925rem',
                      fontFamily: 'var(--fp-font-mono)',
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.825rem', color: 'var(--fp-text-secondary)', marginBottom: '6px' }}>
                  Password
                </label>
                <div style={{ position: 'relative' }}>
                  <LockKey size={18} color="var(--fp-text-muted)" style={{ position: 'absolute', left: '12px', top: '12px' }} />
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
                      fontSize: '0.925rem',
                    }}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  marginTop: '8px',
                  padding: '12px',
                  borderRadius: '8px',
                  background: 'var(--fp-benefit)',
                  color: '#060A14',
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  border: 'none',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.7 : 1,
                  boxShadow: '0 4px 16px rgba(16, 185, 129, 0.25)',
                }}
              >
                {loading ? 'Authenticating...' : 'Sign In to Org Portal'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.825rem', color: 'var(--fp-text-secondary)', marginBottom: '6px' }}>
                  Organization / Company Name
                </label>
                <input
                  type="text"
                  required
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="Alpha Trading PLC"
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    background: 'var(--fp-surface-2)',
                    border: '1px solid var(--fp-border)',
                    color: 'var(--fp-text-primary)',
                    fontSize: '0.9rem',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.825rem', color: 'var(--fp-text-secondary)', marginBottom: '6px' }}>
                  Tax Identification Number (TIN - min 5 chars)
                </label>
                <div style={{ position: 'relative' }}>
                  <IdentificationCard size={18} color="var(--fp-text-muted)" style={{ position: 'absolute', left: '12px', top: '11px' }} />
                  <input
                    type="text"
                    required
                    value={tinNumber}
                    onChange={(e) => setTinNumber(e.target.value)}
                    placeholder="0012345678"
                    style={{
                      width: '100%',
                      padding: '10px 14px 10px 38px',
                      borderRadius: '8px',
                      background: 'var(--fp-surface-2)',
                      border: '1px solid var(--fp-border)',
                      color: 'var(--fp-text-primary)',
                      fontSize: '0.9rem',
                      fontFamily: 'var(--fp-font-mono)',
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.825rem', color: 'var(--fp-text-secondary)', marginBottom: '6px' }}>
                  Safaricom Contact Phone Number (12 digits)
                </label>
                <div style={{ position: 'relative' }}>
                  <Phone size={18} color="var(--fp-text-muted)" style={{ position: 'absolute', left: '12px', top: '11px' }} />
                  <input
                    type="text"
                    required
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    placeholder="251711223344"
                    style={{
                      width: '100%',
                      padding: '10px 14px 10px 38px',
                      borderRadius: '8px',
                      background: 'var(--fp-surface-2)',
                      border: '1px solid var(--fp-border)',
                      color: 'var(--fp-text-primary)',
                      fontSize: '0.9rem',
                      fontFamily: 'var(--fp-font-mono)',
                    }}
                  />
                </div>
                <span style={{ fontSize: '0.725rem', color: 'var(--fp-text-muted)', marginTop: '4px', display: 'block' }}>
                  Must start with 2517 or 2519 (e.g. 251712345678)
                </span>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.825rem', color: 'var(--fp-text-secondary)', marginBottom: '6px' }}>
                  M-PESA Shortcode / Paybill (Optional)
                </label>
                <input
                  type="text"
                  value={mpesaShortcode}
                  onChange={(e) => setMpesaShortcode(e.target.value)}
                  placeholder="2005"
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    background: 'var(--fp-surface-2)',
                    border: '1px solid var(--fp-border)',
                    color: 'var(--fp-text-primary)',
                    fontSize: '0.9rem',
                    fontFamily: 'var(--fp-font-mono)',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.825rem', color: 'var(--fp-text-secondary)', marginBottom: '6px' }}>
                  Secure Admin Password (min 8 chars)
                </label>
                <div style={{ position: 'relative' }}>
                  <LockKey size={18} color="var(--fp-text-muted)" style={{ position: 'absolute', left: '12px', top: '11px' }} />
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="••••••••••••"
                    style={{
                      width: '100%',
                      padding: '10px 14px 10px 38px',
                      borderRadius: '8px',
                      background: 'var(--fp-surface-2)',
                      border: '1px solid var(--fp-border)',
                      color: 'var(--fp-text-primary)',
                      fontSize: '0.9rem',
                    }}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  marginTop: '8px',
                  padding: '12px',
                  borderRadius: '8px',
                  background: 'var(--fp-benefit)',
                  color: '#060A14',
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  border: 'none',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.7 : 1,
                  boxShadow: '0 4px 16px rgba(16, 185, 129, 0.25)',
                }}
              >
                {loading ? 'Registering...' : 'Create Organization Account'}
              </button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
