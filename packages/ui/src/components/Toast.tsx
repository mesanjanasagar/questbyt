import React, { createContext, useContext, useState, useCallback } from 'react';
import { cn } from '../cn';
import { CheckCircleIcon, AlertCircleIcon, InfoIcon, XIcon, AlertTriangleIcon } from '../icons';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
  description?: string;
}

interface ToastContextValue {
  toasts: Toast[];
  toast: (type: ToastType, message: string, description?: string) => void;
  success: (message: string, description?: string) => void;
  error: (message: string, description?: string) => void;
  warning: (message: string, description?: string) => void;
  info: (message: string, description?: string) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (type: ToastType, message: string, description?: string) => {
      const id = Math.random().toString(36).slice(2);
      setToasts((prev) => [...prev, { id, type, message, description }]);
      setTimeout(() => dismiss(id), 5000);
    },
    [dismiss],
  );

  const ctx: ToastContextValue = {
    toasts,
    toast,
    success: (m, d) => toast('success', m, d),
    error:   (m, d) => toast('error', m, d),
    warning: (m, d) => toast('warning', m, d),
    info:    (m, d) => toast('info', m, d),
    dismiss,
  };

  return (
    <ToastContext.Provider value={ctx}>
      {children}
      <ToastContainer />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}

const toastStyles: Record<ToastType, { bg: string; icon: React.ReactNode }> = {
  success: {
    bg: 'bg-success-50 border-success-200 text-success-800',
    icon: <CheckCircleIcon size={18} className="text-success-600 flex-shrink-0" />,
  },
  error: {
    bg: 'bg-error-50 border-error-200 text-error-800',
    icon: <AlertCircleIcon size={18} className="text-error-600 flex-shrink-0" />,
  },
  warning: {
    bg: 'bg-warning-50 border-warning-200 text-warning-800',
    icon: <AlertTriangleIcon size={18} className="text-warning-600 flex-shrink-0" />,
  },
  info: {
    bg: 'bg-info-50 border-info-200 text-info-800',
    icon: <InfoIcon size={18} className="text-info-600 flex-shrink-0" />,
  },
};

function ToastContainer() {
  const { toasts, dismiss } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-toast flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => {
        const style = toastStyles[t.type];
        return (
          <div
            key={t.id}
            className={cn(
              'flex items-start gap-3 max-w-sm w-full px-4 py-3.5',
              'rounded-xl border shadow-lg pointer-events-auto',
              'animate-slide-in-right',
              style.bg,
            )}
          >
            {style.icon}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold leading-tight">{t.message}</p>
              {t.description && (
                <p className="text-xs mt-0.5 opacity-80">{t.description}</p>
              )}
            </div>
            <button
              onClick={() => dismiss(t.id)}
              className="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity ml-1"
              aria-label="Dismiss"
            >
              <XIcon size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
