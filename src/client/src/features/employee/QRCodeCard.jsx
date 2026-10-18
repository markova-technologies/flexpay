import React, { useState, useEffect } from 'react';
import { QrCode, DownloadSimple, ArrowsClockwise } from '@phosphor-icons/react';
import { QRCodeCanvas } from 'qrcode.react';
import api from '../../services/api';
import { useToast } from '../../contexts/ToastContext';

const REFRESH_MS = 4 * 60 * 1000; // 4 minutes auto-refresh (payload valid for 5 min)

export function QRCodeCard({ employee }) {
  const toast = useToast();
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [qrPayload, setQrPayload] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const qrValue = employee?.fpEmployeeId || '';

  const fetchQRCode = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/employee/qr-code');
      const remoteUrl = res.data?.qrCodeDataUrl || res.data?.qrDataUrl;
      if (remoteUrl) {
        setQrDataUrl(remoteUrl);
      }
      if (res.data?.qrPayload) {
        setQrPayload(res.data.qrPayload);
      }
    } catch (err) {
      // Non-fatal if we have qrValue from props for QRCodeCanvas
      if (!qrValue) {
        setError('Unable to load cryptographic QR code. Refresh to retry.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQRCode();
    const interval = setInterval(fetchQRCode, REFRESH_MS);
    return () => clearInterval(interval);
  }, [qrValue]);

  const downloadQR = () => {
    try {
      const canvas = document.getElementById('flexpay-qr-canvas');
      let linkHref = qrDataUrl;
      if (canvas && !linkHref) {
        linkHref = canvas.toDataURL('image/png');
      }
      if (!linkHref) {
        toast.error('QR code image is not ready yet.');
        return;
      }
      const link = document.createElement('a');
      link.href = linkHref;
      link.download = `FlexPay_${employee?.fpEmployeeId || 'Card'}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('POS Payment QR Card downloaded successfully.');
    } catch (err) {
      toast.error('Failed to download QR code image.');
    }
  };

  const isReady = Boolean(qrDataUrl || qrPayload || qrValue);

  return (
    <div
      style={{
        background: 'var(--fp-surface-1)',
        border: '1px solid var(--fp-border)',
        borderRadius: '20px',
        padding: '28px',
        boxShadow: 'var(--fp-shadow-md)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
        <QrCode size={22} color="var(--fp-benefit)" weight="bold" />
        <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>POS Payment Card</h3>
      </div>

      <p style={{ color: 'var(--fp-text-secondary)', fontSize: '0.85rem', marginBottom: '20px' }}>
        Present this dynamic QR code to any certified merchant cashier to verify benefit eligibility.
      </p>

      {/* QR Display Container */}
      <div
        style={{
          width: '210px',
          height: '210px',
          background: '#FFFFFF',
          borderRadius: '16px',
          padding: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 8px 30px rgba(0, 0, 0, 0.4)',
          position: 'relative',
        }}
      >
        {loading && !isReady ? (
          <div style={{ color: '#060A14', fontSize: '0.85rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <ArrowsClockwise size={28} className="spin" />
            <span>Generating QR...</span>
          </div>
        ) : error && !isReady ? (
          <div style={{ color: '#EF4444', fontSize: '0.8rem', padding: '10px' }}>
            {error}
          </div>
        ) : qrDataUrl ? (
          <img
            src={qrDataUrl}
            alt="FlexPay Payment QR Code"
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
        ) : (qrPayload || qrValue) ? (
          <QRCodeCanvas
            id="flexpay-qr-canvas"
            value={qrPayload || qrValue}
            size={186}
            level="H"
            includeMargin={false}
            bgColor="#FFFFFF"
            fgColor="#0A0B0D"
          />
        ) : (
          <div style={{ color: '#6B7280', fontSize: '0.8rem' }}>Awaiting FP-ID...</div>
        )}
      </div>

      {/* Employee ID Chip */}
      <div
        style={{
          marginTop: '20px',
          padding: '8px 16px',
          background: 'var(--fp-surface-2)',
          border: '1px solid var(--fp-border)',
          borderRadius: '10px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          width: '100%',
        }}
      >
        <span style={{ fontSize: '0.75rem', color: 'var(--fp-text-muted)' }}>Luhn-Checksum Identifier</span>
        <span
          className="mono"
          style={{
            fontSize: '1rem',
            fontWeight: 700,
            color: 'var(--fp-benefit)',
            letterSpacing: '0.05em',
            marginTop: '2px',
          }}
        >
          {employee?.fpEmployeeId || 'FP-ETH-XXXX-XXXXX-C'}
        </span>
      </div>

      <div style={{ display: 'flex', gap: '12px', width: '100%', marginTop: '16px' }}>
        <button
          onClick={downloadQR}
          disabled={!isReady}
          style={{
            flex: 1,
            padding: '10px 14px',
            borderRadius: '8px',
            background: isReady ? 'var(--fp-surface-2)' : 'rgba(255, 255, 255, 0.05)',
            border: '1px solid var(--fp-border-strong)',
            color: isReady ? 'var(--fp-text-primary)' : 'var(--fp-text-muted)',
            fontSize: '0.85rem',
            fontWeight: 600,
            cursor: !isReady ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
          }}
        >
          <DownloadSimple size={18} />
          Save PNG
        </button>
        <button
          onClick={fetchQRCode}
          disabled={loading}
          title="Refresh QR Code"
          style={{
            padding: '10px 14px',
            borderRadius: '8px',
            background: 'transparent',
            border: '1px solid var(--fp-border)',
            color: 'var(--fp-text-secondary)',
            fontSize: '0.85rem',
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          <ArrowsClockwise size={18} className={loading ? 'spin' : ''} />
        </button>
      </div>
    </div>
  );
}

export default QRCodeCard;
