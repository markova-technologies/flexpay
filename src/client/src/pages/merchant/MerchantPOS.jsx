import { useState, useEffect } from 'react';
import {
  Storefront,
  DeviceMobile,
  CheckCircle,
  WarningCircle,
  ShieldCheck,
  Receipt,
  ArrowRight,
  ArrowsClockwise,
  UserCheck,
  Sparkle,
} from '@phosphor-icons/react';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { api } from '../../api/client.js';
import { useToast } from '../../contexts/ToastContext.jsx';
import Button from '../../components/ui/Button.jsx';
import SplitPaymentPreview from '../../components/SplitPaymentPreview.jsx';
import { formatETB } from '../../utils/format.js';
import './MerchantPortal.css';

export default function MerchantPOS() {
  const { user } = useAuth();
  const { push: toast } = useToast();
  const merchantId = user?.entityId || 'mer-001';

  const [merchant, setMerchant] = useState(null);
  const [customerPhone, setCustomerPhone] = useState('0912345678');
  const [verifiedCustomer, setVerifiedCustomer] = useState(null);
  const [saleAmount, setSaleAmount] = useState('2000');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(null);
  const [todayTransactions, setTodayTransactions] = useState([]);
  const [totalSettled, setTotalSettled] = useState(0);

  useEffect(() => {
    async function loadData() {
      try {
        const [mRes, txRes] = await Promise.all([
          api.getMerchant(merchantId).catch(() => null),
          api.getMerchantTransactions(merchantId).catch(() => ({ transactions: [], totalSettledETB: 0 })),
        ]);
        setMerchant(mRes || { name: 'Yod Abyssinia Market', category: 'GROCERY', shortCode: '2005' });
        setTodayTransactions(txRes.transactions || []);
        setTotalSettled(txRes.totalSettledETB || 0);
      } catch (err) {
        console.error('Failed to load merchant data:', err);
      }
    }
    loadData();
  }, [merchantId]);

  async function handleVerifyCustomer() {
    if (!customerPhone) return;
    setIsVerifying(true);
    try {
      const res = await api.verifyCustomer({
        customerPhone,
        merchantId,
      });
      setVerifiedCustomer(res.customer);
      toast({ message: `Customer verified: ${res.customer.name} (${res.customer.employerName})`, type: 'success' });
    } catch (err) {
      toast({ message: err.message || 'Customer lookup failed', type: 'error' });
      setVerifiedCustomer(null);
    } finally {
      setIsVerifying(false);
    }
  }

  const numSaleAmount = Number(saleAmount) || 0;
  const availableBenefit = verifiedCustomer?.availableBenefitETB || 0;
  const benefitCovered = Math.min(availableBenefit, numSaleAmount);
  const employeeCoPay = Math.max(0, numSaleAmount - benefitCovered);

  async function handleInitiatePayment() {
    if (!verifiedCustomer || numSaleAmount <= 0) return;

    setIsProcessing(true);
    try {
      const orderRes = await api.checkout({
        employeeId: verifiedCustomer.employeeId,
        merchantId,
        customerPhone: verifiedCustomer.phone,
        items: [{ name: `${merchant?.name || 'Store'} Order`, unitPriceETB: numSaleAmount, quantity: 1 }],
      });

      const authRes = await api.authorize(orderRes.orderId, {
        employeeId: verifiedCustomer.employeeId,
        customerPhone: verifiedCustomer.phone,
        scenario: 'SUCCESS',
      });

      setPaymentSuccess({
        orderId: orderRes.orderId,
        paymentId: authRes.paymentId,
        receiptNumber: 'SD' + Math.random().toString(36).substring(2, 9).toUpperCase(),
        totalETB: numSaleAmount,
        benefitETB: benefitCovered,
        mpesaETB: employeeCoPay,
        customerName: verifiedCustomer.name,
        timestamp: new Date().toLocaleTimeString(),
      });

      toast({ message: `Payment Settled! Receipt issued.`, type: 'success' });

      // Refresh transactions
      const txRes = await api.getMerchantTransactions(merchantId).catch(() => null);
      if (txRes) {
        setTodayTransactions(txRes.transactions || []);
        setTotalSettled(txRes.totalSettledETB || 0);
      }
    } catch (err) {
      toast({ message: err.message || 'Payment initiation failed', type: 'error' });
    } finally {
      setIsProcessing(false);
    }
  }

  function handleResetSale() {
    setPaymentSuccess(null);
    setSaleAmount('2000');
    setVerifiedCustomer(null);
  }

  return (
    <div className="pos-container fp-page-enter">
      {/* Top Banner */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.08) 0%, rgba(12, 19, 34, 0.95) 100%)',
        border: '1px solid var(--fp-border-strong)',
        borderRadius: 'var(--fp-r-xl)',
        padding: '24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px',
      }}>
        <div>
          <div className="pos-merchant-badge">
            <Storefront size={14} weight="fill" />
            <span>POS Till &middot; ShortCode {merchant?.shortCode || '2005'}</span>
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--fp-text-primary)', marginTop: '8px' }}>
            {merchant?.name || 'Yod Abyssinia Market'}
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--fp-text-secondary)' }}>
            Category: <strong style={{ color: 'var(--fp-sim)' }}>{merchant?.category || 'GROCERY & MEAL'}</strong> &middot; Instant Multi-Channel Settlement
          </p>
        </div>

        <div style={{ textAlign: 'right' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--fp-text-muted)', textTransform: 'uppercase' }}>
            Today's Total Settled
          </span>
          <div className="fp-tabular-nums" style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--fp-benefit)' }}>
            {formatETB(totalSettled)}
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--fp-text-muted)' }}>
            {todayTransactions.length} settled orders
          </span>
        </div>
      </div>

      <div className="pos-grid">
        {/* Left Column: POS Terminal */}
        <div className="pos-terminal-card">
          <div className="pos-terminal-header">
            <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--fp-text-primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Terminal Checkout
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--fp-benefit)', fontWeight: 600 }}>
              ● Ready for Transaction
            </span>
          </div>

          {/* Success Screen */}
          {paymentSuccess ? (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '16px',
              padding: '24px 0',
              textAlign: 'center',
            }}>
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'rgba(16, 185, 129, 0.15)',
                color: 'var(--fp-benefit)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <CheckCircle size={40} weight="fill" />
              </div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--fp-text-primary)' }}>
                Payment Complete & Settled!
              </h2>
              <div style={{
                background: 'var(--fp-surface-2)',
                border: '1px solid var(--fp-border)',
                borderRadius: 'var(--fp-r-lg)',
                padding: '16px',
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                fontSize: '0.875rem',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--fp-text-muted)' }}>Customer:</span>
                  <strong>{paymentSuccess.customerName}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--fp-text-muted)' }}>M-PESA Receipt:</span>
                  <code style={{ color: 'var(--fp-sim)' }}>{paymentSuccess.receiptNumber}</code>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--fp-text-muted)' }}>Employer Benefit:</span>
                  <strong style={{ color: 'var(--fp-benefit)' }}>{formatETB(paymentSuccess.benefitETB)}</strong>
                </div>
                {paymentSuccess.mpesaETB > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--fp-text-muted)' }}>Customer Co-Pay:</span>
                    <strong style={{ color: 'var(--fp-salary)' }}>{formatETB(paymentSuccess.mpesaETB)}</strong>
                  </div>
                )}
                <div style={{ borderTop: '1px solid var(--fp-border)', paddingTop: '8px', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 600 }}>Total Settled:</span>
                  <strong style={{ fontSize: '1.125rem', color: 'var(--fp-benefit)' }}>{formatETB(paymentSuccess.totalETB)}</strong>
                </div>
              </div>

              <Button
                variant="primary"
                icon={ArrowsClockwise}
                onClick={handleResetSale}
                style={{ width: '100%' }}
              >
                Start Next Sale
              </Button>
            </div>
          ) : (
            <>
              {/* Step 1: Customer Phone Verification */}
              <div className="pos-field">
                <label>Step 1: Customer Phone Number</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="09XXXXXXXX or 2519XXXXXXXX"
                    style={{
                      flex: 1,
                      padding: '10px 14px',
                      background: 'var(--fp-surface-2)',
                      border: '1px solid var(--fp-border)',
                      borderRadius: 'var(--fp-r-md)',
                      color: 'var(--fp-text-primary)',
                      fontSize: '1rem',
                      fontFamily: 'var(--fp-font-mono)',
                    }}
                  />
                  <Button
                    variant="secondary"
                    icon={UserCheck}
                    onClick={handleVerifyCustomer}
                    disabled={isVerifying}
                  >
                    {isVerifying ? 'Checking...' : 'Verify'}
                  </Button>
                </div>
              </div>

              {/* Verified Customer Details Card */}
              {verifiedCustomer && (
                <div className="pos-customer-card">
                  <div className="pos-customer-header">
                    <span className="pos-customer-name">{verifiedCustomer.name}</span>
                    <span className="pos-customer-org">{verifiedCustomer.employerName}</span>
                  </div>
                  <div className="pos-balance-chips">
                    <div className="pos-balance-chip">
                      <span className="pos-balance-chip-label">🍽️ Food Benefit</span>
                      <span className="pos-balance-chip-val" style={{ color: 'var(--fp-benefit)' }}>
                        {formatETB(verifiedCustomer.availableBenefitETB)}
                      </span>
                    </div>
                    <div className="pos-balance-chip">
                      <span className="pos-balance-chip-label">💳 FlexPay Limit</span>
                      <span className="pos-balance-chip-val" style={{ color: 'var(--fp-salary)' }}>
                        {formatETB(verifiedCustomer.availablePayLaterETB)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Sale Amount */}
              <div className="pos-field">
                <label>Step 2: Total Sale Amount (ETB)</label>
                <input
                  type="number"
                  className="pos-input-big fp-tabular-nums"
                  value={saleAmount}
                  onChange={(e) => setSaleAmount(e.target.value)}
                  step="50"
                  min="10"
                />
              </div>

              {/* Step 3: Split Preview */}
              {verifiedCustomer && numSaleAmount > 0 && (
                <SplitPaymentPreview
                  orderTotalETB={numSaleAmount}
                  benefitCoveredETB={benefitCovered}
                  employeeCoPayETB={employeeCoPay}
                  benefitCategory={verifiedCustomer.eligibleCategory || 'FOOD'}
                  employerName={verifiedCustomer.employerName}
                />
              )}

              {/* Action */}
              <Button
                variant="primary"
                onClick={handleInitiatePayment}
                disabled={!verifiedCustomer || numSaleAmount <= 0 || isProcessing}
                style={{ width: '100%', padding: '14px', fontSize: '1rem' }}
                icon={ArrowRight}
              >
                {isProcessing ? 'Waiting for M-PESA USSD Push...' : `Initiate Payment of ${formatETB(numSaleAmount)}`}
              </Button>
            </>
          )}
        </div>

        {/* Right Column: Today's Transactions */}
        <div className="pos-sidebar">
          <div className="pos-summary-box">
            <div>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--fp-text-muted)' }}>
                Settlement Channel
              </span>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--fp-text-primary)', marginTop: '2px' }}>
                M-PESA ShortCode {merchant?.shortCode || '2005'}
              </div>
            </div>
            <ShieldCheck size={28} weight="fill" color="var(--fp-benefit)" />
          </div>

          <div style={{
            background: 'var(--fp-surface-1)',
            border: '1px solid var(--fp-border)',
            borderRadius: 'var(--fp-r-xl)',
            overflow: 'hidden',
          }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--fp-border)', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--fp-text-primary)' }}>
                Today's Settlements ({todayTransactions.length})
              </span>
            </div>

            <div style={{ maxHeight: '420px', overflowY: 'auto' }}>
              {todayTransactions.length === 0 ? (
                <div style={{ padding: '32px', textAlign: 'center', color: 'var(--fp-text-muted)', fontSize: '0.875rem' }}>
                  No transactions settled yet today.
                </div>
              ) : (
                todayTransactions.map((tx) => (
                  <div
                    key={tx.paymentId}
                    style={{
                      padding: '12px 18px',
                      borderBottom: '1px solid var(--fp-border)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--fp-text-primary)', fontSize: '0.875rem' }}>
                        {tx.employeeName || 'Customer'}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--fp-text-muted)' }}>
                        {tx.receiptNumber ? `Receipt: ${tx.receiptNumber}` : 'Direct Benefit'} &middot; {new Date(tx.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div className="fp-tabular-nums" style={{ fontWeight: 700, color: 'var(--fp-text-primary)' }}>
                        {formatETB(tx.totalETB)}
                      </div>
                      <span style={{ fontSize: '0.6875rem', color: 'var(--fp-benefit)', fontWeight: 600 }}>
                        SETTLED
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
