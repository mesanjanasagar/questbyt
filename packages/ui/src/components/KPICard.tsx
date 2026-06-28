import React from 'react';
import { cn } from '../cn';
import { TrendingUpIcon, TrendingDownIcon } from '../icons';

interface KPICardProps {
  label: string;
  value: string | number;
  subValue?: string;
  trend?: number;
  trendLabel?: string;
  icon?: React.ReactNode;
  iconColor?: string;
  className?: string;
  loading?: boolean;
}

export function KPICard({
  label,
  value,
  subValue,
  trend,
  trendLabel,
  icon,
  iconColor = 'text-primary-600 bg-primary-50',
  className,
  loading = false,
}: KPICardProps) {
  const trendPositive = trend !== undefined && trend >= 0;
  const trendNegative = trend !== undefined && trend < 0;

  if (loading) {
    return (
      <div className={cn('bg-white rounded-xl border border-neutral-200 shadow-xs p-5', className)}>
        <div className="flex items-start justify-between">
          <div className="flex-1 space-y-2">
            <div className="h-3 w-24 bg-neutral-200 rounded animate-pulse" />
            <div className="h-7 w-20 bg-neutral-200 rounded animate-pulse" />
            <div className="h-3 w-16 bg-neutral-100 rounded animate-pulse" />
          </div>
          <div className="w-10 h-10 rounded-lg bg-neutral-100 animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'bg-white rounded-xl border border-neutral-200 shadow-xs p-5',
        'transition-shadow duration-200 hover:shadow-md',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-neutral-500 uppercase tracking-label mb-2">
            {label}
          </p>
          <p className="text-2xl font-bold text-neutral-900 tracking-tight leading-none">
            {value}
          </p>
          <div className="flex items-center gap-2 mt-2">
            {subValue && (
              <span className="text-xs text-neutral-500">{subValue}</span>
            )}
            {trend !== undefined && (
              <span
                className={cn(
                  'inline-flex items-center gap-0.5 text-xs font-semibold',
                  trendPositive && 'text-success-600',
                  trendNegative && 'text-error-600',
                )}
              >
                {trendPositive ? (
                  <TrendingUpIcon size={12} />
                ) : (
                  <TrendingDownIcon size={12} />
                )}
                {Math.abs(trend)}%
                {trendLabel && (
                  <span className="text-neutral-400 font-normal ml-0.5">{trendLabel}</span>
                )}
              </span>
            )}
          </div>
        </div>
        {icon && (
          <div
            className={cn(
              'w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0',
              iconColor,
            )}
          >
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
