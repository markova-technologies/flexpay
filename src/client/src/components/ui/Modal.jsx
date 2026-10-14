import React, { useEffect, useRef } from 'react';
import { X } from '@phosphor-icons/react';
import './Modal.css';

/**
 * Accessible Modal dialog with trap focus and backdrop close.
 */
export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = '500px',
}) {
  const modalRef = useRef(null);

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    }
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fp-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div
        className="fp-modal-card"
        style={{ maxWidth }}
        onClick={(e) => e.stopPropagation()}
        ref={modalRef}
      >
        <div className="fp-modal-card__header">
          <h3 id="modal-title" className="fp-modal-card__title">
            {title}
          </h3>
          <button
            className="fp-modal-card__close"
            onClick={onClose}
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>
        <div className="fp-modal-card__body">{children}</div>
      </div>
    </div>
  );
}
