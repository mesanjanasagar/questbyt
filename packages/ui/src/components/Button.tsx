import React from 'react';
import { cn } from '../cn';
import { LoaderIcon } from '../icons';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent' | 'outline';
type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:   'bg-primary-600 text-white hover:bg-primary-700 active:bg-primary-800 focus-visible:ring-primary-500 shadow-xs hover:shadow-sm',
  secondary: 'bg-neutral-100 text-neutral-800 hover:bg-neutral-200 active:bg-neutral-300 focus-visible:ring-neutral-400 border border-neutral-200',
  ghost:     'bg-transparent text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 active:bg-neutral-200 focus-visible:ring-neutral-400',
  danger:    'bg-error-600 text-white hover:bg-error-700 active:bg-error-800 focus-visible:ring-error-500 shadow-xs hover:shadow-sm',
  accent:    'bg-accent-500 text-white hover:bg-accent-600 active:bg-accent-700 focus-visible:ring-accent-400 shadow-xs hover:shadow-sm',
  outline:   'bg-transparent text-primary-600 border border-primary-200 hover:bg-primary-50 hover:border-primary-300 active:bg-primary-100 focus-visible:ring-primary-400',
};

const sizeStyles: Record<ButtonSize, string> = {
  xs: 'h-7 px-2.5 text-xs rounded gap-1',
  sm: 'h-8 px-3 text-sm rounded gap-1.5',
  md: 'h-9 px-4 text-sm rounded-md gap-2',
  lg: 'h-10 px-5 text-base rounded-lg gap-2',
  xl: 'h-12 px-6 text-base rounded-lg gap-2.5',
};

const iconSizes: Record<ButtonSize, number> = {
  xs: 12, sm: 14, md: 16, lg: 16, xl: 18,
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      icon,
      iconPosition = 'left',
      fullWidth = false,
      disabled,
      className,
      children,
      ...props
    },
    ref,
  ) => {
    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        className={cn(
          'inline-flex items-center justify-center font-medium',
          'transition-all duration-150 ease-out',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1',
          'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none',
          'select-none',
          variantStyles[variant],
          sizeStyles[size],
          fullWidth && 'w-full',
          className,
        )}
        {...props}
      >
        {loading && (
          <LoaderIcon
            size={iconSizes[size]}
            className="animate-spin-slow flex-shrink-0"
          />
        )}
        {!loading && icon && iconPosition === 'left' && (
          <span className="flex-shrink-0">{icon}</span>
        )}
        {children && <span>{children}</span>}
        {!loading && icon && iconPosition === 'right' && (
          <span className="flex-shrink-0">{icon}</span>
        )}
      </button>
    );
  },
);

Button.displayName = 'Button';
