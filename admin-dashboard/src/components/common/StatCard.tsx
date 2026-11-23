import React from 'react';
import { LucideIcon } from 'lucide-react';

export interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: {
    value: string;
    isPositive?: boolean;
  };
  color?: 'blue' | 'green' | 'amber' | 'purple' | 'rose';
  onClick?: () => void;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  color = 'blue',
  onClick,
}) => {
  const colorMap = {
    blue: 'bg-brand-50 text-brand-600 dark:bg-[#142D50] dark:text-blue-300 border-brand-200/60 dark:border-[#194D9C]/60',
    green: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/80 dark:text-emerald-400 border-emerald-200/60 dark:border-emerald-800/60',
    amber: 'bg-amber-50 text-amber-600 dark:bg-amber-950/80 dark:text-amber-400 border-amber-200/60 dark:border-amber-800/60',
    purple: 'bg-purple-50 text-purple-600 dark:bg-purple-950/80 dark:text-purple-400 border-purple-200/60 dark:border-purple-800/60',
    rose: 'bg-rose-50 text-rose-600 dark:bg-rose-950/80 dark:text-rose-400 border-rose-200/60 dark:border-rose-800/60',
  };

  return (
    <div
      onClick={onClick}
      className={`bg-white dark:bg-[#0F192C] rounded-2xl border border-slate-200/80 dark:border-[#24344D] p-5 shadow-sm hover:shadow-md transition-all ${
        onClick ? 'cursor-pointer hover:border-brand-300 dark:hover:border-[#194D9C]' : ''
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p
            className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-[#94A3B8] truncate"
            title={title}
          >
            {title}
          </p>
          <p className="text-2xl font-extrabold text-slate-900 dark:text-[#E8EEF8] mt-1.5 tracking-tight truncate">
            {value}
          </p>
        </div>
        <div
          className={`w-11 h-11 rounded-xl border flex items-center justify-center shrink-0 shadow-sm ${colorMap[color]}`}
        >
          <Icon className="w-5 h-5 shrink-0" />
        </div>
      </div>
      {(subtitle || trend) && (
        <div className="mt-3 flex items-center text-xs text-slate-500 dark:text-[#94A3B8] truncate">
          {trend && (
            <span
              className={`font-bold mr-1.5 shrink-0 ${
                trend.isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {trend.value}
            </span>
          )}
          <span className="truncate">{subtitle}</span>
        </div>
      )}
    </div>
  );
};
