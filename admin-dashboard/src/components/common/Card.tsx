import React from 'react';

export interface CardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  headerAction?: React.ReactNode;
  headerBorder?: boolean;
  noPadding?: boolean;
  children?: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({
  title,
  subtitle,
  actions,
  headerAction,
  headerBorder = true,
  noPadding = false,
  children,
  className = '',
  ...props
}) => {
  const finalActions = headerAction || actions;
  const hasHeader = Boolean(title || finalActions);

  return (
    <div
      className={`bg-white dark:bg-[#0F192C] rounded-2xl border border-slate-200/80 dark:border-[#24344D] shadow-sm transition-all ${className}`}
      {...props}
    >
      {hasHeader && (
        <div
          className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 sm:px-6 py-3.5 sm:py-4 ${
            headerBorder ? 'border-b border-slate-100 dark:border-[#24344D]' : ''
          }`}
        >
          <div className="min-w-0 pr-1 sm:pr-3 flex-1">
            {typeof title === 'string' ? (
              <h3 className="text-sm font-bold text-slate-900 dark:text-[#E8EEF8] leading-tight truncate">
                {title}
              </h3>
            ) : (
              title
            )}
            {subtitle && (
              typeof subtitle === 'string' ? (
                <p className="text-xs text-slate-500 dark:text-[#94A3B8] mt-1 leading-relaxed">
                  {subtitle}
                </p>
              ) : (
                subtitle
              )
            )}
          </div>
          {finalActions && (
            <div className="flex items-center gap-2 shrink-0">{finalActions}</div>
          )}
        </div>
      )}
      {children && (
        <div className={noPadding ? '' : 'p-5 sm:p-6'}>
          {children}
        </div>
      )}
    </div>
  );
};
