import React from 'react';
import { LucideIcon, Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: LucideIcon;
  iconPosition?: 'left' | 'right';
  children?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon: Icon,
  iconPosition = 'left',
  children,
  className = '',
  disabled,
  ...props
}) => {
  const variantStyles = {
    primary:
      'bg-brand-500 hover:bg-brand-600 active:bg-brand-700 text-white shadow-sm shadow-brand-500/20 border border-transparent disabled:bg-slate-200 disabled:text-slate-400 dark:disabled:bg-[#1C2A42] dark:disabled:text-slate-500 disabled:shadow-none',
    secondary:
      'bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 dark:bg-[#17243A] dark:hover:bg-[#1C2A42] dark:text-[#E8EEF8] border border-transparent disabled:opacity-50',
    outline:
      'bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-700 border border-slate-200 dark:bg-[#0D1729] dark:hover:bg-[#17243A] dark:text-[#E8EEF8] dark:border-[#24344D] shadow-sm disabled:opacity-50',
    ghost:
      'bg-transparent hover:bg-slate-100 active:bg-slate-200 text-slate-600 dark:text-[#94A3B8] dark:hover:bg-[#17243A] dark:hover:text-[#E8EEF8] border border-transparent disabled:opacity-40',
    danger:
      'bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white shadow-sm border border-transparent disabled:opacity-50',
    success:
      'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white shadow-sm border border-transparent disabled:opacity-50',
  }[variant];

  const sizeStyles = {
    xs: 'h-7 px-2.5 text-[11px] font-medium rounded-lg gap-1.5',
    sm: 'h-8 px-3 text-xs font-semibold rounded-lg gap-1.5',
    md: 'h-9.5 px-3.5 text-xs font-semibold rounded-xl gap-2',
    lg: 'h-11 px-4.5 text-sm font-semibold rounded-xl gap-2',
  }[size];

  const iconSizes = {
    xs: 'w-3 h-3',
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
    lg: 'w-4.5 h-4.5',
  }[size];

  return (
    <button
      disabled={disabled || loading}
      aria-label={props['aria-label'] || (typeof props.title === 'string' ? props.title : undefined)}
      className={`inline-flex items-center justify-center font-medium transition-all select-none focus:outline-none focus:ring-2 focus:ring-brand-500/20 active:scale-[0.98] disabled:pointer-events-none disabled:cursor-not-allowed whitespace-nowrap ${variantStyles} ${sizeStyles} ${className}`}
      {...props}
    >
      {loading ? (
        <>
          <Loader2 className={`animate-spin ${iconSizes} shrink-0`} />
          {children && <span>{children}</span>}
        </>
      ) : (
        <>
          {Icon && iconPosition === 'left' && <Icon className={`${iconSizes} shrink-0`} />}
          {children}
          {Icon && iconPosition === 'right' && <Icon className={`${iconSizes} shrink-0`} />}
        </>
      )}
    </button>
  );
};
