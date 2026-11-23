import React from 'react';
import { LucideIcon, Inbox } from 'lucide-react';
import { Button } from './Button';

export interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  actionText?: string;
  onAction?: () => void;
  action?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon: Icon = Inbox,
  actionText,
  onAction,
  action,
  className = '',
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center p-8 sm:p-12 text-center bg-white dark:bg-[#0F192C] rounded-2xl border border-dashed border-slate-200 dark:border-[#24344D] ${className}`}
    >
      <div className="p-3.5 bg-slate-50 dark:bg-[#17243A] rounded-2xl text-slate-400 dark:text-[#71839D] mb-3 shadow-inner">
        <Icon className="w-8 h-8" />
      </div>
      <h4 className="text-sm font-bold text-slate-900 dark:text-[#E8EEF8]">{title}</h4>
      {description && (
        <p className="text-xs text-slate-500 dark:text-[#94A3B8] max-w-sm mt-1 leading-relaxed">
          {description}
        </p>
      )}
      {action ? (
        <div className="mt-4">{action}</div>
      ) : actionText && onAction ? (
        <div className="mt-4">
          <Button variant="primary" size="sm" onClick={onAction}>
            {actionText}
          </Button>
        </div>
      ) : null}
    </div>
  );
};
