import React from 'react';
import { cn } from '../cn';

type BadgeVariant = 'default' | 'primary' | 'success' | 'warning' | 'error' | 'info' | 'accent';
type BadgeSize = 'sm' | 'md';

interface BadgeProps {
  variant?: BadgeVariant;
  size?: BadgeSize;
  dot?: boolean;
  className?: string;
  children: React.ReactNode;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-neutral-100 text-neutral-700 border border-neutral-200',
  primary: 'bg-primary-50 text-primary-700 border border-primary-100',
  success: 'bg-success-50 text-success-700 border border-success-100',
  warning: 'bg-warning-50 text-warning-700 border border-warning-100',
  error:   'bg-error-50 text-error-700 border border-error-100',
  info:    'bg-info-50 text-info-700 border border-info-100',
  accent:  'bg-accent-50 text-accent-700 border border-accent-100',
};

const dotVariantStyles: Record<BadgeVariant, string> = {
  default: 'bg-neutral-400',
  primary: 'bg-primary-500',
  success: 'bg-success-500',
  warning: 'bg-warning-500',
  error:   'bg-error-500',
  info:    'bg-info-500',
  accent:  'bg-accent-500',
};

const sizeStyles: Record<BadgeSize, string> = {
  sm: 'text-xs px-2 py-0.5 rounded-full',
  md: 'text-xs px-2.5 py-1 rounded-full',
};

export function Badge({
  variant = 'default',
  size = 'md',
  dot = false,
  className,
  children,
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 font-medium leading-none',
        variantStyles[variant],
        sizeStyles[size],
        className,
      )}
    >
      {dot && (
        <span
          className={cn(
            'w-1.5 h-1.5 rounded-full flex-shrink-0',
            dotVariantStyles[variant],
          )}
        />
      )}
      {children}
    </span>
  );
}

// Status-specific presets for convenience
interface StatusBadgeProps {
  status: string;
  className?: string;
}

const STATUS_MAP: Record<string, { variant: BadgeVariant; label: string }> = {
  active:    { variant: 'success', label: 'Active' },
  inactive:  { variant: 'default', label: 'Inactive' },
  pending:   { variant: 'warning', label: 'Pending' },
  cooking:   { variant: 'info',    label: 'Cooking' },
  'in-progress': { variant: 'info', label: 'In Progress' },
  ready:     { variant: 'success', label: 'Ready' },
  served:    { variant: 'default', label: 'Served' },
  completed: { variant: 'success', label: 'Completed' },
  cancelled: { variant: 'error',   label: 'Cancelled' },
  paid:      { variant: 'success', label: 'Paid' },
  unpaid:    { variant: 'warning', label: 'Unpaid' },
  refunded:  { variant: 'info',    label: 'Refunded' },
  'sold-out': { variant: 'error',  label: 'Sold Out' },
  'at-risk': { variant: 'warning', label: 'At Risk' },
  churned:   { variant: 'error',   label: 'Churned' },
  vip:       { variant: 'accent',  label: 'VIP' },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const normalized = status.toLowerCase().replace(/_/g, '-');
  const config = STATUS_MAP[normalized] ?? { variant: 'default' as BadgeVariant, label: status };
  return (
    <Badge variant={config.variant} dot className={className}>
      {config.label}
    </Badge>
  );
}
