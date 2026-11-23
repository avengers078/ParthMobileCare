import React from 'react';
import { LucideIcon } from 'lucide-react';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  size?: 'xs' | 'sm' | 'md';
  dot?: boolean;
  icon?: LucideIcon;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'sm',
  dot = false,
  icon: Icon,
  className = '',
}) => {
  const variantStyles = {
    primary:
      'bg-brand-50 text-brand-700 border-brand-200 dark:bg-[#142D50] dark:text-blue-300 dark:border-[#194D9C]/50',
    success:
      'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800',
    warning:
      'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800',
    danger:
      'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800',
    info:
      'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800',
    neutral:
      'bg-slate-100 text-slate-700 border-slate-200 dark:bg-[#17243A] dark:text-[#94A3B8] dark:border-[#24344D]',
  }[variant];

  const dotColors = {
    primary: 'bg-brand-500',
    success: 'bg-emerald-500',
    warning: 'bg-amber-500',
    danger: 'bg-rose-500',
    info: 'bg-sky-500',
    neutral: 'bg-slate-400',
  }[variant];

  const sizeStyles = {
    xs: 'px-1.5 py-0.5 text-[10px] space-x-1',
    sm: 'px-2 py-0.5 text-[11px] space-x-1.5',
    md: 'px-2.5 py-1 text-xs space-x-1.5',
  }[size];

  return (
    <span
      className={`inline-flex items-center font-semibold rounded-full border leading-tight ${variantStyles} ${sizeStyles} ${className}`}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${dotColors}`} />}
      {Icon && <Icon className="w-3 h-3" />}
      <span>{children}</span>
    </span>
  );
};
