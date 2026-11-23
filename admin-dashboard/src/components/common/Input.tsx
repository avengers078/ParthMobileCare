import React, { useState } from 'react';
import { LucideIcon, X, Eye, EyeOff } from 'lucide-react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  helper?: string;
  icon?: LucideIcon;
  rightIcon?: LucideIcon;
  rightElement?: React.ReactNode;
  onClear?: () => void;
  showPasswordToggle?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      helperText,
      helper,
      icon: Icon,
      rightIcon: RightIcon,
      rightElement,
      onClear,
      showPasswordToggle,
      type = 'text',
      className = '',
      ...props
    },
    ref
  ) => {
    const finalHelper = helper || helperText;
    const [passwordVisible, setPasswordVisible] = useState(false);

    const isPassword = type === 'password' || showPasswordToggle;
    const inputType = isPassword ? (passwordVisible ? 'text' : 'password') : type;

    return (
      <div className="w-full">
        {label && (
          <label className="block text-xs font-semibold text-slate-700 dark:text-[#E8EEF8] mb-1.5">
            {label}
            {props.required && <span className="text-rose-500 ml-0.5">*</span>}
          </label>
        )}
        <div className="relative flex items-center">
          {Icon && (
            <div className="absolute left-3.5 inset-y-0 flex items-center pointer-events-none text-slate-400 dark:text-[#71839D]">
              <Icon className="w-4 h-4 shrink-0" />
            </div>
          )}
          <input
            ref={ref}
            type={inputType}
            className={`w-full rounded-xl border bg-white dark:bg-[#0D1729] text-xs text-slate-900 dark:text-[#E8EEF8] placeholder-slate-400 dark:placeholder-[#71839D] focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-[#194D9C] transition-all ${
              Icon ? 'pl-10' : 'pl-3.5'
            } ${
              isPassword || onClear || RightIcon || rightElement ? 'pr-10' : 'pr-3.5'
            } py-2 h-10 ${
              error
                ? 'border-rose-300 dark:border-rose-800 text-rose-900 focus:border-rose-500 focus:ring-rose-500/20'
                : 'border-slate-200 dark:border-[#24344D]'
            } ${className}`}
            {...props}
          />
          {isPassword ? (
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setPasswordVisible(!passwordVisible)}
              className="absolute right-3.5 inset-y-0 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              aria-label={passwordVisible ? 'Hide password' : 'Show password'}
            >
              {passwordVisible ? (
                <EyeOff className="w-4 h-4 shrink-0" />
              ) : (
                <Eye className="w-4 h-4 shrink-0" />
              )}
            </button>
          ) : onClear && props.value ? (
            <button
              type="button"
              onClick={onClear}
              className="absolute right-3.5 inset-y-0 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              aria-label="Clear input"
            >
              <X className="w-4 h-4 shrink-0" />
            </button>
          ) : RightIcon ? (
            <div className="absolute right-3.5 inset-y-0 flex items-center pointer-events-none text-slate-400">
              <RightIcon className="w-4 h-4 shrink-0" />
            </div>
          ) : rightElement ? (
            <div className="absolute right-3.5 inset-y-0 flex items-center">
              {rightElement}
            </div>
          ) : null}
        </div>
        {error ? (
          <p className="mt-1 text-xs text-rose-600 dark:text-rose-400 font-medium">{error}</p>
        ) : finalHelper ? (
          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{finalHelper}</p>
        ) : null}
      </div>
    );
  }
);

Input.displayName = 'Input';
