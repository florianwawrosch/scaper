'use client';

import { useState, useCallback } from 'react';
import { createContext, useContext } from 'react';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

interface ToastContextType {
  toasts: Toast[];
  showToast: (message: string, type: ToastType, duration?: number) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastType = 'info', duration = 3000) => {
      // Unique even for toasts fired in the same millisecond
      const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const newToast: Toast = { id, message, type, duration };
      setToasts((prev) => [...prev, newToast]);

      if (duration > 0) {
        setTimeout(() => removeToast(id), duration);
      }
    },
    [removeToast]
  );

  return (
    <ToastContext.Provider value={{ toasts, showToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
}

function ToastContainer({
  toasts,
  removeToast,
}: {
  toasts: Toast[];
  removeToast: (id: string) => void;
}) {
  const palette: Record<ToastType, { bg: string; border: string; color: string }> = {
    success: { bg: 'rgba(79,209,197,.1)',  border: 'rgba(79,209,197,.35)',  color: '#4fd1c5' },
    error:   { bg: 'rgba(232,115,107,.1)', border: 'rgba(232,115,107,.35)', color: '#e8736b' },
    warning: { bg: 'rgba(232,176,75,.1)',  border: 'rgba(232,176,75,.35)',  color: '#e8b04b' },
    info:    { bg: 'rgba(232,176,75,.1)',  border: 'rgba(232,176,75,.35)',  color: '#e8b04b' },
  };

  return (
    <div style={{ position: 'fixed', bottom: 16, right: 16, display: 'flex', flexDirection: 'column', gap: 8, zIndex: 50 }}>
      {toasts.map((toast) => {
        const { bg, border, color } = palette[toast.type];
        return (
          <div
            key={toast.id}
            style={{
              fontFamily: "'Spline Sans Mono', monospace",
              fontSize: 12, padding: '8px 12px', borderRadius: 7,
              background: bg, border: `1px solid ${border}`, color,
              maxWidth: 320, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
            }}
          >
            <span>{toast.message}</span>
            <button
              onClick={() => removeToast(toast.id)}
              style={{ fontFamily: "'Spline Sans Mono', monospace", fontSize: 12, background: 'none', border: 'none', color, opacity: 0.6, cursor: 'pointer', padding: 0, lineHeight: 1 }}
            >✕</button>
          </div>
        );
      })}
    </div>
  );
}
