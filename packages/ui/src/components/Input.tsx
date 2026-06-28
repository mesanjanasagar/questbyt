import React from 'react';
import { cn } from '../cn';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  suffix?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      hint,
      error,
      icon,
      iconPosition = 'left',
      suffix,
      className,
      id,
      ...props
    },
    ref,
  ) => {
    const inputId = id ?? (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);
    const hasLeftIcon = icon && iconPosition === 'left';
    const hasRightIcon = icon && iconPosition === 'right';

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-neutral-700 mb-1.5"
          >
            {label}
            {props.required && <span className="text-error-500 ml-1">*</span>}
          </label>
        )}
        <div className="relative">
          {hasLeftIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              'w-full h-9 bg-white border rounded-md text-sm text-neutral-900',
              'placeholder:text-neutral-400',
              'transition-colors duration-150',
              'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-0 focus:border-primary-400',
              'disabled:bg-neutral-50 disabled:text-neutral-400 disabled:cursor-not-allowed',
              error
                ? 'border-error-400 focus:ring-error-400 focus:border-error-400'
                : 'border-neutral-300 hover:border-neutral-400',
              hasLeftIcon && 'pl-9',
              (hasRightIcon || suffix) ? 'pr-9' : 'pr-3',
              'pl-3',
              hasLeftIcon && 'pl-9',
              className,
            )}
            {...props}
          />
          {hasRightIcon && !suffix && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none">
              {icon}
            </div>
          )}
          {suffix && (
            <div className="absolute right-0 top-0 h-full flex items-center pr-3 text-neutral-400">
              {suffix}
            </div>
          )}
        </div>
        {(hint || error) && (
          <p
            className={cn(
              'mt-1.5 text-xs',
              error ? 'text-error-600' : 'text-neutral-500',
            )}
          >
            {error ?? hint}
          </p>
        )}
      </div>
    );
  },
);

Input.displayName = 'Input';

// Textarea variant
interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, hint, error, className, id, rows = 3, ...props }, ref) => {
    const textareaId = id ?? (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={textareaId} className="block text-sm font-medium text-neutral-700 mb-1.5">
            {label}
            {props.required && <span className="text-error-500 ml-1">*</span>}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          rows={rows}
          className={cn(
            'w-full bg-white border rounded-md text-sm text-neutral-900 px-3 py-2.5',
            'placeholder:text-neutral-400 resize-none',
            'transition-colors duration-150',
            'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-0 focus:border-primary-400',
            'disabled:bg-neutral-50 disabled:text-neutral-400 disabled:cursor-not-allowed',
            error
              ? 'border-error-400 focus:ring-error-400'
              : 'border-neutral-300 hover:border-neutral-400',
            className,
          )}
          {...props}
        />
        {(hint || error) && (
          <p className={cn('mt-1.5 text-xs', error ? 'text-error-600' : 'text-neutral-500')}>
            {error ?? hint}
          </p>
        )}
      </div>
    );
  },
);

Textarea.displayName = 'Textarea';
