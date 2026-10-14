import React from 'react';
import './StatusBadge.css';

const STATUS_CONFIG = {
  COMPLETED: {
    label: 'Completed',
    className: 'status-badge--success',
    dot: true,
  },
  PENDING_MPESA_CALLBACK: {
    label: 'Awaiting M-PESA',
    className: 'status-badge--pending',
    dot: true,
    pulse: true,
  },
  PENDING_AUTHORIZATION: {
    label: 'Pending Auth',
    className: 'status-badge--pending',
    dot: true,
    pulse: true,
  },
  FAILED_REJECTED: {
    label: 'Declined',
    className: 'status-badge--danger',
    dot: true,
  },
  FAILED_TIMEOUT: {
    label: 'Timed Out',
    className: 'status-badge--danger',
    dot: true,
  },
  REVERSED: {
    label: 'Refunded / Reversed',
    className: 'status-badge--reversed',
    dot: true,
  },
  REFUND_PENDING: {
    label: 'Refund Pending',
    className: 'status-badge--reversed',
    dot: true,
    pulse: true,
  },
};

export default function StatusBadge({ status }) {
  const config = STATUS_CONFIG[status] || {
    label: status || 'Unknown',
    className: 'status-badge--default',
    dot: false,
  };

  return (
    <span className={`status-badge ${config.className}`}>
      {config.dot && (
        <span
          className={`status-badge__dot ${config.pulse ? 'fp-pulse' : ''}`}
          aria-hidden="true"
        />
      )}
      <span className="status-badge__label">{config.label}</span>
    </span>
  );
}
