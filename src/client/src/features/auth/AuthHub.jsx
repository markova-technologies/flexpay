import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Buildings, Storefront, User, ArrowRight, ShieldCheck, ArrowLeft } from '@phosphor-icons/react';
import { FlexPayLogo } from '../../components/ui/FlexPayLogo';

export default function AuthHub() {
  const navigate = useNavigate();

  const portals = [
    {
      id: 'org',
      title: 'Organization / Employer',
      badge: 'HR & FINANCE',
      desc: 'Register corporate account, onboard staff, set category credit policies, approve credentials, and execute automated payroll settlement.',
      icon: <Buildings size={36} weight="bold" color="var(--fp-orange, #FF4D26)" />,
      route: '/auth/organization',
      accent: 'var(--fp-orange, #FF4D26)',
      buttonText: 'Organization Portal',
    },
    {
      id: 'merchant',
      title: 'Merchant Partner',
      badge: 'POS & RETAIL',
      desc: 'Register retail store, verify employee benefits by FP-ID or QR scan, initiate split checkout, and receive direct M-PESA wire settlements.',
      icon: <Storefront size={36} weight="bold" color="#F59E0B" />,
      route: '/auth/merchant',
      accent: '#F59E0B',
      buttonText: 'Merchant Portal',
    },
    {
      id: 'employee',
      title: 'Employee Portal',
      badge: 'DIGITAL WALLET',
      desc: 'Sign in using your organization-issued Luhn FP-ID and 16-character secure credential to access your QR payment card and live credit balance.',
      icon: <User size={36} weight="bold" color="var(--fp-orange, #FF4D26)" />,
      route: '/auth/employee',
      accent: 'var(--fp-orange, #FF4D26)',
      buttonText: 'Employee Login',
    },
  ];

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
      {/* Top Bar */}
      <header
        style={{
          padding: 'clamp(14px, 3vw, 20px) clamp(16px, 4vw, 32px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--fp-border)',
          minHeight: 'var(--fp-header-h-mob)',
        }}
      >
        <button
          onClick={() => navigate('/')}
          className="fp-touch-target"
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--fp-text-secondary)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.9rem',
            cursor: 'pointer',
            padding: '8px 12px',
            borderRadius: '6px',
            transition: 'color 0.15s ease',
          }}
        >
          <ArrowLeft size={18} />
          Back to Home
        </button>

        <FlexPayLogo variant="compact" size={28} onClick={() => navigate('/')} style={{ cursor: 'pointer' }} />
      </header>

      {/* Main Container */}
      <main
        style={{
          flex: 1,
          maxWidth: '1100px',
          width: '100%',
          margin: '0 auto',
          padding: 'clamp(32px, 6vw, 64px) clamp(16px, 4vw, 32px) clamp(48px, 8vw, 80px)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ textAlign: 'center', maxWidth: '640px', marginBottom: 'clamp(32px, 6vw, 56px)' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: '999px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid var(--fp-border)',
              fontSize: '0.75rem',
              color: 'var(--fp-text-secondary)',
              marginBottom: '16px',
            }}
          >
            <ShieldCheck size={16} color="var(--fp-benefit)" />
            Institutional Access Hub
          </div>
          <h1 style={{ fontSize: 'clamp(1.75rem, 5vw, 2.4rem)', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '16px', lineHeight: 1.2 }}>
            Choose Your FlexPay Portal
          </h1>
          <p style={{ color: 'var(--fp-text-secondary)', fontSize: 'clamp(0.925rem, 2.5vw, 1.05rem)', lineHeight: 1.6 }}>
            Select your account type to access real-time benefits management, retail checkout, or your personal digital wallet.
          </p>
        </div>

        {/* Portals Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))',
            gap: 'clamp(16px, 3vw, 28px)',
            width: '100%',
          }}
        >
          {portals.map((p) => (
            <div
              key={p.id}
              onClick={() => navigate(p.route)}
              style={{
                background: 'var(--fp-surface-1)',
                border: '1px solid var(--fp-border)',
                borderRadius: '20px',
                padding: 'clamp(22px, 4vw, 36px) clamp(18px, 4vw, 28px)',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: 'var(--fp-shadow-md)',
                position: 'relative',
                overflow: 'hidden',
                minHeight: '260px',
                WebkitTapHighlightColor: 'transparent',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.borderColor = p.accent;
                e.currentTarget.style.boxShadow = `0 12px 30px rgba(0, 0, 0, 0.6), 0 0 20px ${p.accent}22`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.borderColor = 'var(--fp-border)';
                e.currentTarget.style.boxShadow = 'var(--fp-shadow-md)';
              }}
            >
              <div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '24px',
                  }}
                >
                  <div
                    style={{
                      width: '64px',
                      height: '64px',
                      borderRadius: '16px',
                      background: 'var(--fp-surface-2)',
                      border: '1px solid var(--fp-border-strong)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {p.icon}
                  </div>
                  <span
                    style={{
                      fontSize: '0.7rem',
                      fontWeight: 800,
                      letterSpacing: '0.08em',
                      color: p.accent,
                      background: `${p.accent}14`,
                      border: `1px solid ${p.accent}33`,
                      padding: '4px 10px',
                      borderRadius: '6px',
                    }}
                  >
                    {p.badge}
                  </span>
                </div>

                <h3 style={{ fontSize: '1.35rem', fontWeight: 700, marginBottom: '12px' }}>{p.title}</h3>
                <p style={{ color: 'var(--fp-text-secondary)', fontSize: '0.925rem', lineHeight: 1.6, marginBottom: '32px' }}>
                  {p.desc}
                </p>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingTop: '20px',
                  borderTop: '1px solid var(--fp-border)',
                }}
              >
                <span style={{ fontSize: '0.95rem', fontWeight: 700, color: p.accent }}>
                  {p.buttonText}
                </span>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    background: `${p.accent}1a`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: p.accent,
                  }}
                >
                  <ArrowRight size={18} weight="bold" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
