import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';
import { getFriendlyAdminErrorMessage } from '../utils/errorHandler';

export type ToastType = 'success' | 'info' | 'warning' | 'error';

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  duration: number;
  remainingTime: number;
  createdAt: number;
  timerId?: any;
  isPaused?: boolean;
}

interface ToastContextType {
  showSuccess: (message: string) => void;
  showError: (error: any, fallback?: string) => void;
  showInfo: (message: string) => void;
  showWarning: (message: string) => void;
  showToast: (type: ToastType, message: string) => void;
  dismissToast: (id: string) => void;
  clearAllToasts: () => void;
}

const DURATION_BY_TYPE: Record<ToastType, number> = {
  success: 3000,
  info: 4000,
  warning: 5000,
  error: 6000,
};

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const toastsRef = useRef<ToastItem[]>([]);
  toastsRef.current = toasts;

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => {
      const target = prev.find((t) => t.id === id);
      if (target?.timerId) {
        clearTimeout(target.timerId);
      }
      return prev.filter((t) => t.id !== id);
    });
  }, []);

  const clearAllToasts = useCallback(() => {
    toastsRef.current.forEach((t) => {
      if (t.timerId) clearTimeout(t.timerId);
    });
    setToasts([]);
  }, []);

  const startDismissTimer = useCallback((toast: ToastItem, duration: number) => {
    const timerId = setTimeout(() => {
      dismissToast(toast.id);
    }, duration);

    return timerId;
  }, [dismissToast]);

  const showToast = useCallback((type: ToastType, message: string) => {
    if (!message || typeof message !== 'string') return;
    const cleanMsg = message.trim();
    if (!cleanMsg) return;

    const baseDuration = DURATION_BY_TYPE[type] || 4000;

    setToasts((prev) => {
      // 1. Deduplication: Check if an identical toast is already active
      const existingIndex = prev.findIndex((t) => t.type === type && t.message === cleanMsg);
      if (existingIndex !== -1) {
        const existing = prev[existingIndex];
        if (existing.timerId) clearTimeout(existing.timerId);

        // Reset timer on existing toast without creating duplicate UI
        const refreshedTimerId = startDismissTimer(existing, baseDuration);
        const updated = [...prev];
        updated[existingIndex] = {
          ...existing,
          remainingTime: baseDuration,
          createdAt: Date.now(),
          timerId: refreshedTimerId,
          isPaused: false,
        };
        return updated;
      }

      // 2. New toast item
      const id = 'toast_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
      const newToast: ToastItem = {
        id,
        type,
        message: cleanMsg,
        duration: baseDuration,
        remainingTime: baseDuration,
        createdAt: Date.now(),
      };

      newToast.timerId = startDismissTimer(newToast, baseDuration);

      // Keep maximum 4 concurrent toasts to avoid viewport clutter
      return [...prev.slice(-3), newToast];
    });
  }, [startDismissTimer]);

  const showSuccess = useCallback((message: string) => {
    showToast('success', message);
  }, [showToast]);

  const showError = useCallback((error: any, fallback = 'Something went wrong. Please try again.') => {
    const friendly = getFriendlyAdminErrorMessage(error, fallback);
    showToast('error', friendly);
  }, [showToast]);

  const showInfo = useCallback((message: string) => {
    showToast('info', message);
  }, [showToast]);

  const showWarning = useCallback((message: string) => {
    showToast('warning', message);
  }, [showToast]);

  // Pause timer when mouse hovers over a toast
  const handleMouseEnter = (id: string) => {
    setToasts((prev) =>
      prev.map((t) => {
        if (t.id === id) {
          if (t.timerId) clearTimeout(t.timerId);
          const elapsed = Date.now() - t.createdAt;
          const remaining = Math.max(800, t.duration - elapsed);
          return { ...t, isPaused: true, remainingTime: remaining, timerId: undefined };
        }
        return t;
      })
    );
  };

  // Resume timer when mouse leaves
  const handleMouseLeave = (id: string) => {
    setToasts((prev) =>
      prev.map((t) => {
        if (t.id === id && t.isPaused) {
          const newTimerId = setTimeout(() => {
            dismissToast(t.id);
          }, t.remainingTime);
          return { ...t, isPaused: false, timerId: newTimerId, createdAt: Date.now() };
        }
        return t;
      })
    );
  };

  return (
    <ToastContext.Provider
      value={{
        showSuccess,
        showError,
        showInfo,
        showWarning,
        showToast,
        dismissToast,
        clearAllToasts,
      }}
    >
      {children}

      {/* Floating Global Toast Stack */}
      <div
        aria-live="polite"
        className="fixed top-4 right-4 z-50 flex flex-col space-y-2.5 max-w-md w-full px-4 sm:px-0 pointer-events-none"
      >
        {toasts.map((toast) => {
          const typeStyles = {
            success: {
              container:
                'bg-white dark:bg-[#0F192C] border-emerald-500/40 dark:border-emerald-500/50 text-slate-800 dark:text-emerald-100 shadow-emerald-500/10',
              icon: <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />,
              progress: 'bg-emerald-500',
            },
            info: {
              container:
                'bg-white dark:bg-[#0F192C] border-blue-500/40 dark:border-blue-500/50 text-slate-800 dark:text-blue-100 shadow-blue-500/10',
              icon: <Info className="w-5 h-5 text-blue-500 shrink-0" />,
              progress: 'bg-blue-500',
            },
            warning: {
              container:
                'bg-white dark:bg-[#0F192C] border-amber-500/40 dark:border-amber-500/50 text-slate-800 dark:text-amber-100 shadow-amber-500/10',
              icon: <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />,
              progress: 'bg-amber-500',
            },
            error: {
              container:
                'bg-white dark:bg-[#0F192C] border-rose-500/40 dark:border-rose-500/50 text-slate-800 dark:text-rose-100 shadow-rose-500/10',
              icon: <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />,
              progress: 'bg-rose-500',
            },
          }[toast.type];

          return (
            <div
              key={toast.id}
              role="alert"
              onMouseEnter={() => handleMouseEnter(toast.id)}
              onMouseLeave={() => handleMouseLeave(toast.id)}
              className={`pointer-events-auto rounded-xl border p-4 shadow-lg backdrop-blur-md transition-all duration-300 transform translate-y-0 opacity-100 flex items-start space-x-3 relative overflow-hidden ${typeStyles.container}`}
            >
              {typeStyles.icon}
              <div className="flex-1 text-xs font-medium leading-relaxed pt-0.5">
                {toast.message}
              </div>
              <button
                type="button"
                onClick={() => dismissToast(toast.id)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 -mr-1 -mt-1 rounded-lg transition-colors shrink-0"
                aria-label="Dismiss notification"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
};

