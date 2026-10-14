import { createContext, useContext, useState, useCallback } from 'react';

const ToastCtx = createContext(null);

let _id = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const push = useCallback(({ message, type = 'info', duration = 4000 }) => {
    const id = ++_id;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), duration);
  }, []);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastCtx.Provider value={{ push }}>
      {children}
      <div className="fp-toast-container" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`fp-toast fp-toast--${t.type}`}>
            <span className="fp-toast__msg">{t.message}</span>
            <button
              className="fp-toast__close"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss"
            >×</button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  return useContext(ToastCtx);
}
