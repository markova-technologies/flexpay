import React, { useState, useEffect, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import api from '../../../services/api';
import { Modal } from '../../../components/ui/Modal';
import { useToast } from '../../../contexts/ToastContext';
import './MerchantPOS.css';

export function MerchantPOS() {
  const toast = useToast();
  const [mode, setMode] = useState('qr'); // 'qr' | 'manual'
  const [scanning, setScanning] = useState(false);
  const [verified, setVerified] = useState(null);
  const [fpIdInput, setFpIdInput] = useState('');
  const [amount, setAmount] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const scannerRef = useRef(null);

  useEffect(() => {
    if (!scanning) return;

    let isMounted = true;
    try {
      const scanner = new Html5QrcodeScanner(
        'qr-reader',
        {
          fps: 10,
          qrbox: (viewfinderWidth, viewfinderHeight) => {
            const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
            const size = Math.max(160, Math.floor(minEdge * 0.75));
            return { width: size, height: size };
          },
          rememberLastUsedCamera: true,
          aspectRatio: 1.0,
          showTorchButtonIfSupported: true,
        },
        /* verbose= */ false
      );

      scannerRef.current = scanner;

      scanner.render(
        async (decodedText) => {
          if (!isMounted) return;
          const payload = decodedText ? String(decodedText).trim() : '';
          if (!payload) return;

          try {
            if (scannerRef.current) {
              await scannerRef.current.clear();
            }
          } catch {}
          setScanning(false);

          try {
            const { data } = await api.post('/merchant/verify-employee', { qrPayload: payload });
            if (data.verified || data.eligible) {
              const emp = data.employee || data;
              setVerified({
                ...emp,
                name: emp.fullName || emp.employeeName || emp.name || 'Verified Employee',
                fpId: emp.fpEmployeeId || emp.fpId || 'FP-ETH',
                availableCredit: Number(emp.availableCredit || 0),
                creditLimit: Number(emp.creditLimit || 0),
                orgName: emp.organizationName || emp.orgName || 'Employer',
              });
              toast.success(`Verified: ${emp.fullName || emp.employeeName || emp.name}`);
            } else {
              toast.error(data.error || data.ineligibilityReason || 'QR Verification failed');
            }
          } catch (err) {
            toast.error(
              err.response?.data?.error ||
              err.response?.data?.message ||
              'Could not verify QR code. Please try manual entry.'
            );
          }
        },
        (err) => {
          // ignore scan frame errors
        }
      );
    } catch (err) {
      console.warn('Failed to start QR scanner:', err);
      setScanning(false);
    }

    return () => {
      isMounted = false;
      if (scannerRef.current) {
        scannerRef.current.clear().catch(() => {});
      }
    };
  }, [scanning]);

  const verifyManual = async () => {
    const cleanId = fpIdInput.trim().toUpperCase();
    if (!cleanId) {
      toast.warning('Please enter an FP Employee ID');
      return;
    }
    try {
      const { data } = await api.post('/merchant/verify-employee', { fpId: cleanId });
      if (data.verified || data.eligible) {
        const emp = data.employee || data;
        setVerified({
          ...emp,
          name: emp.fullName || emp.employeeName || emp.name || 'Verified Employee',
          fpId: emp.fpEmployeeId || emp.fpId || cleanId,
          availableCredit: Number(emp.availableCredit || 0),
          creditLimit: Number(emp.creditLimit || 0),
          orgName: emp.organizationName || emp.orgName || 'Employer',
        });
        toast.success(`Verified: ${emp.fullName || emp.employeeName || emp.name}`);
      } else {
        toast.error(data.error || data.ineligibilityReason || 'Employee verification failed');
      }
    } catch (err) {
      toast.error(err.response?.data?.error || err.response?.data?.message || 'Verification failed. Check the FP-ID.');
    }
  };

  const confirmPayment = () => {
    const amtNum = parseFloat(amount);
    if (!amtNum || isNaN(amtNum) || amtNum <= 0) {
      toast.warning('Please enter a valid transaction amount');
      return;
    }
    setConfirmOpen(true);
  };

  const runPayment = async () => {
    setConfirmOpen(false);
    setProcessing(true);
    try {
      const { data } = await api.post('/merchant/transaction', {
        fpId: verified.fpId || verified.fpEmployeeId,
        amount: Number(amount),
      });
      toast.success(`Payment authorized! Reference: ${data.fpRef || data.fpTransactionRef || data.id}`);
      setVerified(null);
      setAmount('');
      setFpIdInput('');
    } catch (err) {
      toast.error(err.response?.data?.message || err.response?.data?.error || 'Payment authorization failed');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="merchant-pos">
      <div className="pos__mode-toggle">
        <button
          type="button"
          className={`fp-touch-target ${mode === 'qr' ? 'active' : ''}`}
          onClick={() => {
            setMode('qr');
            setVerified(null);
          }}
        >
          📷 Scan QR (Primary)
        </button>
        <button
          type="button"
          className={`fp-touch-target ${mode === 'manual' ? 'active' : ''}`}
          onClick={() => {
            setMode('manual');
            setScanning(false);
            setVerified(null);
          }}
        >
          ⌨ Manual FP-ID
        </button>
      </div>

      {!verified && mode === 'qr' && (
        <div className="pos__scanner">
          {!scanning ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px', textAlign: 'center', width: '100%' }}>
              <div style={{ fontSize: '2.5rem' }}>📷</div>
              <h3 style={{ margin: 0, color: 'var(--text-primary, #F8FAFC)', fontSize: '1.15rem' }}>
                Camera QR Code Verification
              </h3>
              <p style={{ margin: 0, color: 'var(--text-secondary, #94A3B8)', fontSize: '0.875rem', maxWidth: '360px' }}>
                Point the camera at the employee&apos;s FlexPay dynamic QR code or POS Payment Card to instantly verify pre-salary credit.
              </p>
              <button
                type="button"
                className="btn btn--primary btn--lg fp-touch-target"
                style={{ marginTop: '6px', minHeight: '48px', width: '100%', maxWidth: '320px' }}
                onClick={() => setScanning(true)}
              >
                Start Camera Scan
              </button>
            </div>
          ) : (
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <p style={{ color: 'var(--text-secondary, #94A3B8)', fontSize: '0.85rem', marginBottom: '12px' }}>
                Position the employee&apos;s QR code inside the camera box below:
              </p>
              <div id="qr-reader" />
              <button
                type="button"
                className="btn btn--ghost fp-touch-target"
                style={{ marginTop: '14px', minHeight: '44px' }}
                onClick={() => setScanning(false)}
              >
                ✕ Close Scanner
              </button>
            </div>
          )}
        </div>
      )}

      {!verified && mode === 'manual' && (
        <div className="pos__manual">
          <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary, #94A3B8)' }}>
            Enter Employee FlexPay ID
          </label>
          <input
            className="form-input fp-touch-target"
            placeholder="FP-ETH-2026-XXXXX-X"
            value={fpIdInput}
            onChange={(e) => setFpIdInput(e.target.value.toUpperCase())}
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck="false"
            style={{ minHeight: '48px', fontSize: '1rem', width: '100%', boxSizing: 'border-box' }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') verifyManual();
            }}
          />
          <button
            type="button"
            className="btn btn--primary fp-touch-target"
            style={{ minHeight: '48px' }}
            onClick={verifyManual}
          >
            Verify Employee
          </button>
        </div>
      )}

      {verified && (
        <div className="pos__verified">
          <div className="verified-card">
            <div className="verified-card__badge">✓ Benefit Approved</div>
            <div className="verified-card__name">{verified.name}</div>
            <div className="verified-card__meta">
              {verified.fpId} · {verified.orgName}
            </div>
            <div className="verified-card__credit">
              <span>Available Pre-Salary Credit</span>
              <strong>ETB {Number(verified.availableCredit || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
            </div>
          </div>

          <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary, #94A3B8)' }}>
            Total Purchase Amount (ETB)
          </label>
          <input
            className="form-input form-input--lg fp-touch-target"
            type="number"
            inputMode="decimal"
            min="1"
            step="0.01"
            placeholder="Amount (ETB)"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            style={{ minHeight: '52px', fontSize: '1.25rem', width: '100%', boxSizing: 'border-box' }}
          />

          {amount && parseFloat(amount) > Number(verified.availableCredit || 0) && (
            <div style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '8px', padding: '10px 14px', fontSize: '0.825rem', color: 'var(--fp-salary, #F59E0B)' }}>
              Split purchase: ETB {Number(verified.availableCredit).toFixed(2)} from credit + ETB {(parseFloat(amount) - Number(verified.availableCredit)).toFixed(2)} via M-PESA STK co-pay.
            </div>
          )}

          <button
            type="button"
            className="btn btn--primary btn--lg fp-touch-target"
            style={{ minHeight: '48px' }}
            onClick={confirmPayment}
          >
            Authorize Payment
          </button>
          <button
            type="button"
            className="btn btn--ghost fp-touch-target"
            style={{ minHeight: '44px' }}
            onClick={() => {
              setVerified(null);
              setFpIdInput('');
              setAmount('');
            }}
          >
            Cancel
          </button>
        </div>
      )}

      <Modal
        open={confirmOpen}
        title="Confirm Payment Authorization"
        onClose={() => setConfirmOpen(false)}
        actions={
          <>
            <button
              type="button"
              className="btn btn--outline"
              onClick={() => setConfirmOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn--primary"
              onClick={runPayment}
              disabled={processing}
            >
              {processing ? 'Processing...' : 'Confirm Authorization'}
            </button>
          </>
        }
      >
        <p style={{ margin: '0 0 8px 0', fontSize: '1rem' }}>
          Authorize <strong>ETB {parseFloat(amount || '0').toFixed(2)}</strong> for <strong>{verified?.name}</strong>?
        </p>
        <p style={{ margin: 0, color: 'var(--text-secondary, #94A3B8)', fontSize: '0.85rem' }}>
          Pre-Salary Credit Available: ETB {Number(verified?.availableCredit || 0).toLocaleString()}
        </p>
      </Modal>
    </div>
  );
}

export default MerchantPOS;
