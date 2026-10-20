import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
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
  Coins,
  Receipt,
  Sparkle,
  CaretRight,
  Check,
} from '@phosphor-icons/react';
import { FlexPayLogo } from '../../components/ui/FlexPayLogo';
import './LandingPage.css';

export default function LandingPage() {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Interactive SplitEngine™ Simulator state
  const [purchaseAmount, setPurchaseAmount] = useState(2500);
  const employeeAllowance = 1800; // Simulated available benefit balance

  const benefitPortion = Math.min(purchaseAmount, employeeAllowance);
  const copayPortion = Math.max(0, purchaseAmount - employeeAllowance);
  const benefitPercent = purchaseAmount > 0 ? (benefitPortion / purchaseAmount) * 100 : 100;
  const copayPercent = 100 - benefitPercent;

  const quickPresets = [
    { label: 'Lunch', amount: 450 },
    { label: 'Groceries', amount: 1800 },
    { label: 'Pharmacy', amount: 2500 },
    { label: 'Appliances', amount: 6200 },
  ];

  return (
    <div className="landing-page">
      {/* 1. Header Navigation */}
      <header className="landing-header">
        <div className="landing-nav-inner">
          <FlexPayLogo
            variant="compact"
            size={32}
            onClick={() => navigate('/')}
            style={{ cursor: 'pointer' }}
          />

          {/* Desktop Navigation Links */}
          <nav className="landing-nav-links">
            <a href="#how-it-works" className="landing-nav-link">
              How It Works
            </a>
            <a href="#ecosystem" className="landing-nav-link">
              Ecosystem
            </a>
            <a href="#simulator" className="landing-nav-link">
              SplitEngine™
            </a>
            <a href="#compliance" className="landing-nav-link">
              NBE Compliance
            </a>
          </nav>

          {/* Header Action Button & Mobile Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={() => navigate('/auth')}
              className="fp-btn-primary"
              aria-label="Launch FlexPay Portals"
            >
              <span>Access Portals</span>
              <ArrowRight size={16} weight="bold" />
            </button>

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="landing-mob-toggle"
              aria-label={mobileMenuOpen ? 'Close navigation' : 'Open navigation'}
            >
              {mobileMenuOpen ? <X size={20} /> : <List size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              style={{
                borderTop: '1px solid var(--fp-border)',
                background: 'rgba(8, 11, 16, 0.98)',
                padding: '20px 24px 28px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
              }}
            >
              <a
                href="#how-it-works"
                onClick={() => setMobileMenuOpen(false)}
                className="landing-nav-link"
                style={{ fontSize: '1rem', padding: '6px 0' }}
              >
                How It Works
              </a>
              <a
                href="#ecosystem"
                onClick={() => setMobileMenuOpen(false)}
                className="landing-nav-link"
                style={{ fontSize: '1rem', padding: '6px 0' }}
              >
                Ecosystem
              </a>
              <a
                href="#simulator"
                onClick={() => setMobileMenuOpen(false)}
                className="landing-nav-link"
                style={{ fontSize: '1rem', padding: '6px 0' }}
              >
                SplitEngine™ Simulator
              </a>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', paddingTop: '10px' }}>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    navigate('/auth/organization');
                  }}
                  className="fp-btn-ghost"
                  style={{ justifyContent: 'center', fontSize: '0.85rem' }}
                >
                  Organization
                </button>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    navigate('/auth/merchant');
                  }}
                  className="fp-btn-ghost"
                  style={{ justifyContent: 'center', fontSize: '0.85rem' }}
                >
                  Merchant POS
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* 2. Asymmetric Split Hero Section */}
      <section className="hero-section">
        {/* Left Column: Authentic Domain Value Proposition */}
        <motion.div
          className="hero-content"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="hero-pill-badge">
            <ShieldCheck size={16} weight="fill" />
            <span>Safaricom M-PESA Integrated • NBE EWA Framework</span>
          </div>

          <h1 className="hero-headline">
            Your salary.{' '}
            <span className="hero-headline-accent">Ready when life happens.</span>
          </h1>

          <p className="hero-subtext">
            FlexPay unlocks already-earned wages for everyday essentials. Zero predatory
            interest, automatic employer benefit splits, and instant Safaricom M-PESA checkout.
          </p>

          <div className="hero-actions">
            <button
              onClick={() => navigate('/auth')}
              className="fp-btn-primary"
            >
              <span>Explore All 3 Portals</span>
              <ArrowRight size={18} weight="bold" />
            </button>
            <a href="#simulator" className="fp-btn-ghost">
              <span>Test SplitEngine™</span>
            </a>
          </div>

          <div className="hero-trust-metrics">
            <div className="hero-trust-item">
              <span className="hero-trust-number">0% APR</span>
              <span className="hero-trust-label">Earned Wage Access</span>
            </div>
            <div style={{ width: '1px', height: '32px', background: 'var(--fp-border)' }} />
            <div className="hero-trust-item">
              <span className="hero-trust-number">&lt; 2s</span>
              <span className="hero-trust-label">M-PESA STK Push</span>
            </div>
            <div style={{ width: '1px', height: '32px', background: 'var(--fp-border)' }} />
            <div className="hero-trust-item">
              <span className="hero-trust-number">100%</span>
              <span className="hero-trust-label">Reconciled Payroll</span>
            </div>
          </div>
        </motion.div>

        {/* Right Column: Interactive SplitEngine™ Live Simulator */}
        <motion.div
          id="simulator"
          className="split-simulator-card"
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="split-card-header">
            <div className="split-card-title">
              <Coins size={20} color="var(--fp-orange)" weight="bold" />
              <span>SplitEngine™ Live Calculator</span>
            </div>
            <span className="split-card-badge">Real-Time Ledger</span>
          </div>

          {/* Interactive Amount Slider */}
          <div className="split-slider-container">
            <div className="split-slider-labels">
              <span className="split-slider-label">Cart Checkout Total</span>
              <span className="split-slider-amount">
                ETB {purchaseAmount.toLocaleString()}
              </span>
            </div>

            <input
              type="range"
              min="200"
              max="10000"
              step="50"
              value={purchaseAmount}
              onChange={(e) => setPurchaseAmount(Number(e.target.value))}
              className="split-range-input"
              aria-label="Adjust checkout amount"
            />

            {/* Quick Presets */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
              {quickPresets.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => setPurchaseAmount(preset.amount)}
                  style={{
                    background: purchaseAmount === preset.amount ? 'var(--fp-orange)' : 'var(--fp-surface-2)',
                    color: purchaseAmount === preset.amount ? '#080B10' : 'var(--fp-cream-muted)',
                    border: '1px solid var(--fp-border)',
                    borderRadius: '6px',
                    padding: '4px 10px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {preset.label} ({preset.amount} ETB)
                </button>
              ))}
            </div>
          </div>

          {/* Split Ratio Bar */}
          <div className="split-visual-bar-wrap">
            <div className="split-visual-bar">
              <div
                className="split-bar-benefit"
                style={{ width: `${benefitPercent}%` }}
                title={`Employer Benefit: ${benefitPortion} ETB`}
              />
              <div
                className="split-bar-copay"
                style={{ width: `${copayPercent}%` }}
                title={`M-PESA Co-Pay: ${copayPortion} ETB`}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', color: 'var(--fp-cream-muted)' }}>
              <span>Benefit Coverage: {Math.round(benefitPercent)}%</span>
              <span>M-PESA Co-Pay: {Math.round(copayPercent)}%</span>
            </div>
          </div>

          {/* Split Breakdown Details */}
          <div className="split-breakdown-grid">
            <div className="split-breakdown-box">
              <div className="split-box-label">
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--fp-orange)' }} />
                <span>Employer Allowance</span>
              </div>
              <div className="split-box-amount" style={{ color: 'var(--fp-orange)' }}>
                ETB {benefitPortion.toLocaleString()}
              </div>
              <span className="split-box-note">Paid from accrued salary</span>
            </div>

            <div className="split-breakdown-box">
              <div className="split-box-label">
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#38BDF8' }} />
                <span>M-PESA Co-Pay</span>
              </div>
              <div className="split-box-amount" style={{ color: '#38BDF8' }}>
                ETB {copayPortion.toLocaleString()}
              </div>
              <span className="split-box-note">
                {copayPortion > 0 ? 'Instant Daraja STK Push' : 'Fully covered (0 ETB)'}
              </span>
            </div>
          </div>

          {/* Live Ledger Verification Status */}
          <div className="split-stk-line">
            <CheckCircle size={18} weight="fill" />
            <span>
              Double-entry invariant: {benefitPortion} + {copayPortion} === {purchaseAmount} ETB (Debits === Credits)
            </span>
          </div>
        </motion.div>
      </section>

      {/* 3. How It Works (Three-Phase Real Flow) */}
      <section id="how-it-works" style={{ maxWidth: '1240px', margin: '0 auto', padding: '60px 24px' }}>
        <div style={{ textAlign: 'center', maxWidth: '64ch', margin: '0 auto 48px' }}>
          <h2 style={{ fontSize: 'clamp(1.8rem, 3.2vw, 2.6rem)', fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--fp-cream-pure)', marginBottom: '10px' }}>
            Earned Wage Access without payday debt.
          </h2>
          <p style={{ color: 'var(--fp-cream-muted)', fontSize: '1.05rem', lineHeight: 1.6 }}>
            FlexPay bridges daily living expenses and monthly payroll. No 300% micro-loan APR,
            no predatory collection agents—just simple access to what you have already worked for.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
          <div className="ecosystem-card">
            <div className="ecosystem-card-icon">
              <ChartLineUp size={24} weight="bold" />
            </div>
            <div className="ecosystem-card-pillar">Step 1 • Accrual</div>
            <h3 className="ecosystem-card-heading">Daily Wage Accrual</h3>
            <p className="ecosystem-card-desc">
              Your organization configures your contractual monthly salary. As each workday concludes, your eligible benefit allowance unlocks automatically.
            </p>
          </div>

          <div className="ecosystem-card">
            <div className="ecosystem-card-icon">
              <QrCode size={24} weight="bold" />
            </div>
            <div className="ecosystem-card-pillar">Step 2 • Checkout</div>
            <h3 className="ecosystem-card-heading">Instant POS Split</h3>
            <p className="ecosystem-card-desc">
              Scan your cryptographic FP-ID QR code at partner grocers, clinics, and pharmacies. The SplitEngine dynamically applies your benefit with optional M-PESA co-pay.
            </p>
          </div>

          <div className="ecosystem-card">
            <div className="ecosystem-card-icon">
              <Receipt size={24} weight="bold" />
            </div>
            <div className="ecosystem-card-pillar">Step 3 • Settlement</div>
            <h3 className="ecosystem-card-heading">Payroll Reconciliation</h3>
            <p className="ecosystem-card-desc">
              At month end, employer HR executes automated payroll deductions. Merchants receive batched M-PESA B2C wires with official PDF settlement vouchers.
            </p>
          </div>
        </div>
      </section>

      {/* 4. Ecosystem Pillars Section */}
      <section id="ecosystem" className="ecosystem-section">
        <div className="ecosystem-header">
          <h2 className="ecosystem-title">Built for the Ethiopian economy.</h2>
          <p className="ecosystem-subtitle">
            One unified platform aligning employers, employees, and merchants in a cashless, compliant financial network.
          </p>
        </div>

        <div className="ecosystem-grid">
          {/* Pillar 1: Organizations */}
          <div className="ecosystem-card">
            <div className="ecosystem-card-icon">
              <Buildings size={26} weight="bold" />
            </div>
            <div className="ecosystem-card-pillar">For Employers</div>
            <h3 className="ecosystem-card-heading">Organization Portal</h3>
            <p className="ecosystem-card-desc">
              Eliminate off-cycle salary advance requests and boost employee retention with automated benefit policies.
            </p>
            <ul className="ecosystem-card-bullets">
              <li className="ecosystem-card-bullet">
                <Check size={16} color="var(--fp-orange)" weight="bold" />
                <span>Automated Luhn FP-ID credential provisioning</span>
              </li>
              <li className="ecosystem-card-bullet">
                <Check size={16} color="var(--fp-orange)" weight="bold" />
                <span>Category allowance rules (Food, Health, Transit)</span>
              </li>
              <li className="ecosystem-card-bullet">
                <Check size={16} color="var(--fp-orange)" weight="bold" />
                <span>1-Click automated payroll deduction & wire preview</span>
              </li>
            </ul>
            <div
              className="ecosystem-card-action"
              onClick={() => navigate('/auth/organization')}
            >
              <span>Launch Organization Portal</span>
              <CaretRight size={16} weight="bold" />
            </div>
          </div>

          {/* Pillar 2: Employees */}
          <div className="ecosystem-card">
            <div className="ecosystem-card-icon">
              <User size={26} weight="bold" />
            </div>
            <div className="ecosystem-card-pillar">For Employees</div>
            <h3 className="ecosystem-card-heading">Digital Wallet</h3>
            <p className="ecosystem-card-desc">
              Access your earned salary before month end with complete dignity and transparency. Zero interest fees.
            </p>
            <ul className="ecosystem-card-bullets">
              <li className="ecosystem-card-bullet">
                <Check size={16} color="var(--fp-orange)" weight="bold" />
                <span>Real-time dynamic credit utilization ring</span>
              </li>
              <li className="ecosystem-card-bullet">
                <Check size={16} color="var(--fp-orange)" weight="bold" />
                <span>Time-sensitive signed QR payment card</span>
              </li>
              <li className="ecosystem-card-bullet">
                <Check size={16} color="var(--fp-orange)" weight="bold" />
                <span>Transparent ledger audit trail for every purchase</span>
              </li>
            </ul>
            <div
              className="ecosystem-card-action"
              onClick={() => navigate('/auth/employee')}
            >
              <span>Access Employee Wallet</span>
              <CaretRight size={16} weight="bold" />
            </div>
          </div>

          {/* Pillar 3: Merchants */}
          <div className="ecosystem-card">
            <div className="ecosystem-card-icon">
              <Storefront size={26} weight="bold" />
            </div>
            <div className="ecosystem-card-pillar">For Merchants</div>
            <h3 className="ecosystem-card-heading">Merchant POS</h3>
            <p className="ecosystem-card-desc">
              Accept pre-salary corporate payments with instant camera QR scanning and guaranteed employer wires.
            </p>
            <ul className="ecosystem-card-bullets">
              <li className="ecosystem-card-bullet">
                <Check size={16} color="var(--fp-orange)" weight="bold" />
                <span>Camera scanner or instant 16-char FP-ID verification</span>
              </li>
              <li className="ecosystem-card-bullet">
                <Check size={16} color="var(--fp-orange)" weight="bold" />
                <span>Real-time Safaricom M-PESA STK Push confirmation</span>
              </li>
              <li className="ecosystem-card-bullet">
                <Check size={16} color="var(--fp-orange)" weight="bold" />
                <span>Official PDF settlement receipts and audit logs</span>
              </li>
            </ul>
            <div
              className="ecosystem-card-action"
              onClick={() => navigate('/auth/merchant')}
            >
              <span>Launch Merchant POS</span>
              <CaretRight size={16} weight="bold" />
            </div>
          </div>
        </div>
      </section>

      {/* 5. Editorial Warm Cream Highlight Section */}
      <section id="compliance" className="cream-editorial-section">
        <div className="cream-card">
          <div>
            <div className="cream-badge-pill">
              <ShieldCheck size={16} weight="bold" />
              <span>National Bank of Ethiopia (NBE) Aligned</span>
            </div>
            <h2 className="cream-card-headline">
              Not a loan. Earned wage access built on true financial dignity.
            </h2>
            <p className="cream-card-subtext">
              Predatory payday lending traps hardworking Ethiopians in compounding interest cycles.
              FlexPay enforces strict salary baselines, zero finance charges, and direct employer-to-merchant
              reconciliation on Safaricom M-PESA rails.
            </p>
            <div className="cream-card-actions">
              <button
                onClick={() => navigate('/auth')}
                className="cream-btn-dark"
              >
                <span>Sign In to Your Portal</span>
                <ArrowRight size={16} weight="bold" />
              </button>
            </div>
          </div>

          {/* Right Visual Architecture Box */}
          <div className="cream-visual-box">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #ECE7DE', paddingBottom: '12px' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#080B10' }}>
                Payment Infrastructure
              </span>
              <span style={{ fontSize: '0.72rem', background: '#E6F4EA', color: '#137333', padding: '3px 8px', borderRadius: '4px', fontWeight: 700 }}>
                ACTIVE LIVE
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                <span style={{ color: '#5F5A52' }}>Payment Rail</span>
                <span style={{ fontWeight: 700, color: '#080B10' }}>Safaricom M-PESA Daraja</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                <span style={{ color: '#5F5A52' }}>Disbursement Rail</span>
                <span style={{ fontWeight: 700, color: '#080B10' }}>M-PESA B2C Instant Wires</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                <span style={{ color: '#5F5A52' }}>Account Ledger</span>
                <span style={{ fontWeight: 700, color: '#080B10' }}>Double-Entry (Zero Discrepancy)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                <span style={{ color: '#5F5A52' }}>Card Tokenization</span>
                <span style={{ fontWeight: 700, color: '#080B10' }}>Luhn 16-Digit FP-ID</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. Footer */}
      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <div className="landing-footer-top">
            <div className="landing-footer-brand">
              <FlexPayLogo variant="full" size={36} />
              <p className="landing-footer-desc">
                FlexPay is Ethiopia's benefits-first Earned Wage Access platform.
                Bridging corporate payroll and M-PESA merchant ecosystems with responsible credit.
              </p>
            </div>

            <div className="landing-footer-links-grid">
              <div className="landing-footer-col">
                <span className="landing-footer-col-title">Portals</span>
                <a onClick={() => navigate('/auth/organization')} className="landing-footer-link" style={{ cursor: 'pointer' }}>
                  Organization HR
                </a>
                <a onClick={() => navigate('/auth/employee')} className="landing-footer-link" style={{ cursor: 'pointer' }}>
                  Employee Wallet
                </a>
                <a onClick={() => navigate('/auth/merchant')} className="landing-footer-link" style={{ cursor: 'pointer' }}>
                  Merchant POS
                </a>
              </div>

              <div className="landing-footer-col">
                <span className="landing-footer-col-title">Platform</span>
                <a href="#how-it-works" className="landing-footer-link">How It Works</a>
                <a href="#simulator" className="landing-footer-link">SplitEngine™</a>
                <a href="#compliance" className="landing-footer-link">NBE Compliance</a>
              </div>

              <div className="landing-footer-col">
                <span className="landing-footer-col-title">Ethiopia Rails</span>
                <span className="landing-footer-link">Safaricom Daraja STK</span>
                <span className="landing-footer-link">M-PESA B2C Wires</span>
                <span className="landing-footer-link">Luhn FP-ID Verification</span>
              </div>
            </div>
          </div>

          <div className="landing-footer-bottom">
            <span>© 2026 FlexPay. All rights reserved.</span>
            <span>Code! Cashless Community M-PESA Hackathon 2026</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
