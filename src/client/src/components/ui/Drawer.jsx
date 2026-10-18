import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import './Drawer.css';

export function Drawer({ open, onClose, title, children, width = '520px' }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && open) onClose();
    };
    document.addEventListener('keydown', onKey);
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <>
      <div
        className={`drawer-overlay ${open ? 'open' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className={`drawer ${open ? 'open' : ''}`}
        style={{ width, maxWidth: '100vw' }}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : 'Drawer'}
      >
        <div className="drawer__header">
          <h2 className="drawer__title">{title}</h2>
          <button className="drawer__close" onClick={onClose} aria-label="Close drawer">
            ✕
          </button>
        </div>
        <div className="drawer__body">{children}</div>
      </aside>
    </>,
    document.body
  );
}

export default Drawer;
