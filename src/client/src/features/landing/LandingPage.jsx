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
  ChartLineUp,
  LockKey,
  DeviceMobile,
  ArrowRight,
  FolderSimple,
  Sparkle,
} from '@phosphor-icons/react';
import SculptureHero from '@/components/ui/liquid-sculpture-hero';
import GlassFolder from '@/components/ui/glass-folder-cards';

export default function LandingPage() {
  const navigate = useNavigate();
  const [splitAmount, setSplitAmount] = useState(2500);
  const employeeCredit = 1800;

  const creditPortion = Math.min(splitAmount, employeeCredit);
  const copayPortion = Math.max(0, splitAmount - employeeCredit);

  // Sample files for the 3 interactive glass folders
  const orgFiles = [
    { name: 'Meal & Groceries Subsidy', meta: 'ETB 4,500 / month', art: 'verdant' },
    { name: 'Transit & Fuel Allowance', meta: 'ETB 2,000 / month', art: 'aurora' },
    { name: 'Executive Healthcare Pool', meta: 'ETB 5,000 baseline' },
    { name: 'Corporate Benefit Policy', meta: 'NBE & CBE compliant' },
  ];

  const creditFiles = [
    { name: 'Real-Time Accrued Wages', meta: 'Calculated per work day', art: 'ember' },
    { name: 'Zero-Interest Co-Pay', meta: 'Auto-repaid via payroll', art: 'verdant' },
    { name: 'Instant M-PESA B2C Wire', meta: 'Direct to handset' },
    { name: 'Luhn-FP Checksum ID', meta: '16-char credential' },
  ];

  const merchantFiles = [
    { name: 'Safaricom Till Settlement', meta: 'B2C wire rail', art: 'aurora' },
    { name: 'Dynamic QR Terminal', meta: '2-second verification', art: 'glacier' },
    { name: 'Audited Ledger Proof', meta: 'Double-entry verified' },
    { name: 'Automated Reconciliation', meta: 'Monthly payout batch' },
  ];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--fp-bg)', color: 'var(--fp-text-primary)' }}>
      {/* 1. Liquid Sculpture WebGL2 Particle Hero */}
      <SculptureHero
        brand="FlexPay®"
        eyebrow="SAFARICOM M-PESA ETHIOPIA INTEGRATED"
        headline={"Earned Wage Access\nthat empowers your team."}
        headlineAccent="empowers your team."
        body="Institutional benefit allowances and salary-linked pre-salary credit across verified merchants in Ethiopia. Zero cash handling, instant QR verification, and automated monthly payroll settlement."
        primaryCta={{ label: 'Launch Portal', href: '/auth' }}
        secondaryCta={{ label: 'Explore Credit Vault', href: '#interactive-vault' }}
        navLinks={[
          { label: 'Credit Vault', href: '#interactive-vault' },
          { label: 'SplitEngine™', href: '#calculator' },
          { label: 'Workflow', href: '#how-it-works' },
          { label: 'Ecosystem', href: '#pillars' },
        ]}
        navCta={{ label: 'Get Started', href: '/auth' }}
        backdropText="FLEXPAY"
        theme="dark"
        themeToggle={false}
        darkBackground="#060A14"
        accentColor="#10B981"
        height="100svh"
      />

      {/* 2. Interactive 3D Frosted Glass Product Vault */}
      <section
        id="interactive-vault"
        style={{
          position: 'relative',
          padding: '100px 24px',
          maxWidth: '1280px',
          margin: '0 auto',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '60px' }}>
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
              marginBottom: '16px',
            }}
          >
            <Sparkle size={16} weight="fill" />
            INTERACTIVE PRODUCT SUITE
          </div>
          <h2
            style={{
              fontSize: 'clamp(2rem, 3.5vw, 2.8rem)',
              fontWeight: 800,
              letterSpacing: '-0.02em',
              marginBottom: '16px',
            }}
          >
            Dynamic Credit & Benefit Architecture
          </h2>
          <p
            style={{
              fontSize: '1.05rem',
              color: 'var(--fp-text-secondary)',
              maxWidth: '640px',
              margin: '0 auto',
              lineHeight: 1.6,
            }}
          >
            Click or hover over any folder to inspect real-time earned wages, institutional employer benefits,
            and Safaricom M-PESA settlement rails rendered in frosted 3D glass.
          </p>
        </div>

        {/* 3 Folders Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '40px',
            alignItems: 'center',
            justifyItems: 'center',
            paddingBottom: '20px',
          }}
        >
          {/* Folder 1: Benefit Accounts */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <GlassFolder
              label="Employer Benefit Accounts"
              meta="Verified Enterprise Allocations"
              tone="dark"
              art="verdant"
              seed={42}
              files={orgFiles}
              width={320}
              action="add"
              onAdd={(files) => ({
                name: `Subsidy Line ${files.length + 1}`,
                meta: 'Configured by HR',
                art: 'verdant',
              })}
            />
            <div style={{ marginTop: '20px', textAlign: 'center' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--fp-text-muted)' }}>
                Click to fan out • Press <code style={{ color: 'var(--fp-benefit)' }}>+</code> to add ticket
              </span>
            </div>
          </div>

          {/* Folder 2: PayLater Credit */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <GlassFolder
              label="Pre-Salary Credit Vault"
              meta="Earned Wage Access (EWA)"
              tone="dark"
              art="ember"
              seed={77}
              files={creditFiles}
              width={320}
              action="add"
              onAdd={(files) => ({
                name: `PayLater Advance ${files.length + 1}`,
                meta: 'Approved via salary',
                art: 'ember',
              })}
            />
            <div style={{ marginTop: '20px', textAlign: 'center' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--fp-text-muted)' }}>
                Click to fan out • Press <code style={{ color: 'var(--fp-salary)' }}>+</code> to simulate draw
              </span>
            </div>
          </div>

          {/* Folder 3: Merchant POS & Settlement */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <GlassFolder
              label="Merchant POS & Settlement"
              meta="Institutional Receivables"
              tone="dark"
              art="aurora"
              seed={108}
              files={merchantFiles}
              width={320}
              action="add"
              onAdd={(files) => ({
                name: `B2C Batch Line ${files.length + 1}`,
                meta: 'Pending Daraja wire',
                art: 'aurora',
              })}
            />
            <div style={{ marginTop: '20px', textAlign: 'center' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--fp-text-muted)' }}>
                Click to fan out • Press <code style={{ color: '#38BDF8' }}>+</code> to test wire queue
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

      {/* 4. Automated SplitEngine™ Demo Section */}
      <section
        id="calculator"
        style={{
          padding: '100px 24px',
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
              background: 'rgba(56, 189, 248, 0.1)',
              border: '1px solid rgba(56, 189, 248, 0.25)',
              color: '#38BDF8',
              fontSize: '0.825rem',
              fontWeight: 600,
              marginBottom: '20px',
            }}
          >
            <ShieldCheck size={18} weight="fill" />
            REAL-TIME SPLITENGINE™
          </div>

          <h2
            style={{
              fontSize: 'clamp(2rem, 3.5vw, 2.8rem)',
              lineHeight: 1.15,
              fontWeight: 800,
              letterSpacing: '-0.03em',
              marginBottom: '20px',
            }}
          >
            Smart Salary Co-Pay, <br />
            <span
              style={{
                background: 'linear-gradient(135deg, #10B981 0%, #38BDF8 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              Zero Manual Split Math
            </span>
          </h2>

          <p
            style={{
              fontSize: '1.05rem',
              color: 'var(--fp-text-secondary)',
              lineHeight: 1.65,
              marginBottom: '32px',
              maxWidth: '520px',
            }}
          >
            When an employee makes a purchase, the SplitEngine automatically deducts corporate allowance first.
            Any balance seamlessly triggers an M-PESA STK push for the co-pay amount on their personal handset.
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px' }}>
            <button
              onClick={() => navigate('/auth/organization')}
              style={{
                padding: '12px 24px',
                borderRadius: '8px',
                background: 'var(--fp-benefit)',
                color: '#060A14',
                fontWeight: 700,
                fontSize: '0.95rem',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 20px rgba(16, 185, 129, 0.25)',
              }}
            >
              <Buildings size={18} weight="bold" />
              For Organizations
            </button>
            <button
              onClick={() => navigate('/auth/merchant')}
              style={{
                padding: '12px 24px',
                borderRadius: '8px',
                background: 'var(--fp-surface-2)',
                color: 'var(--fp-text-primary)',
                fontWeight: 600,
                fontSize: '0.95rem',
                border: '1px solid var(--fp-border-strong)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <Storefront size={18} weight="bold" />
              For Merchants
            </button>
            <button
              onClick={() => navigate('/auth/employee')}
              style={{
                padding: '12px 24px',
                borderRadius: '8px',
                background: 'transparent',
                color: 'var(--fp-text-secondary)',
                fontWeight: 600,
                fontSize: '0.95rem',
                border: '1px solid var(--fp-border)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <User size={18} weight="bold" />
              Employee Portal
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
                Interactive Simulation
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

      {/* 5. How It Works */}
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

      {/* 6. Features Grid */}
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

      {/* 7. Ecosystem Pillars */}
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

      {/* 8. Footer */}
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
