import React, { useState, useEffect } from 'react';
import { QrCode, DownloadSimple, ShieldCheck, ArrowsClockwise } from '@phosphor-icons/react';
import api from '../../services/api';

export default function QRCodeCard({ employee }) {
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchQRCode = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/employee/qr-code');
      setQrDataUrl(res.data.qrCodeDataUrl);
    } catch (err) {
      setError('Unable to load cryptographic QR code. Refresh to retry.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQRCode();
  }, []);

  const downloadQR = () => {
    if (!qrDataUrl) return;
    const link = document.createElement('a');
    link.href = qrDataUrl;
    link.download = `FlexPay_${employee?.fpEmployeeId || 'QR'}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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
        {loading ? (
          <div style={{ color: '#060A14', fontSize: '0.85rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <ArrowsClockwise size={28} className="spin" />
            <span>Generating QR...</span>
          </div>
        ) : error ? (
          <div style={{ color: '#EF4444', fontSize: '0.8rem', padding: '10px' }}>
            {error}
          </div>
        ) : (
          <img
            src={qrDataUrl}
            alt="FlexPay Payment QR Code"
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
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
          disabled={!qrDataUrl || loading}
          style={{
            flex: 1,
            padding: '10px 14px',
            borderRadius: '8px',
            background: 'var(--fp-surface-2)',
            border: '1px solid var(--fp-border-strong)',
            color: 'var(--fp-text-primary)',
            fontSize: '0.85rem',
            fontWeight: 600,
            cursor: !qrDataUrl || loading ? 'not-allowed' : 'pointer',
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
          <ArrowsClockwise size={18} />
        </button>
      </div>
    </div>
  );
}
