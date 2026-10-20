import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Buildings,
  Storefront,
  User,
  ShieldCheck,
  QrCode,
  ArrowsClockwise,
  CreditCard,
  CheckCircle,
  ChartLineUp,
  LockKey,
  DeviceMobile,
  ArrowRight,
  List,
  X,
} from '@phosphor-icons/react';

export default function LandingPage() {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [splitAmount, setSplitAmount] = useState(2500);
  const employeeCredit = 1800;

  const creditPortion = Math.min(splitAmount, employeeCredit);
  const copayPortion = Math.max(0, splitAmount - employeeCredit);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--fp-bg)', color: 'var(--fp-text-primary)', overflowX: 'hidden' }}>
      {/* 1. Header / Navbar */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 60,
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          background: 'rgba(6, 10, 20, 0.88)',
          borderBottom: '1px solid var(--fp-border)',
        }}
      >
        <div
          style={{
            maxWidth: '1200px',
            margin: '0 auto',
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          {/* Logo */}
          <div
            onClick={() => navigate('/')}
            style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}
          >
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: '18px',
                color: '#FFFFFF',
                boxShadow: '0 0 16px rgba(16, 185, 129, 0.35)',
              }}
            >
              F
            </div>
            <div>
              <span style={{ fontSize: '1.2rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
                Flex<span style={{ color: 'var(--fp-benefit)' }}>Pay</span>
              </span>
              <span
                style={{
                  fontSize: '0.625rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.12em',
                  background: 'rgba(16, 185, 129, 0.15)',
                  color: 'var(--fp-benefit)',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  marginLeft: '6px',
                  fontWeight: 700,
                }}
              >
                v2.0 ETH
              </span>
            </div>
          </div>

          {/* Desktop Navigation Links */}
          <nav
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '28px',
            }}
            className="landing-desktop-nav"
          >
            <a
              href="#how-it-works"
              style={{ color: 'var(--fp-text-secondary)', fontSize: '0.9rem', fontWeight: 500 }}
            >
              How It Works
            </a>
            <a
              href="#features"
              style={{ color: 'var(--fp-text-secondary)', fontSize: '0.9rem', fontWeight: 500 }}
            >
              Features
            </a>
            <a
              href="#pillars"
              style={{ color: 'var(--fp-text-secondary)', fontSize: '0.9rem', fontWeight: 500 }}
            >
              Ecosystem
            </a>
          </nav>

          {/* CTA & Mobile Hamburger */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={() => navigate('/auth')}
              style={{
                padding: '10px 20px',
                minHeight: 'var(--fp-touch-min, 44px)',
                borderRadius: '8px',
                background: 'var(--fp-benefit)',
                color: '#060A14',
                fontWeight: 700,
                fontSize: '0.875rem',
                border: 'none',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 0 20px rgba(16, 185, 129, 0.25)',
                transition: 'all 0.2s ease',
              }}
            >
              <span>Get Started</span>
              <ArrowRight size={16} weight="bold" />
            </button>

            {/* Mobile Hamburger Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="landing-mob-toggle"
              aria-label={mobileMenuOpen ? 'Close navigation' : 'Open navigation'}
              style={{
                background: 'var(--fp-surface-2)',
                border: '1px solid var(--fp-border)',
                borderRadius: '8px',
                color: 'var(--fp-text-primary)',
                minWidth: '44px',
                minHeight: '44px',
                display: 'none',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              {mobileMenuOpen ? <X size={20} /> : <List size={20} />}
            </button>
          </div>
        </div>

        {/* Collapsible Mobile Menu */}
        {mobileMenuOpen && (
          <div
            style={{
              padding: '16px 20px 24px',
              borderTop: '1px solid var(--fp-border)',
              background: 'rgba(12, 19, 34, 0.98)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            <a
              href="#how-it-works"
              onClick={() => setMobileMenuOpen(false)}
              style={{
                color: 'var(--fp-text-primary)',
                fontSize: '1rem',
                fontWeight: 600,
                padding: '8px 0',
              }}
            >
              How It Works
            </a>
            <a
              href="#features"
              onClick={() => setMobileMenuOpen(false)}
              style={{
                color: 'var(--fp-text-primary)',
                fontSize: '1rem',
                fontWeight: 600,
                padding: '8px 0',
              }}
            >
              Features
            </a>
            <a
              href="#pillars"
              onClick={() => setMobileMenuOpen(false)}
              style={{
                color: 'var(--fp-text-primary)',
                fontSize: '1rem',
                fontWeight: 600,
                padding: '8px 0',
              }}
            >
              Ecosystem
            </a>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', paddingTop: '8px' }}>
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  navigate('/auth/organization');
                }}
                style={{
                  padding: '12px',
                  borderRadius: '8px',
                  background: 'var(--fp-surface-2)',
                  border: '1px solid var(--fp-border)',
                  color: 'var(--fp-text-primary)',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Organizations
              </button>
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  navigate('/auth/employee');
                }}
                style={{
                  padding: '12px',
                  borderRadius: '8px',
                  background: 'var(--fp-surface-2)',
                  border: '1px solid var(--fp-border)',
                  color: 'var(--fp-text-primary)',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Employees
              </button>
            </div>
          </div>
        )}
      </header>

      {/* 2. Hero Section */}
      <section
        style={{
          position: 'relative',
          padding: 'clamp(40px, 8vw, 80px) 16px clamp(48px, 10vw, 100px)',
          maxWidth: '1200px',
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))',
          gap: ' clamp(32px, 6vw, 48px)',
          alignItems: 'center',
        }}
      >
        <div>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 12px',
              borderRadius: '999px',
              background: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              color: 'var(--fp-benefit)',
              fontSize: '0.8rem',
              fontWeight: 600,
              marginBottom: '20px',
            }}
          >
            <ShieldCheck size={18} weight="fill" />
            <span>Safaricom M-PESA Ethiopia Integrated</span>
          </div>

          <h1
            style={{
              fontSize: 'clamp(2rem, 5.5vw, 3.6rem)',
              lineHeight: 1.15,
              fontWeight: 800,
              letterSpacing: '-0.03em',
              marginBottom: '20px',
            }}
          >
            Employee Benefits, <br />
            <span
              style={{
                background: 'linear-gradient(135deg, #10B981 0%, #38BDF8 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              Powered by M-PESA
            </span>
          </h1>

          <p
            style={{
              fontSize: 'clamp(0.95rem, 2.5vw, 1.125rem)',
              color: 'var(--fp-text-secondary)',
              lineHeight: 1.65,
              marginBottom: '32px',
              maxWidth: '520px',
            }}
          >
            Institutional benefit allowances and salary-linked co-pays across verified merchants in
            Ethiopia. Zero cash handling, instant QR verification, and automated payroll settlement.
          </p>

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <button
              onClick={() => navigate('/auth/organization')}
              style={{
                padding: '14px 24px',
                minHeight: 'var(--fp-touch-comfortable, 48px)',
                borderRadius: '10px',
                background: 'var(--fp-benefit)',
                color: '#060A14',
                fontWeight: 700,
                fontSize: '0.95rem',
                border: 'none',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                boxShadow: '0 4px 24px rgba(16, 185, 129, 0.3)',
                flex: '1 1 180px',
              }}
            >
              <Buildings size={20} weight="bold" />
              For Organizations
            </button>
            <button
              onClick={() => navigate('/auth/merchant')}
              style={{
                padding: '14px 24px',
                minHeight: 'var(--fp-touch-comfortable, 48px)',
                borderRadius: '10px',
                background: 'var(--fp-surface-2)',
                color: 'var(--fp-text-primary)',
                fontWeight: 600,
                fontSize: '0.95rem',
                border: '1px solid var(--fp-border-strong)',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                flex: '1 1 180px',
              }}
            >
              <Storefront size={20} weight="bold" />
              For Merchants
            </button>
            <button
              onClick={() => navigate('/auth/employee')}
              style={{
                padding: '14px 24px',
                minHeight: 'var(--fp-touch-comfortable, 48px)',
                borderRadius: '10px',
                background: 'transparent',
                color: 'var(--fp-text-secondary)',
                fontWeight: 600,
                fontSize: '0.95rem',
                border: '1px solid var(--fp-border)',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                flex: '1 1 180px',
              }}
            >
              <User size={20} weight="bold" />
              Employee Login
            </button>
          </div>
        </div>

        {/* Interactive Payment Split Demo Widget */}
        <div
          style={{
            background: 'var(--fp-surface-1)',
            border: '1px solid var(--fp-border-strong)',
            borderRadius: '20px',
            padding: 'clamp(20px, 4vw, 32px)',
            boxShadow: 'var(--fp-shadow-lg)',
            position: 'relative',
            width: '100%',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '20px',
              paddingBottom: '14px',
              borderBottom: '1px solid var(--fp-border)',
            }}
          >
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--fp-text-muted)', textTransform: 'uppercase' }}>
                Live Demo
              </span>
              <h3 style={{ fontSize: '1.15rem', margin: '2px 0 0' }}>Automated SplitEngine™</h3>
            </div>
            <span
              style={{
                background: 'rgba(56, 189, 248, 0.15)',
                color: '#38BDF8',
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '0.75rem',
                fontWeight: 700,
              }}
            >
              REAL-TIME
            </span>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.875rem', color: 'var(--fp-text-secondary)' }}>Purchase Order Total</span>
              <span className="mono" style={{ fontSize: '1.2rem', fontWeight: 700 }}>
                ETB {splitAmount.toLocaleString()}
              </span>
            </div>
            <input
              type="range"
              min="500"
              max="5000"
              step="100"
              value={splitAmount}
              onChange={(e) => setSplitAmount(Number(e.target.value))}
              style={{
                width: '100%',
                accentColor: 'var(--fp-benefit)',
                cursor: 'pointer',
                height: '32px',
              }}
            />
          </div>

          {/* Visualization bar */}
          <div
            style={{
              height: '14px',
              borderRadius: '7px',
              background: 'var(--fp-surface-3)',
              display: 'flex',
              overflow: 'hidden',
              marginBottom: '20px',
            }}
          >
            <div
              style={{
                width: `${(creditPortion / splitAmount) * 100}%`,
                background: 'linear-gradient(90deg, #10B981, #059669)',
                transition: 'width 0.2s ease',
              }}
            />
            <div
              style={{
                width: `${(copayPortion / splitAmount) * 100}%`,
                background: 'linear-gradient(90deg, #F59E0B, #D97706)',
                transition: 'width 0.2s ease',
              }}
            />
          </div>

          {/* Breakdown cards */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 140px), 1fr))',
              gap: '12px',
            }}
          >
            <div
              style={{
                background: 'rgba(16, 185, 129, 0.08)',
                border: '1px solid rgba(16, 185, 129, 0.2)',
                borderRadius: '12px',
                padding: '14px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10B981', flexShrink: 0 }} />
                <span style={{ fontSize: '0.75rem', color: 'var(--fp-text-secondary)' }}>Employer Benefit</span>
              </div>
              <div className="mono" style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--fp-benefit)' }}>
                ETB {creditPortion.toLocaleString()}
              </div>
              <span style={{ fontSize: '0.7rem', color: 'var(--fp-text-muted)' }}>Covered 100% by Org</span>
            </div>

            <div
              style={{
                background: 'rgba(245, 158, 11, 0.08)',
                border: '1px solid rgba(245, 158, 11, 0.2)',
                borderRadius: '12px',
                padding: '14px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#F59E0B', flexShrink: 0 }} />
                <span style={{ fontSize: '0.75rem', color: 'var(--fp-text-secondary)' }}>M-PESA Co-Pay</span>
              </div>
              <div className="mono" style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--fp-salary)' }}>
                ETB {copayPortion.toLocaleString()}
              </div>
              <span style={{ fontSize: '0.7rem', color: 'var(--fp-text-muted)' }}>
                {copayPortion > 0 ? 'Sent via STK Push' : 'Zero co-pay required'}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Stats Ticker */}
      <section
        style={{
          borderTop: '1px solid var(--fp-border)',
          borderBottom: '1px solid var(--fp-border)',
          background: 'var(--fp-surface-1)',
          padding: ' clamp(28px, 6vw, 40px) 16px',
        }}
      >
        <div
          style={{
            maxWidth: '1200px',
            margin: '0 auto',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 140px), 1fr))',
            gap: '24px',
            textAlign: 'center',
          }}
        >
          <div>
            <div className="mono" style={{ fontSize: 'clamp(1.75rem, 5vw, 2.5rem)', fontWeight: 800, color: 'var(--fp-benefit)' }}>
              100%
            </div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--fp-text-secondary)', marginTop: '4px' }}>
              Audit Compliance Invariant
            </div>
          </div>
          <div>
            <div className="mono" style={{ fontSize: 'clamp(1.75rem, 5vw, 2.5rem)', fontWeight: 800, color: '#38BDF8' }}>
              &lt; 1.2s
            </div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--fp-text-secondary)', marginTop: '4px' }}>
              M-PESA STK Push Latency
            </div>
          </div>
          <div>
            <div className="mono" style={{ fontSize: 'clamp(1.75rem, 5vw, 2.5rem)', fontWeight: 800, color: 'var(--fp-salary)' }}>
              ETB 0.00
            </div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--fp-text-secondary)', marginTop: '4px' }}>
              Cash Handling Risk
            </div>
          </div>
          <div>
            <div className="mono" style={{ fontSize: 'clamp(1.75rem, 5vw, 2.5rem)', fontWeight: 800, color: '#A855F7' }}>
              99.98%
            </div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--fp-text-secondary)', marginTop: '4px' }}>
              Ledger Settlement Reliability
            </div>
          </div>
        </div>
      </section>

      {/* 4. How It Works */}
      <section id="how-it-works" style={{ padding: 'clamp(48px, 8vw, 100px) 16px', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 'clamp(36px, 6vw, 64px)' }}>
          <span style={{ color: 'var(--fp-benefit)', fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.1em' }}>
            WORKFLOW ARCHITECTURE
          </span>
          <h2 style={{ fontSize: 'clamp(1.6rem, 4vw, 2.2rem)', marginTop: '8px' }}>
            How FlexPay Works in 3 Steps
          </h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: '24px' }}>
          <div
            style={{
              background: 'var(--fp-surface-1)',
              border: '1px solid var(--fp-border)',
              borderRadius: '16px',
              padding: 'clamp(20px, 4vw, 32px)',
            }}
          >
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                background: 'rgba(16, 185, 129, 0.15)',
                color: 'var(--fp-benefit)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '16px',
              }}
            >
              <CreditCard size={24} weight="bold" />
            </div>
            <h3 style={{ marginBottom: '10px' }}>1. Fund & Allocate</h3>
            <p style={{ color: 'var(--fp-text-secondary)', lineHeight: 1.6, fontSize: '0.9rem' }}>
              Employers configure corporate credit policies and onboard staff. Employees receive unique Luhn-checksum
              FP-IDs and 16-character cryptographic credentials.
            </p>
          </div>

          <div
            style={{
              background: 'var(--fp-surface-1)',
              border: '1px solid var(--fp-border)',
              borderRadius: '16px',
              padding: 'clamp(20px, 4vw, 32px)',
            }}
          >
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                background: 'rgba(56, 189, 248, 0.15)',
                color: '#38BDF8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '16px',
              }}
            >
              <QrCode size={24} weight="bold" />
            </div>
            <h3 style={{ marginBottom: '10px' }}>2. Instant Split Purchase</h3>
            <p style={{ color: 'var(--fp-text-secondary)', lineHeight: 1.6, fontSize: '0.9rem' }}>
              Employees scan QR codes at verified grocers, pharmacies, and transport stations. The SplitEngine calculates
              benefits and prompts co-pay via M-PESA STK Push.
            </p>
          </div>

          <div
            style={{
              background: 'var(--fp-surface-1)',
              border: '1px solid var(--fp-border)',
              borderRadius: '16px',
              padding: 'clamp(20px, 4vw, 32px)',
            }}
          >
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                background: 'rgba(245, 158, 11, 0.15)',
                color: 'var(--fp-salary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '16px',
              }}
            >
              <ArrowsClockwise size={24} weight="bold" />
            </div>
            <h3 style={{ marginBottom: '10px' }}>3. Automated Payroll Settlement</h3>
            <p style={{ color: 'var(--fp-text-secondary)', lineHeight: 1.6, fontSize: '0.9rem' }}>
              At month-end, one-click settlement executes M-PESA B2C wires to merchants, deducts employee payroll, and
              automatically resets employee credit limits.
            </p>
          </div>
        </div>
      </section>

      {/* 5. Features Grid */}
      <section id="features" style={{ background: 'var(--fp-surface-1)', padding: 'clamp(48px, 8vw, 100px) 16px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 'clamp(36px, 6vw, 64px)' }}>
            <span style={{ color: 'var(--fp-benefit)', fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.1em' }}>
              SECURITY & FINTECH CAPABILITIES
            </span>
            <h2 style={{ fontSize: 'clamp(1.6rem, 4vw, 2.2rem)', marginTop: '8px' }}>Enterprise-Grade Controls</h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: '20px' }}>
            <div style={{ background: 'var(--fp-surface-2)', border: '1px solid var(--fp-border)', borderRadius: '16px', padding: 'clamp(20px, 4vw, 28px)' }}>
              <LockKey size={26} color="var(--fp-benefit)" weight="bold" style={{ marginBottom: '14px' }} />
              <h4 style={{ fontSize: '1.05rem', fontWeight: 700 }}>CSPRNG & Rejection Sampling</h4>
              <p style={{ marginTop: '8px', fontSize: '0.875rem', lineHeight: 1.55 }}>
                Zero plain-text password storage. Org Admins receive generated 16-character credentials shown once with auto-expiring modal.
              </p>
            </div>

            <div style={{ background: 'var(--fp-surface-2)', border: '1px solid var(--fp-border)', borderRadius: '16px', padding: 'clamp(20px, 4vw, 28px)' }}>
              <DeviceMobile size={26} color="#38BDF8" weight="bold" style={{ marginBottom: '14px' }} />
              <h4 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Safaricom Daraja Webhooks</h4>
              <p style={{ marginTop: '8px', fontSize: '0.875rem', lineHeight: 1.55 }}>
                Instant HTTP 200 acknowledgment with automatic credit reversal if employee cancels STK push on their handset.
              </p>
            </div>

            <div style={{ background: 'var(--fp-surface-2)', border: '1px solid var(--fp-border)', borderRadius: '16px', padding: 'clamp(20px, 4vw, 28px)' }}>
              <ChartLineUp size={26} color="var(--fp-salary)" weight="bold" style={{ marginBottom: '14px' }} />
              <h4 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Double-Entry Ledger</h4>
              <p style={{ marginTop: '8px', fontSize: '0.875rem', lineHeight: 1.55 }}>
                Strict invariant enforcement: SUM(debits) === SUM(credits) on every financial movement before committing to disk.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 6. Ecosystem Pillars */}
      <section id="pillars" style={{ padding: 'clamp(48px, 8vw, 100px) 16px', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 'clamp(36px, 6vw, 64px)' }}>
          <h2 style={{ fontSize: 'clamp(1.6rem, 4vw, 2.2rem)' }}>Built for the Entire Ethiopian Ecosystem</h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: '24px' }}>
          <div style={{ border: '1px solid var(--fp-border)', borderRadius: '16px', padding: 'clamp(20px, 4vw, 32px)', background: 'var(--fp-surface-1)' }}>
            <Buildings size={32} color="var(--fp-benefit)" weight="bold" style={{ marginBottom: '14px' }} />
            <h3 style={{ marginBottom: '10px' }}>Organizations</h3>
            <ul style={{ listStyle: 'none', padding: 0, color: 'var(--fp-text-secondary)', fontSize: '0.875rem', lineHeight: 1.8 }}>
              <li>✓ Attract & retain top talent with food/health benefits</li>
              <li>✓ Real-time utilization dashboards & spend limits</li>
              <li>✓ One-click payroll settlement with automated M-PESA B2C</li>
            </ul>
          </div>

          <div style={{ border: '1px solid var(--fp-border)', borderRadius: '16px', padding: 'clamp(20px, 4vw, 32px)', background: 'var(--fp-surface-1)' }}>
            <User size={32} color="#38BDF8" weight="bold" style={{ marginBottom: '14px' }} />
            <h3 style={{ marginBottom: '10px' }}>Employees</h3>
            <ul style={{ listStyle: 'none', padding: 0, color: 'var(--fp-text-secondary)', fontSize: '0.875rem', lineHeight: 1.8 }}>
              <li>✓ Zero cash needed for daily meal and transit expenses</li>
              <li>✓ Instant QR payment at certified partner merchants</li>
              <li>✓ Effortless co-pay via M-PESA on checkout</li>
            </ul>
          </div>

          <div style={{ border: '1px solid var(--fp-border)', borderRadius: '16px', padding: 'clamp(20px, 4vw, 32px)', background: 'var(--fp-surface-1)' }}>
            <Storefront size={32} color="var(--fp-salary)" weight="bold" style={{ marginBottom: '14px' }} />
            <h3 style={{ marginBottom: '10px' }}>Merchants</h3>
            <ul style={{ listStyle: 'none', padding: 0, color: 'var(--fp-text-secondary)', fontSize: '0.875rem', lineHeight: 1.8 }}>
              <li>✓ Guaranteed corporate receivables backed by employer credit</li>
              <li>✓ 2-second POS verification by Luhn FP-ID</li>
              <li>✓ Direct wire payouts to merchant M-PESA till</li>
            </ul>
          </div>
        </div>
      </section>

      {/* 7. Footer */}
      <footer
        style={{
          borderTop: '1px solid var(--fp-border)',
          background: 'var(--fp-surface-1)',
          padding: 'clamp(32px, 6vw, 48px) 16px calc(32px + var(--fp-safe-bottom, 0px))',
        }}
      >
        <div
          style={{
            maxWidth: '1200px',
            margin: '0 auto',
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '20px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '30px',
                height: '30px',
                borderRadius: '8px',
                background: 'var(--fp-benefit)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                color: '#060A14',
              }}
            >
              F
            </div>
            <div>
              <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>FlexPay Ethiopia</span>
              <p style={{ color: 'var(--fp-text-muted)', fontSize: '0.8rem', margin: 0 }}>
                © {new Date().getFullYear()} Markova Technologies. All rights reserved.
              </p>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '12px 16px',
              color: 'var(--fp-text-secondary)',
              fontSize: '0.8rem',
            }}
          >
            <span>NBE & CBE Compliant</span>
            <span>•</span>
            <span>Argon2id & RS256 Secured</span>
            <span>•</span>
            <span>Safaricom M-PESA Certified</span>
          </div>
        </div>
      </footer>

      {/* Responsive media rules for landing page */}
      <style>{`
        @media (max-width: 768px) {
          .landing-desktop-nav {
            display: none !important;
          }
          .landing-mob-toggle {
            display: inline-flex !important;
          }
        }
      `}</style>
    </div>
  );
}
