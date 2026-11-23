import React from 'react';
import { LucideIcon, ChevronDown } from 'lucide-react';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helperText?: string;
  icon?: LucideIcon;
  options?: { value: string | number; label: string }[];
  children?: React.ReactNode;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, helperText, icon: Icon, options, children, className = '', ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-xs font-semibold text-slate-700 dark:text-[#E8EEF8] mb-1.5 truncate">
            {label}
            {props.required && <span className="text-rose-500 ml-0.5">*</span>}
          </label>
        )}
        <div className="relative w-full">
          {Icon && (
            <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 flex items-center text-slate-400 dark:text-[#71839D]">
              <Icon className="w-4 h-4 shrink-0" />
            </div>
          )}
          <select
            ref={ref}
            className={`w-full rounded-xl border bg-white dark:bg-[#0D1729] text-xs text-slate-900 dark:text-[#E8EEF8] appearance-none focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-[#194D9C] transition-all ${
              Icon ? 'pl-9' : 'pl-3.5'
            } pr-9 py-2 h-10 cursor-pointer ${
              error
                ? 'border-rose-300 dark:border-rose-800 focus:border-rose-500 focus:ring-rose-500/20'
                : 'border-slate-200 dark:border-[#24344D]'
            } ${className}`}
            {...props}
          >
            {options
              ? options.map(opt => (
                  <option
                    key={opt.value}
                    value={opt.value}
                    className="bg-white dark:bg-[#0D1729] text-slate-900 dark:text-[#E8EEF8]"
                  >
                    {opt.label}
                  </option>
                ))
              : children}
          </select>
          <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 flex items-center text-slate-400 dark:text-[#71839D]">
            <ChevronDown className="w-4 h-4 shrink-0" />
          </div>
        </div>
        {error ? (
          <p className="text-[11px] font-medium text-rose-600 dark:text-rose-400 mt-1">
            {error}
          </p>
        ) : helperText ? (
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            {helperText}
          </p>
        ) : null}
      </div>
    );
  }
);

Select.displayName = 'Select';
