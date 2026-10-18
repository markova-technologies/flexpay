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
    try {
      const scanner = new Html5QrcodeScanner('qr-reader', { fps: 10, qrbox: 250 }, false);
      scannerRef.current = scanner;
      scanner.render(
        async (decoded) => {
          try {
            await scanner.clear();
          } catch {}
          setScanning(false);
          try {
            const { data } = await api.post('/merchant/verify-employee', { qrPayload: decoded });
            if (data.verified) {
              setVerified({
                ...data.employee,
                name: data.employee?.fullName || data.employee?.name || 'Verified Employee',
                fpId: data.employee?.fpEmployeeId || data.employee?.fpId || 'FP-ETH',
                availableCredit: Number(data.employee?.availableCredit || 0),
                orgName: data.employee?.organizationName || data.employee?.orgName || 'Employer',
              });
              toast.success(`Verified: ${data.employee?.fullName || data.employee?.name}`);
            } else {
              toast.error(data.error || 'QR Verification failed');
            }
          } catch (err) {
            toast.error('Could not verify QR code. Please try manual entry.');
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
      if (scannerRef.current) {
        scannerRef.current.clear().catch(() => {});
      }
    };
  }, [scanning]);

  const verifyManual = async () => {
    if (!fpIdInput.trim()) {
      toast.warning('Please enter an FP Employee ID');
      return;
    }
    try {
      const { data } = await api.post('/merchant/verify-employee', { fpId: fpIdInput.trim().toUpperCase() });
      if (data.verified) {
        setVerified({
          ...data.employee,
          name: data.employee?.fullName || data.employee?.name || 'Verified Employee',
          fpId: data.employee?.fpEmployeeId || data.employee?.fpId || fpIdInput.trim().toUpperCase(),
          availableCredit: Number(data.employee?.availableCredit || 0),
          orgName: data.employee?.organizationName || data.employee?.orgName || 'Employer',
        });
        toast.success(`Verified: ${data.employee?.fullName || data.employee?.name}`);
      } else {
        toast.error(data.error || 'Employee verification failed');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || err.response?.data?.error || 'Verification failed. Check the FP-ID.');
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
        fpId: verified.fpId,
        amount: Number(amount),
      });
      toast.success(`Payment authorized! Reference: ${data.fpRef || data.id}`);
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
          className={mode === 'qr' ? 'active' : ''}
          onClick={() => {
            setMode('qr');
            setVerified(null);
          }}
        >
          📷 Scan QR (Primary)
        </button>
        <button
          type="button"
          className={mode === 'manual' ? 'active' : ''}
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
            <button
              type="button"
              className="btn btn--primary btn--lg"
              onClick={() => setScanning(true)}
            >
              Start Camera Scan
            </button>
          ) : (
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div id="qr-reader" />
              <button
                type="button"
                className="btn btn--ghost"
                style={{ marginTop: '12px' }}
                onClick={() => setScanning(false)}
              >
                Stop Scanner
              </button>
            </div>
          )}
        </div>
      )}

      {!verified && mode === 'manual' && (
        <div className="pos__manual">
          <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary, #94A3B8)' }}>
            Enter Employee FlexPay ID
          </label>
          <input
            className="form-input"
            placeholder="FP-ETH-2026-XXXXX-X"
            value={fpIdInput}
            onChange={(e) => setFpIdInput(e.target.value)}
          />
          <button type="button" className="btn btn--primary" onClick={verifyManual}>
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
            className="form-input form-input--lg"
            type="number"
            min="1"
            step="0.01"
            placeholder="Amount (ETB)"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />

          {amount && parseFloat(amount) > Number(verified.availableCredit || 0) && (
            <div style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '8px', padding: '10px 14px', fontSize: '0.825rem', color: 'var(--fp-salary, #F59E0B)' }}>
              Split purchase: ETB {Number(verified.availableCredit).toFixed(2)} from credit + ETB {(parseFloat(amount) - Number(verified.availableCredit)).toFixed(2)} via M-PESA STK co-pay.
            </div>
          )}

          <button
            type="button"
            className="btn btn--primary btn--lg"
            onClick={confirmPayment}
          >
            Authorize Payment
          </button>
          <button
            type="button"
            className="btn btn--ghost"
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
