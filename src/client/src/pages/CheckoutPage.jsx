import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle, WarningCircle, Clock, ShoppingBag, DeviceMobile, ArrowRight, ArrowsClockwise
} from '@phosphor-icons/react';
import { api } from '../api/client.js';
import { formatETB, formatPhone } from '../utils/format.js';
import { usePolling } from '../hooks/usePolling.js';
import { useToast } from '../contexts/ToastContext.jsx';
import SplitBar from '../components/ui/SplitBar.jsx';
import { DEMO_SCENARIO } from '../api/scenarios.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import Button from '../components/ui/Button.jsx';
import './CheckoutPage.css';

const DEFAULT_ITEMS = [
  { id: 'item-1', name: 'Premium Teff Flour (25kg)', category: 'GROCERY', unitPriceETB: 1000, quantity: 1 },
  { id: 'item-2', name: 'Sidama Coffee Beans (5kg)', category: 'GROCERY', unitPriceETB: 500, quantity: 2 },
];

export default function CheckoutPage() {
  const navigate = useNavigate();
  const { push: toast } = useToast();
  const { user } = useAuth();
  const currentEmployeeId = user?.entityId || 'emp-001';

  // State
  const [merchants, setMerchants] = useState([]);
  const [selectedMerchantId, setSelectedMerchantId] = useState('mer-001');
  const [items, setItems] = useState(DEFAULT_ITEMS);
  const [customerPhone, setCustomerPhone] = useState('251912345678');
  const [salaryConsent, setSalaryConsent] = useState(true);

  // Checkout workflow step: 'PLANNING' | 'SPLIT_CONFIRM' | 'IN_FLIGHT' | 'RESULT'
  const [step, setStep] = useState('PLANNING');
  const [loading, setLoading] = useState(false);
  const [splitData, setSplitData] = useState(null);
  const [orderId, setOrderId] = useState(null);
  const [paymentRecord, setPaymentRecord] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState(null);
  const [receiptNumber, setReceiptNumber] = useState(null);
  const [errorDetails, setErrorDetails] = useState(null);

  // Total calculation
  const orderTotalETB = items.reduce((acc, item) => acc + item.unitPriceETB * item.quantity, 0);

  // Load merchants and initial split calculation on mount or merchant change
  useEffect(() => {
    async function init() {
      try {
        const mList = await api.getMerchants();
        setMerchants(mList.merchants || []);
      } catch (err) {
        console.error('Failed to load merchants:', err);
      }
    }
    init();
  }, []);

  // Recalculate split preview whenever merchant or items change
  useEffect(() => {
    async function calculateSplit() {
      try {
        const res = await api.checkout({
          employeeId: currentEmployeeId,
          merchantId: selectedMerchantId,
          customerPhone,
          items,
        });
        setSplitData(res.split);
        setOrderId(res.orderId);
        setErrorDetails(null);
      } catch (err) {
        setErrorDetails(err.message || 'Unable to compute benefit allocation');
      }
    }
    calculateSplit();
  }, [currentEmployeeId, selectedMerchantId, items, customerPhone]);

  // Handle Authorize action
  const handleAuthorize = async () => {
    if (!salaryConsent && splitData?.employeeCoPayETB > 0) {
      toast({ message: 'Please authorize the salary-linked co-pay to proceed.', type: 'error' });
      return;
    }
    setLoading(true);
    try {
      const res = await api.authorize(orderId, {
        employeeId: currentEmployeeId,
        customerPhone,
        coPayETB: splitData?.employeeCoPayETB || 0,
        scenario: DEMO_SCENARIO.current,
      });
      setPaymentRecord(res);
      setPaymentStatus('PENDING_MPESA_CALLBACK');
      setStep('IN_FLIGHT');
      toast({ message: `M-PESA prompt dispatched to ${formatPhone(customerPhone)}`, type: 'info' });
    } catch (err) {
      toast({ message: err.message || 'Payment initiation failed', type: 'error' });
      setErrorDetails(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Poll payment status while IN_FLIGHT
  usePolling(
    async () => {
      if (!paymentRecord?.paymentId) return;
      try {
        const statusRes = await api.getPaymentStatus(paymentRecord.paymentId);
        setPaymentStatus(statusRes.status);
        if (statusRes.status === 'COMPLETED') {
          setReceiptNumber(statusRes.mpesaReceiptNumber);
          setStep('RESULT');
          toast({ message: 'Payment successfully completed!', type: 'success' });
        } else if (statusRes.status.startsWith('FAILED')) {
          setStep('RESULT');
          toast({ message: `Payment failed: ${statusRes.status}`, type: 'error' });
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    },
    2000,
    step === 'IN_FLIGHT'
  );

  const handleReset = () => {
    setStep('PLANNING');
    setPaymentRecord(null);
    setPaymentStatus(null);
    setReceiptNumber(null);
  };

  return (
    <div className="fp-page-enter checkout-page">
      <div className="checkout-header">
        <div>
          <h1>Point-of-Sale Checkout</h1>
          <p>
            Ethiopian Benefits-First purchasing with automated employer co-funding &amp; M-PESA clearing.
          </p>
        </div>
      </div>

      <div className="checkout-grid">
        {/* Left Column: Order Items & Merchant Configuration */}
        <div className="checkout-main-column">
          {step === 'PLANNING' && (
            <div className="fp-card">
              <h3 className="fp-card__title" style={{ marginBottom: '16px' }}>
                1. Order Basket Configuration
              </h3>

              {/* Merchant Selector */}
              <div className="checkout-field">
                <label htmlFor="select-merchant" className="fp-label">Select Merchant</label>
                <select
                  id="select-merchant"
                  className="checkout-select"
                  value={selectedMerchantId}
                  onChange={(e) => setSelectedMerchantId(e.target.value)}
                >
                  {merchants.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.category})
                    </option>
                  ))}
                </select>
              </div>

              {/* Item List */}
              <div className="checkout-items-list">
                <span className="fp-label" style={{ marginBottom: '8px', display: 'block' }}>
                  Basket Items
                </span>
                {items.map((item) => (
                  <div key={item.id} className="checkout-item-row">
                    <div className="checkout-item-row__desc">
                      <div className="checkout-item-name">{item.name}</div>
                      <div className="checkout-item-category">
                        Category: <span className="mono">{item.category}</span>
                      </div>
                    </div>
                    <div className="checkout-item-row__price mono">
                      {item.quantity} &times; {formatETB(item.unitPriceETB)} = <strong>{formatETB(item.unitPriceETB * item.quantity)}</strong>
                    </div>
                  </div>
                ))}
              </div>

              <div className="checkout-total-banner">
                <span className="fp-label">Total Amount Due</span>
                <span className="checkout-total-banner__amt mono">{formatETB(orderTotalETB)}</span>
              </div>
            </div>
          )}

          {/* In-Flight USSD Waiting State */}
          {step === 'IN_FLIGHT' && (
            <div className="fp-card checkout-status-card">
              <div className="checkout-ussd-anim">
                <div className="checkout-ussd-pulse" />
                <DeviceMobile size={48} className="checkout-ussd-phone" />
              </div>
              <h2>Awaiting M-PESA USSD Confirmation</h2>
              <p className="checkout-status-card__sub">
                A STK push prompt for <strong>{formatETB(splitData?.employeeCoPayETB)}</strong> has been sent to{' '}
                <code className="mono">+{customerPhone}</code>.
              </p>

              <div className="checkout-status-pill">
                <span className="status-badge__dot fp-pulse" style={{ background: 'var(--fp-pending)' }} />
                <span>Status: {paymentStatus || 'PENDING_MPESA_CALLBACK'}</span>
              </div>

              {/* Realistic Safaricom Telco USSD Simulation Display */}
              <div className="checkout-ussd-sim-phone">
                <div className="checkout-ussd-sim-header">
                  <span className="checkout-ussd-sim-network">Safaricom ET 4G</span>
                  <span className="checkout-ussd-sim-time">USSD Prompt</span>
                </div>
                <div className="checkout-ussd-sim-body">
                  <div className="checkout-ussd-sim-prompt">
                    <strong>M-PESA Paybill 710200</strong>
                    <p>Pay ETB {splitData?.employeeCoPayETB?.toFixed(2)} to FlexPay / {merchants.find(m => m.id === selectedMerchantId)?.name || 'Merchant'}?</p>
                    <div className="checkout-ussd-sim-options">
                      <span>1. Authorize with PIN</span>
                      <span>2. Decline</span>
                    </div>
                  </div>
                  <div className="checkout-ussd-sim-status">
                    <span className="checkout-ussd-sim-cursor" /> Waiting for subscriber input...
                  </div>
                </div>
              </div>

              <div className="checkout-ussd-instructions">
                <p>1. Check your mobile device display screen for the Safaricom prompt.</p>
                <p>2. Enter your M-PESA PIN to authorize the salary-linked co-pay.</p>
                <p>3. Do not close or navigate away from this screen.</p>
              </div>

              <div className="checkout-sim-note">
                <Clock size={16} />
                <span>Simulation will automatically resolve in ~4 seconds based on selected scenario.</span>
              </div>
            </div>
          )}

          {/* Result State */}
          {step === 'RESULT' && (
            <div className={`fp-card checkout-result-card ${paymentStatus === 'COMPLETED' ? 'checkout-result-card--success' : 'checkout-result-card--failed'}`}>
              {paymentStatus === 'COMPLETED' ? (
                <>
                  <div className="checkout-result-icon checkout-result-icon--success">
                    <CheckCircle size={56} weight="fill" />
                  </div>
                  <h2>Payment Confirmed &amp; Settled!</h2>
                  <p className="checkout-result-desc">
                    The transaction has been fully orchestrated. Employer benefit of {formatETB(splitData?.benefitCoveredETB)} was debited, and M-PESA co-pay of {formatETB(splitData?.employeeCoPayETB)} was cleared.
                  </p>

                  <div className="checkout-receipt-box">
                    <div className="checkout-receipt-badge">
                      <span>✓ INSTANT SETTLEMENT CLEARED</span>
                    </div>
                    <div className="checkout-receipt-row">
                      <span>M-PESA Receipt No:</span>
                      <strong className="mono">{receiptNumber || 'SD9876DEMO'}</strong>
                    </div>
                    <div className="checkout-receipt-row">
                      <span>Transaction ID:</span>
                      <code className="mono">{paymentRecord?.paymentId}</code>
                    </div>
                    <div className="checkout-receipt-row">
                      <span>Employer Benefit Debit:</span>
                      <strong className="mono" style={{ color: 'var(--fp-benefit)' }}>{formatETB(splitData?.benefitCoveredETB)}</strong>
                    </div>
                    <div className="checkout-receipt-row">
                      <span>Salary-Linked Co-Pay:</span>
                      <strong className="mono" style={{ color: 'var(--fp-salary)' }}>{formatETB(splitData?.employeeCoPayETB)}</strong>
                    </div>
                    <div className="checkout-receipt-divider" />
                    <div className="checkout-receipt-row checkout-receipt-row--total">
                      <span>Merchant Payout:</span>
                      <strong className="mono">{formatETB(orderTotalETB)} (100% Guaranteed)</strong>
                    </div>
                  </div>

                  <div className="checkout-result-actions">
                    <Button
                      id="view-ledger-btn"
                      variant="primary"
                      onClick={() => navigate(`/transactions/${paymentRecord?.paymentId}`)}
                    >
                      View Audit Ledger
                    </Button>
                    <Button
                      id="btn-retry-payment"
                      variant="secondary"
                      icon={ArrowsClockwise}
                      onClick={handleReset}
                    >
                      New Purchase
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="checkout-result-icon checkout-result-icon--failed">
                    <WarningCircle size={56} weight="fill" />
                  </div>
                  <h2>Payment Failed or Timed Out</h2>
                  <p className="checkout-result-desc">
                    {paymentStatus === 'FAILED_REJECTED'
                      ? 'The subscriber rejected the USSD prompt on their mobile device (ResultCode 1032).'
                      : 'The M-PESA push request timed out before confirmation (ResultCode 1037).'}
                  </p>
                  <p className="checkout-result-sub">
                    No benefit points or salary deductions were finalized. The ledger remains unaffected.
                  </p>

                  <div className="checkout-result-actions">
                    <Button
                      id="btn-retry-payment"
                      variant="primary"
                      icon={ArrowsClockwise}
                      onClick={handleReset}
                    >
                      Try Again
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Split Preview & Authorize Trigger */}
        <div className="checkout-sidebar-column">
          <div className="fp-card fp-card--elevated">
            <h3 className="fp-card__title" style={{ marginBottom: '14px' }}>
              Benefit Allocation Breakdown
            </h3>

            {splitData ? (
              <>
                <SplitBar
                  totalETB={splitData.orderTotalETB}
                  benefitETB={splitData.benefitCoveredETB}
                  coPayETB={splitData.employeeCoPayETB}
                  employerName={splitData.employerName}
                />

                {!splitData.isEligible && (
                  <div className="checkout-ineligible-banner" role="alert">
                    <WarningCircle size={20} className="checkout-ineligible-icon" />
                    <div>
                      <strong>Ineligible Allocation</strong>
                      <p>{splitData.rejectionReason}</p>
                    </div>
                  </div>
                )}

                {splitData.isEligible && (
                  <div className="checkout-auth-form">
                    <div className="checkout-field" style={{ marginTop: '16px' }}>
                      <label htmlFor="input-customer-phone" className="fp-label">
                        M-PESA Phone Number
                      </label>
                      <input
                        id="input-customer-phone"
                        type="tel"
                        className="checkout-input mono"
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        placeholder="251912345678"
                        disabled={step !== 'PLANNING'}
                      />
                      <span className="checkout-hint">
                        Format: E.164 without plus sign (e.g., 251912345678)
                      </span>
                    </div>

                    {splitData.employeeCoPayETB > 0 && (
                      <label className="checkout-checkbox-label">
                        <input
                          id="checkbox-salary-consent"
                          type="checkbox"
                          checked={salaryConsent}
                          onChange={(e) => setSalaryConsent(e.target.checked)}
                          disabled={step !== 'PLANNING'}
                        />
                        <span>
                          I authorize <strong>{formatETB(splitData.employeeCoPayETB)}</strong> to be linked to my pre-approved salary deduction.
                        </span>
                      </label>
                    )}

                    {step === 'PLANNING' && (
                      <Button
                        id="btn-submit-order"
                        variant="primary"
                        size="lg"
                        loading={loading}
                        disabled={!splitData.isEligible || (splitData.employeeCoPayETB > 0 && !salaryConsent)}
                        onClick={handleAuthorize}
                        icon={ArrowRight}
                        iconPosition="right"
                        style={{ width: '100%', marginTop: '16px' }}
                      >
                        Authorize &amp; Pay {formatETB(splitData.employeeCoPayETB > 0 ? splitData.employeeCoPayETB : 0)}
                      </Button>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="fp-skeleton" style={{ height: '140px' }} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
