import React from 'react';
import { cn } from '../cn';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  padding?: 'none' | 'sm' | 'md' | 'lg';
  hover?: boolean;
  bordered?: boolean;
}

const paddingStyles = {
  none: '',
  sm:   'p-4',
  md:   'p-5',
  lg:   'p-6',
};

export function Card({
  padding = 'md',
  hover = false,
  bordered = true,
  className,
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        'bg-white rounded-xl',
        bordered && 'border border-neutral-200',
        'shadow-xs',
        hover && 'transition-shadow duration-200 hover:shadow-md cursor-pointer',
        paddingStyles[padding],
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('flex items-center justify-between mb-5', className)} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn('text-base font-semibold text-neutral-900 tracking-tight', className)}
      {...props}
    >
      {children}
    </h3>
  );
}

interface CardBodyProps extends React.HTMLAttributes<HTMLDivElement> {
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export function CardBody({
  padding,
  className,
  children,
  ...props
}: CardBodyProps) {
  return (
    <div
      className={cn(
        padding != null && paddingStyles[padding],
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardFooter({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('mt-5 pt-4 border-t border-neutral-100 flex items-center', className)}
      {...props}
    >
      {children}
    </div>
  );
}
