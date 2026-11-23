import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl';
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl';
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  maxWidth,
  size = 'lg',
}) => {
  const chosenSize = maxWidth || size;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const maxWidthClass = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
    '4xl': 'max-w-4xl',
  }[chosenSize];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-3 sm:p-4 md:p-6 text-center">
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
          onClick={onClose}
        />

        <div
          className={`relative transform overflow-hidden rounded-2xl bg-white dark:bg-[#0F192C] text-left shadow-2xl transition-all my-auto sm:my-8 w-full ${maxWidthClass} border border-slate-200/80 dark:border-[#24344D] animate-in zoom-in-95 duration-200`}
        >
          {/* Header */}
          <div className="flex items-start justify-between p-4 sm:p-6 border-b border-slate-100 dark:border-[#24344D] gap-3">
            <div className="min-w-0 flex-1">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-[#E8EEF8] leading-snug break-words">
                {title}
              </h3>
              {subtitle && (
                <div className="text-xs text-slate-500 dark:text-[#94A3B8] mt-1 leading-relaxed break-words">{subtitle}</div>
              )}
            </div>
            <button
              onClick={onClose}
              aria-label="Close modal"
              title="Close"
              className="rounded-xl p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#17243A] transition-colors shrink-0 ml-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="p-4 sm:p-6 max-h-[calc(85vh-6rem)] sm:max-h-[calc(100vh-14rem)] overflow-y-auto overscroll-contain">{children}</div>
        </div>
      </div>
    </div>
  );
};
