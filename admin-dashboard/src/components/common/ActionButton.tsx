import React from 'react';
import { LucideIcon } from 'lucide-react';

export interface ActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: LucideIcon;
  title?: string;
  label?: string;
  variant?: 'default' | 'primary' | 'success' | 'danger' | 'warning' | 'ghost' | 'whatsapp';
  as?: 'button' | 'a';
  asLink?: boolean;
  href?: string;
  target?: string;
  rel?: string;
}

export const ActionButton: React.FC<ActionButtonProps> = ({
  icon: Icon,
  title,
  label,
  variant = 'default',
  as,
  asLink = false,
  href,
  target,
  rel,
  className = '',
  disabled,
  onClick,
  ...props
}) => {
  const displayTitle = title || label || '';

  const variantStyles = {
    default:
      'text-slate-500 hover:text-brand-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800/80',
    ghost:
      'text-slate-500 hover:text-brand-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800/80',
    primary:
      'text-brand-600 hover:text-brand-700 hover:bg-brand-50 dark:text-brand-400 dark:hover:text-brand-300 dark:hover:bg-brand-950/40',
    success:
      'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:text-emerald-300 dark:hover:bg-emerald-950/40',
    danger:
      'text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:text-rose-300 dark:hover:bg-rose-950/40',
    warning:
      'text-amber-500 hover:text-amber-600 hover:bg-amber-50 dark:text-amber-400 dark:hover:text-amber-300 dark:hover:bg-amber-950/40',
    whatsapp:
      'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:text-emerald-300 dark:hover:bg-emerald-950/40',
  }[variant];

  const commonClasses = `inline-flex items-center justify-center w-8 h-8 rounded-lg shrink-0 transition-all select-none focus:outline-none focus:ring-2 focus:ring-brand-500/20 active:scale-95 disabled:pointer-events-none disabled:opacity-40 ${variantStyles} ${className}`;

  if ((as === 'a' || asLink || href) && href) {
    return (
      <a
        href={href}
        target={target}
        rel={rel}
        title={displayTitle}
        aria-label={displayTitle}
        className={commonClasses}
      >
        <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
      </a>
    );
  }

  return (
    <button
      type="button"
      title={displayTitle}
      aria-label={displayTitle}
      disabled={disabled}
      onClick={onClick}
      className={commonClasses}
      {...props}
    >
      <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
    </button>
  );
};
