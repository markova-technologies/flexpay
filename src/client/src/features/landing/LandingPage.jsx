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
  ArrowRight
} from '@phosphor-icons/react';

export default function LandingPage() {
  const navigate = useNavigate();
  const [splitAmount, setSplitAmount] = useState(2500);
  const employeeCredit = 1800;

  const creditPortion = Math.min(splitAmount, employeeCredit);
  const copayPortion = Math.max(0, splitAmount - employeeCredit);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--fp-bg)', color: 'var(--fp-text-primary)' }}>
      {/* 1. Header / Navbar */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          backdropFilter: 'blur(16px)',
          background: 'rgba(6, 10, 20, 0.85)',
          borderBottom: '1px solid var(--fp-border)',
        }}
      >
        <div
          style={{
            maxWidth: '1200px',
            margin: '0 auto',
            padding: '16px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          {/* Logo */}
          <div
            onClick={() => navigate('/')}
            style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}
          >
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: '20px',
                color: '#FFFFFF',
                boxShadow: '0 0 16px rgba(16, 185, 129, 0.35)',
              }}
            >
              F
            </div>
            <div>
              <span style={{ fontSize: '1.25rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
                Flex<span style={{ color: 'var(--fp-benefit)' }}>Pay</span>
              </span>
              <span
                style={{
                  fontSize: '0.65rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.12em',
                  background: 'rgba(16, 185, 129, 0.15)',
                  color: 'var(--fp-benefit)',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  marginLeft: '8px',
                  fontWeight: 700,
                }}
              >
                v2.0 ETH
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav style={{ display: 'flex', alignItems: 'center', gap: '28px' }}>
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

          {/* CTA */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={() => navigate('/auth')}
              style={{
                padding: '10px 22px',
                borderRadius: '8px',
                background: 'var(--fp-benefit)',
                color: '#060A14',
                fontWeight: 700,
                fontSize: '0.9rem',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 0 20px rgba(16, 185, 129, 0.25)',
                transition: 'all 0.2s ease',
              }}
            >
              Get Started
              <ArrowRight size={16} weight="bold" />
            </button>
          </div>
        </div>
      </header>

      {/* 2. Hero Section */}
      <section
        style={{
          position: 'relative',
          padding: '80px 24px 100px',
          maxWidth: '1200px',
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '48px',
          alignItems: 'center',
        }}
      >
        <div>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 14px',
              borderRadius: '999px',
              background: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              color: 'var(--fp-benefit)',
              fontSize: '0.825rem',
              fontWeight: 600,
              marginBottom: '24px',
            }}
          >
            <ShieldCheck size={18} weight="fill" />
            Safaricom M-PESA Ethiopia Integrated
          </div>

          <h1
            style={{
              fontSize: 'clamp(2.4rem, 4vw, 3.6rem)',
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
              fontSize: '1.125rem',
              color: 'var(--fp-text-secondary)',
              lineHeight: 1.65,
              marginBottom: '36px',
              maxWidth: '520px',
            }}
          >
            Institutional benefit allowances and salary-linked co-pays across verified merchants in
            Ethiopia. Zero cash handling, instant QR verification, and automated payroll settlement.
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
            <button
              onClick={() => navigate('/auth/organization')}
              style={{
                padding: '14px 28px',
                borderRadius: '10px',
                background: 'var(--fp-benefit)',
                color: '#060A14',
                fontWeight: 700,
                fontSize: '1rem',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                boxShadow: '0 4px 24px rgba(16, 185, 129, 0.3)',
              }}
            >
              <Buildings size={20} weight="bold" />
              For Organizations
            </button>
            <button
              onClick={() => navigate('/auth/merchant')}
              style={{
                padding: '14px 28px',
                borderRadius: '10px',
                background: 'var(--fp-surface-2)',
                color: 'var(--fp-text-primary)',
                fontWeight: 600,
                fontSize: '1rem',
                border: '1px solid var(--fp-border-strong)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
              }}
            >
              <Storefront size={20} weight="bold" />
              For Merchants
            </button>
            <button
              onClick={() => navigate('/auth/employee')}
              style={{
                padding: '14px 28px',
                borderRadius: '10px',
                background: 'transparent',
                color: 'var(--fp-text-secondary)',
                fontWeight: 600,
                fontSize: '1rem',
                border: '1px solid var(--fp-border)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
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
            padding: '32px',
            boxShadow: 'var(--fp-shadow-lg)',
            position: 'relative',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '24px',
              paddingBottom: '16px',
              borderBottom: '1px solid var(--fp-border)',
            }}
          >
            <div>
              <span style={{ fontSize: '0.8rem', color: 'var(--fp-text-muted)', textTransform: 'uppercase' }}>
                Live Demo
              </span>
              <h3 style={{ fontSize: '1.2rem', margin: '2px 0 0' }}>Automated SplitEngine™</h3>
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

          <div style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.9rem', color: 'var(--fp-text-secondary)' }}>Purchase Order Total</span>
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
              marginBottom: '24px',
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div
              style={{
                background: 'rgba(16, 185, 129, 0.08)',
                border: '1px solid rgba(16, 185, 129, 0.2)',
                borderRadius: '12px',
                padding: '16px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10B981' }} />
                <span style={{ fontSize: '0.8rem', color: 'var(--fp-text-secondary)' }}>Employer Benefit</span>
              </div>
              <div className="mono" style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--fp-benefit)' }}>
                ETB {creditPortion.toLocaleString()}
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--fp-text-muted)' }}>Covered 100% by Org</span>
            </div>

            <div
              style={{
                background: 'rgba(245, 158, 11, 0.08)',
                border: '1px solid rgba(245, 158, 11, 0.2)',
                borderRadius: '12px',
                padding: '16px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#F59E0B' }} />
                <span style={{ fontSize: '0.8rem', color: 'var(--fp-text-secondary)' }}>M-PESA Co-Pay</span>
              </div>
              <div className="mono" style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--fp-salary)' }}>
                ETB {copayPortion.toLocaleString()}
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--fp-text-muted)' }}>
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
          padding: '40px 24px',
        }}
      >
        <div
          style={{
            maxWidth: '1200px',
            margin: '0 auto',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '32px',
            textAlign: 'center',
          }}
        >
          <div>
            <div className="mono" style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--fp-benefit)' }}>
              100%
            </div>
            <div style={{ fontSize: '0.875rem', color: 'var(--fp-text-secondary)' }}>Audit Compliance Invariant</div>
          </div>
          <div>
            <div className="mono" style={{ fontSize: '2.5rem', fontWeight: 800, color: '#38BDF8' }}>
              &lt; 1.2s
            </div>
            <div style={{ fontSize: '0.875rem', color: 'var(--fp-text-secondary)' }}>M-PESA STK Push Latency</div>
          </div>
          <div>
            <div className="mono" style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--fp-salary)' }}>
              ETB 0.00
            </div>
            <div style={{ fontSize: '0.875rem', color: 'var(--fp-text-secondary)' }}>Cash Handling Risk</div>
          </div>
          <div>
            <div className="mono" style={{ fontSize: '2.5rem', fontWeight: 800, color: '#A855F7' }}>
              99.98%
            </div>
            <div style={{ fontSize: '0.875rem', color: 'var(--fp-text-secondary)' }}>Ledger Settlement Reliability</div>
          </div>
        </div>
      </section>

      {/* 4. How It Works */}
      <section id="how-it-works" style={{ padding: '100px 24px', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '64px' }}>
          <span style={{ color: 'var(--fp-benefit)', fontSize: '0.85rem', fontWeight: 700, letterSpacing: '0.1em' }}>
            WORKFLOW ARCHITECTURE
          </span>
          <h2 style={{ fontSize: '2.2rem', marginTop: '8px' }}>How FlexPay Works in 3 Steps</h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '32px' }}>
          <div
            style={{
              background: 'var(--fp-surface-1)',
              border: '1px solid var(--fp-border)',
              borderRadius: '16px',
              padding: '32px',
            }}
          >
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                background: 'rgba(16, 185, 129, 0.15)',
                color: 'var(--fp-benefit)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '20px',
              }}
            >
              <CreditCard size={26} weight="bold" />
            </div>
            <h3 style={{ marginBottom: '12px' }}>1. Fund & Allocate</h3>
            <p style={{ color: 'var(--fp-text-secondary)', lineHeight: 1.6 }}>
              Employers configure corporate credit policies and onboard staff. Employees receive unique Luhn-checksum
              FP-IDs and 16-character cryptographic credentials.
            </p>
          </div>

          <div
            style={{
              background: 'var(--fp-surface-1)',
              border: '1px solid var(--fp-border)',
              borderRadius: '16px',
              padding: '32px',
            }}
          >
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                background: 'rgba(56, 189, 248, 0.15)',
                color: '#38BDF8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '20px',
              }}
            >
              <QrCode size={26} weight="bold" />
            </div>
            <h3 style={{ marginBottom: '12px' }}>2. Instant Split Purchase</h3>
            <p style={{ color: 'var(--fp-text-secondary)', lineHeight: 1.6 }}>
              Employees scan QR codes at verified grocers, pharmacies, and transport stations. The SplitEngine calculates
              benefits and prompts co-pay via M-PESA STK Push.
            </p>
          </div>

          <div
            style={{
              background: 'var(--fp-surface-1)',
              border: '1px solid var(--fp-border)',
              borderRadius: '16px',
              padding: '32px',
            }}
          >
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                background: 'rgba(245, 158, 11, 0.15)',
                color: 'var(--fp-salary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '20px',
              }}
            >
              <ArrowsClockwise size={26} weight="bold" />
            </div>
            <h3 style={{ marginBottom: '12px' }}>3. Automated Payroll Settlement</h3>
            <p style={{ color: 'var(--fp-text-secondary)', lineHeight: 1.6 }}>
              At month-end, one-click settlement executes M-PESA B2C wires to merchants, deducts employee payroll, and
              automatically resets employee credit limits.
            </p>
          </div>
        </div>
      </section>

      {/* 5. Features Grid */}
      <section id="features" style={{ background: 'var(--fp-surface-1)', padding: '100px 24px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '64px' }}>
            <span style={{ color: 'var(--fp-benefit)', fontSize: '0.85rem', fontWeight: 700, letterSpacing: '0.1em' }}>
              SECURITY & FINTECH CAPABILITIES
            </span>
            <h2 style={{ fontSize: '2.2rem', marginTop: '8px' }}>Enterprise-Grade Controls</h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '28px' }}>
            <div style={{ background: 'var(--fp-surface-2)', border: '1px solid var(--fp-border)', borderRadius: '16px', padding: '28px' }}>
              <LockKey size={28} color="var(--fp-benefit)" weight="bold" style={{ marginBottom: '16px' }} />
              <h4>CSPRNG & Rejection Sampling</h4>
              <p style={{ marginTop: '8px', fontSize: '0.9rem' }}>
                Zero plain-text password storage. Org Admins receive generated 16-character credentials shown once with auto-expiring modal.
              </p>
            </div>

            <div style={{ background: 'var(--fp-surface-2)', border: '1px solid var(--fp-border)', borderRadius: '16px', padding: '28px' }}>
              <DeviceMobile size={28} color="#38BDF8" weight="bold" style={{ marginBottom: '16px' }} />
              <h4>Safaricom Daraja Webhooks</h4>
              <p style={{ marginTop: '8px', fontSize: '0.9rem' }}>
                Instant HTTP 200 acknowledgment with automatic credit reversal if employee cancels STK push on their handset.
              </p>
            </div>

            <div style={{ background: 'var(--fp-surface-2)', border: '1px solid var(--fp-border)', borderRadius: '16px', padding: '28px' }}>
              <ChartLineUp size={28} color="var(--fp-salary)" weight="bold" style={{ marginBottom: '16px' }} />
              <h4>Double-Entry Ledger</h4>
              <p style={{ marginTop: '8px', fontSize: '0.9rem' }}>
                Strict invariant enforcement: SUM(debits) === SUM(credits) on every financial movement before committing to disk.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 6. Ecosystem Pillars */}
      <section id="pillars" style={{ padding: '100px 24px', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '64px' }}>
          <h2 style={{ fontSize: '2.2rem' }}>Built for the Entire Ethiopian Ecosystem</h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '32px' }}>
          <div style={{ border: '1px solid var(--fp-border)', borderRadius: '16px', padding: '32px', background: 'var(--fp-surface-1)' }}>
            <Buildings size={36} color="var(--fp-benefit)" weight="bold" style={{ marginBottom: '16px' }} />
            <h3 style={{ marginBottom: '12px' }}>Organizations</h3>
            <ul style={{ listStyle: 'none', padding: 0, color: 'var(--fp-text-secondary)', fontSize: '0.9rem', lineHeight: 2 }}>
              <li>✓ Attract & retain top talent with food/health benefits</li>
              <li>✓ Real-time utilization dashboards & spend limits</li>
              <li>✓ One-click payroll settlement with automated M-PESA B2C</li>
            </ul>
          </div>

          <div style={{ border: '1px solid var(--fp-border)', borderRadius: '16px', padding: '32px', background: 'var(--fp-surface-1)' }}>
            <User size={36} color="#38BDF8" weight="bold" style={{ marginBottom: '16px' }} />
            <h3 style={{ marginBottom: '12px' }}>Employees</h3>
            <ul style={{ listStyle: 'none', padding: 0, color: 'var(--fp-text-secondary)', fontSize: '0.9rem', lineHeight: 2 }}>
              <li>✓ Zero cash needed for daily meal and transit expenses</li>
              <li>✓ Instant QR payment at certified partner merchants</li>
              <li>✓ Effortless co-pay via M-PESA on checkout</li>
            </ul>
          </div>

          <div style={{ border: '1px solid var(--fp-border)', borderRadius: '16px', padding: '32px', background: 'var(--fp-surface-1)' }}>
            <Storefront size={36} color="var(--fp-salary)" weight="bold" style={{ marginBottom: '16px' }} />
            <h3 style={{ marginBottom: '12px' }}>Merchants</h3>
            <ul style={{ listStyle: 'none', padding: 0, color: 'var(--fp-text-secondary)', fontSize: '0.9rem', lineHeight: 2 }}>
              <li>✓ Guaranteed corporate receivables backed by employer credit</li>
              <li>✓ 2-second POS verification by Luhn FP-ID</li>
              <li>✓ Direct wire payouts to merchant M-PESA till</li>
            </ul>
          </div>
        </div>
      </section>

      {/* 7. Footer */}
      <footer style={{ borderTop: '1px solid var(--fp-border)', background: 'var(--fp-surface-1)', padding: '48px 24px' }}>
        <div
          style={{
            maxWidth: '1200px',
            margin: '0 auto',
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '24px',
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
            <span style={{ fontWeight: 700 }}>FlexPay Ethiopia</span>
            <span style={{ color: 'var(--fp-text-muted)', fontSize: '0.85rem' }}>
              © {new Date().getFullYear()} Markova Technologies. All rights reserved.
            </span>
          </div>

          <div style={{ display: 'flex', gap: '24px', color: 'var(--fp-text-secondary)', fontSize: '0.875rem' }}>
            <span>NBE & CBE Compliant</span>
            <span>•</span>
            <span>Argon2id & RS256 Secured</span>
            <span>•</span>
            <span>Safaricom M-PESA Certified</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
