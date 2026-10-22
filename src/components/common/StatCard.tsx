import React from 'react';
import { cn } from '@/lib/utils';

export interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: {
    value: string;
    isPositive?: boolean;
  };
  color?: 'navy' | 'blue' | 'emerald' | 'amber' | 'rose';
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  trend,
  color = 'navy',
  className,
}) => {
  const iconColorMap = {
    navy: 'bg-navy-50 text-navy-800 dark:bg-navy-950/60 dark:text-navy-300',
    blue: 'bg-brand-50 text-brand-600 dark:bg-brand-950/60 dark:text-brand-300',
    emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-300',
    amber: 'bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-300',
    rose: 'bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-300',
  };

  return (
    <div
      className={cn(
        'p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs flex flex-col justify-between transition-all hover:border-slate-300 dark:hover:border-slate-700',
        className
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {title}
        </span>
        <div className={cn('p-2.5 rounded-lg shrink-0', iconColorMap[color])}>
          {icon}
        </div>
      </div>
      <div>
        <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
          {value}
        </div>
        <div className="flex items-center gap-2 mt-1">
          {trend && (
            <span
              className={cn(
                'text-xs font-medium',
                trend.isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
              )}
            >
              {trend.value}
            </span>
          )}
          {subtitle && (
            <span className="text-xs text-slate-500 dark:text-slate-400 truncate">
              {subtitle}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
