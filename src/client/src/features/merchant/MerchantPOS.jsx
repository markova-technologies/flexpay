import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Storefront,
  QrCode,
  IdentificationCard,
  CheckCircle,
  CurrencyDollar,
  SignOut,
  ArrowsClockwise,
  Receipt,
  Warning,
  DeviceMobile,
  ArrowRight,
  ShieldCheck
} from '@phosphor-icons/react';
import api from '../../services/api';
import { useAuthStore } from '../../stores/authStore';
import { useToast } from '../../contexts/ToastContext';

export default function MerchantPOS() {
  const navigate = useNavigate();
  const session = useAuthStore((s) => s.getSessionForPortal ? s.getSessionForPortal('MERCHANT') : s);
  const user = session?.user || useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const toast = useToast();

  const [step, setStep] = useState(1); // 1 = Verify Employee, 2 = Enter Amount & Authorize, 3 = Receipt
  const [fpIdInput, setFpIdInput] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState('');
  const [verifiedEmployee, setVerifiedEmployee] = useState(null);

  // Step 2: Amount & Split
  const [amountInput, setAmountInput] = useState('');
  const [authorizing, setAuthorizing] = useState(false);
  const [authError, setAuthError] = useState('');
  const [completedTxn, setCompletedTxn] = useState(null);

  // Dashboard Stats
  const [dashData, setDashData] = useState(null);

  const fetchMerchantDashboard = async () => {
    try {
      const res = await api.get('/merchant/dashboard');
      setDashData(res.data);
    } catch {}
  };

  useEffect(() => {
    fetchMerchantDashboard();
  }, []);

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {}
    clearAuth('MERCHANT');
    navigate('/auth');
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setVerifyError('');
    setVerifying(true);
    try {
      const res = await api.post('/merchant/verify-employee', {
        fpEmployeeId: fpIdInput.trim().toUpperCase(),
      });
      const emp = res.data.employee || res.data;
      const normalizedEmployee = {
        ...emp,
        fpEmployeeId: emp.fpEmployeeId || res.data.fpEmployeeId || fpIdInput.trim().toUpperCase(),
        availableCredit: Number(emp.availableCredit ?? res.data.availableCredit ?? 0),
        creditLimit: Number(emp.creditLimit ?? res.data.creditLimit ?? 0),
        employeeName: emp.fullName || res.data.fullName || emp.employeeName || res.data.employeeName || 'Verified Employee',
        fullName: emp.fullName || res.data.fullName || emp.employeeName || res.data.employeeName || 'Verified Employee',
        organizationName: emp.organizationName || res.data.organizationName || 'Corporate Partner',
      };

      if (res.data.eligible === false) {
        setVerifyError(res.data.ineligibilityReason || 'Customer is not eligible for purchases at this merchant category.');
        toast.warning(res.data.ineligibilityReason || 'Customer is not eligible for purchases at this merchant category.');
        return;
      }

      setVerifiedEmployee(normalizedEmployee);
      setStep(2);
      toast.success(`Customer verified: ${normalizedEmployee.employeeName}`);
    } catch (err) {
      const msg =
        err.response?.data?.details?.[0]?.message ||
        err.response?.data?.error ||
        err.response?.data?.message ||
        'Employee verification failed. Check FP-ID.';
      setVerifyError(msg);
      toast.error(msg);
    } finally {
      setVerifying(false);
    }
  };

  const calculateSplit = () => {
    const total = parseFloat(amountInput) || 0;
    const available = verifiedEmployee?.availableCredit || 0;
    const credit = Math.min(total, available);
    const copay = Math.max(0, total - available);
    return { total, credit, copay };
  };

  const { total, credit, copay } = calculateSplit();

  const handleAuthorize = async () => {
    if (total <= 0) return;
    setAuthError('');
    setAuthorizing(true);
    try {
      const targetFpId = verifiedEmployee?.fpEmployeeId || verifiedEmployee?.fp_employee_id || fpIdInput.trim().toUpperCase();
      const idempotencyKey = `pos-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const res = await api.post('/merchant/transaction', {
        fpEmployeeId: targetFpId,
        totalAmount: total,
        idempotencyKey,
      });

      setCompletedTxn(res.data);
      setStep(3);
      toast.success(
        res.data.requiresStkPush
          ? 'Transaction initiated. M-PESA STK Push prompt dispatched!'
          : 'Payment authorized successfully!'
      );
      fetchMerchantDashboard();
    } catch (err) {
      const msg =
        err.response?.data?.details?.[0]?.message ||
        err.response?.data?.error ||
        err.response?.data?.message ||
        err.message ||
        'Transaction authorization failed.';
      setAuthError(msg);
      toast.error(msg);
    } finally {
      setAuthorizing(false);
    }
  };

  const resetPOS = () => {
    setStep(1);
    setFpIdInput('');
    setAmountInput('');
    setVerifiedEmployee(null);
    setCompletedTxn(null);
    setVerifyError('');
    setAuthError('');
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--fp-bg)', color: 'var(--fp-text-primary)' }}>
      {/* Header */}
      <header
        style={{
          borderBottom: '1px solid var(--fp-border)',
          background: 'var(--fp-surface-1)',
          padding: '16px 28px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'var(--fp-salary)',
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
            <h1 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0 }}>
              {dashData?.merchant?.businessName || user?.businessName || 'Merchant POS'}
            </h1>
            <span style={{ fontSize: '0.75rem', color: 'var(--fp-text-muted)' }}>
              Category: {dashData?.merchant?.category || user?.category || 'RETAIL'} • M-PESA Integrated Till
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--fp-text-muted)' }}>Receivables Balance</span>
            <div className="mono" style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--fp-salary)' }}>
              ETB {Number(dashData?.receivablesSummary?.totalReceivable || 0).toLocaleString()}
            </div>
          </div>
          <button
            onClick={handleLogout}
            style={{
              background: 'var(--fp-surface-2)',
              border: '1px solid var(--fp-border)',
              borderRadius: '8px',
              padding: '8px 12px',
              color: 'var(--fp-text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.85rem',
            }}
          >
            <SignOut size={16} />
            Sign Out
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main style={{ maxWidth: '960px', margin: '0 auto', padding: '40px 24px' }}>
        {/* Step Indicator */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '36px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              background: 'var(--fp-surface-1)',
              border: '1px solid var(--fp-border)',
              borderRadius: '999px',
              padding: '6px 20px',
            }}
          >
            <span
              style={{
                fontSize: '0.85rem',
                fontWeight: 700,
                color: step >= 1 ? 'var(--fp-benefit)' : 'var(--fp-text-muted)',
              }}
            >
              1. Verify Employee
            </span>
            <ArrowRight size={14} color="var(--fp-text-muted)" />
            <span
              style={{
                fontSize: '0.85rem',
                fontWeight: 700,
                color: step >= 2 ? 'var(--fp-benefit)' : 'var(--fp-text-muted)',
              }}
            >
              2. Split & Authorize
            </span>
            <ArrowRight size={14} color="var(--fp-text-muted)" />
            <span
              style={{
                fontSize: '0.85rem',
                fontWeight: 700,
                color: step === 3 ? 'var(--fp-benefit)' : 'var(--fp-text-muted)',
              }}
            >
              3. Receipt
            </span>
          </div>
        </div>

        {/* STEP 1: Verify Employee */}
        {step === 1 && (
          <div
            style={{
              maxWidth: '500px',
              margin: '0 auto',
              background: 'var(--fp-surface-1)',
              border: '1px solid var(--fp-border)',
              borderRadius: '24px',
              padding: '36px',
              boxShadow: 'var(--fp-shadow-md)',
            }}
          >
            <div style={{ textAlign: 'center', marginBottom: '28px' }}>
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '16px',
                  background: 'rgba(245, 158, 11, 0.12)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '16px',
                }}
              >
                <QrCode size={32} color="var(--fp-salary)" weight="bold" />
              </div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Scan QR or Enter FP-ID</h2>
              <p style={{ color: 'var(--fp-text-secondary)', fontSize: '0.875rem', marginTop: '6px' }}>
                Verify customer eligibility and available benefit balance before ringing up purchase.
              </p>
            </div>

            {verifyError && (
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
                {verifyError}
              </div>
            )}

            <form onSubmit={handleVerify} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.825rem', color: 'var(--fp-text-secondary)', marginBottom: '6px' }}>
                  Customer FP-ID (from QR or ID badge)
                </label>
                <div style={{ position: 'relative' }}>
                  <IdentificationCard size={18} color="var(--fp-text-muted)" style={{ position: 'absolute', left: '12px', top: '13px' }} />
                  <input
                    type="text"
                    required
                    value={fpIdInput}
                    onChange={(e) => setFpIdInput(e.target.value.toUpperCase())}
                    placeholder="FP-ETH-2026-XXXXX-C"
                    style={{
                      width: '100%',
                      padding: '12px 14px 12px 38px',
                      borderRadius: '8px',
                      background: 'var(--fp-surface-2)',
                      border: '1px solid var(--fp-border)',
                      color: 'var(--fp-text-primary)',
                      fontSize: '0.95rem',
                      fontFamily: 'var(--fp-font-mono)',
                      letterSpacing: '0.04em',
                    }}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={verifying}
                style={{
                  padding: '13px',
                  borderRadius: '8px',
                  background: 'var(--fp-salary)',
                  color: '#060A14',
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  border: 'none',
                  cursor: verifying ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 16px rgba(245, 158, 11, 0.25)',
                }}
              >
                {verifying ? 'Verifying Luhn Checksum...' : 'Verify Customer Eligibility'}
              </button>
            </form>
          </div>
        )}

        {/* STEP 2: Enter Amount & Split Engine Calculation */}
        {step === 2 && verifiedEmployee && (
          <div
            style={{
              maxWidth: '560px',
              margin: '0 auto',
              background: 'var(--fp-surface-1)',
              border: '1px solid var(--fp-border)',
              borderRadius: '24px',
              padding: '36px',
              boxShadow: 'var(--fp-shadow-md)',
            }}
          >
            {/* Customer Verified Card */}
            <div
              style={{
                background: 'rgba(16, 185, 129, 0.08)',
                border: '1px solid rgba(16, 185, 129, 0.25)',
                borderRadius: '16px',
                padding: '18px 20px',
                marginBottom: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <CheckCircle size={18} color="var(--fp-benefit)" weight="fill" />
                  <span style={{ fontSize: '0.95rem', fontWeight: 700 }}>
                    {verifiedEmployee.employeeName}
                  </span>
                </div>
                <span style={{ fontSize: '0.8rem', color: 'var(--fp-text-secondary)', display: 'block', marginTop: '2px' }}>
                  {verifiedEmployee.organizationName} • {verifiedEmployee.fpEmployeeId}
                </span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--fp-text-muted)' }}>Available Benefit</span>
                <div className="mono" style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--fp-benefit)' }}>
                  ETB {Number(verifiedEmployee.availableCredit).toLocaleString()}
                </div>
              </div>
            </div>

            {authError && (
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
                {authError}
              </div>
            )}

            {/* Amount Input */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '0.825rem', color: 'var(--fp-text-secondary)', marginBottom: '8px' }}>
                Total Order Bill (ETB)
              </label>
              <input
                type="number"
                min="1"
                step="0.01"
                required
                autoFocus
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                placeholder="0.00"
                style={{
                  width: '100%',
                  padding: '14px 18px',
                  borderRadius: '12px',
                  background: 'var(--fp-surface-2)',
                  border: '1px solid var(--fp-border-strong)',
                  color: 'var(--fp-text-primary)',
                  fontSize: '1.5rem',
                  fontWeight: 800,
                  fontFamily: 'var(--fp-font-mono)',
                }}
              />
            </div>

            {/* SplitEngine Preview Card */}
            {total > 0 && (
              <div
                style={{
                  background: 'var(--fp-surface-2)',
                  borderRadius: '16px',
                  padding: '20px',
                  marginBottom: '24px',
                  border: '1px solid var(--fp-border)',
                }}
              >
                <span style={{ fontSize: '0.75rem', color: 'var(--fp-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  SplitEngine™ Settlement Breakdown
                </span>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', fontSize: '0.9rem' }}>
                  <span style={{ color: 'var(--fp-text-secondary)' }}>Employer Benefit Covered:</span>
                  <span className="mono" style={{ fontWeight: 700, color: 'var(--fp-benefit)' }}>
                    ETB {credit.toLocaleString()}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '0.9rem' }}>
                  <span style={{ color: 'var(--fp-text-secondary)' }}>M-PESA Co-Pay (Customer):</span>
                  <span className="mono" style={{ fontWeight: 700, color: copay > 0 ? 'var(--fp-salary)' : 'var(--fp-text-muted)' }}>
                    ETB {copay.toLocaleString()}
                  </span>
                </div>

                {copay > 0 && (
                  <div
                    style={{
                      marginTop: '12px',
                      padding: '10px 12px',
                      background: 'rgba(245, 158, 11, 0.1)',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontSize: '0.8rem',
                      color: 'var(--fp-salary)',
                    }}
                  >
                    <DeviceMobile size={18} />
                    <span>STK Push of ETB {copay.toLocaleString()} will be prompted on customer's phone.</span>
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                type="button"
                onClick={() => setStep(1)}
                style={{
                  padding: '12px 18px',
                  borderRadius: '10px',
                  background: 'transparent',
                  border: '1px solid var(--fp-border)',
                  color: 'var(--fp-text-secondary)',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                Back
              </button>

              <button
                type="button"
                disabled={authorizing || total <= 0}
                onClick={handleAuthorize}
                style={{
                  flex: 1,
                  padding: '14px',
                  borderRadius: '10px',
                  background: 'var(--fp-benefit)',
                  color: '#060A14',
                  fontWeight: 800,
                  fontSize: '1rem',
                  border: 'none',
                  cursor: authorizing || total <= 0 ? 'not-allowed' : 'pointer',
                  opacity: authorizing || total <= 0 ? 0.6 : 1,
                  boxShadow: '0 4px 20px rgba(16, 185, 129, 0.3)',
                }}
              >
                {authorizing ? 'Processing Split Invariant...' : `Authorize ETB ${total.toLocaleString()}`}
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Receipt */}
        {step === 3 && completedTxn && (
          <div
            style={{
              maxWidth: '480px',
              margin: '0 auto',
              background: 'var(--fp-surface-1)',
              border: '2px solid var(--fp-benefit)',
              borderRadius: '24px',
              padding: '36px',
              boxShadow: 'var(--fp-shadow-lg)',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'rgba(16, 185, 129, 0.15)',
                color: 'var(--fp-benefit)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '16px',
              }}
            >
              <CheckCircle size={38} weight="fill" />
            </div>

            <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Payment Approved</h2>
            <span style={{ fontSize: '0.8rem', color: 'var(--fp-text-muted)' }}>
              Transaction Ref: {completedTxn.transaction?.id || 'TXN-OK'}
            </span>

            <div
              style={{
                background: 'var(--fp-surface-2)',
                borderRadius: '16px',
                padding: '20px',
                margin: '24px 0',
                textAlign: 'left',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--fp-text-secondary)' }}>Total Paid:</span>
                <span className="mono" style={{ fontWeight: 800, fontSize: '1.1rem' }}>
                  ETB {Number(completedTxn.transaction?.total_amount || completedTxn.transaction?.totalAmount).toLocaleString()}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--fp-text-secondary)' }}>Employer Credit:</span>
                <span className="mono" style={{ color: 'var(--fp-benefit)', fontWeight: 700 }}>
                  ETB {Number(completedTxn.transaction?.credit_portion || completedTxn.transaction?.creditPortion).toLocaleString()}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--fp-text-secondary)' }}>Customer M-PESA Co-pay:</span>
                <span className="mono" style={{ color: 'var(--fp-salary)', fontWeight: 700 }}>
                  ETB {Number(completedTxn.transaction?.copay_portion || completedTxn.transaction?.copayPortion).toLocaleString()}
                </span>
              </div>
            </div>

            <button
              onClick={resetPOS}
              style={{
                width: '100%',
                padding: '13px',
                borderRadius: '10px',
                background: 'var(--fp-benefit)',
                color: '#060A14',
                fontWeight: 700,
                fontSize: '0.95rem',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Start Next Transaction
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
