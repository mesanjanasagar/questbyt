import React from 'react';
import { cn } from '../cn';

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  breadcrumbs?: Array<{ label: string; href?: string }>;
  className?: string;
}

export function PageHeader({
  title,
  description,
  actions,
  breadcrumbs,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn('mb-6', className)}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="flex items-center gap-1.5 mb-2 text-xs text-neutral-500">
          {breadcrumbs.map((crumb, i) => (
            <React.Fragment key={i}>
              {i > 0 && <span className="text-neutral-300">/</span>}
              {crumb.href ? (
                <a
                  href={crumb.href}
                  className="hover:text-neutral-700 transition-colors"
                >
                  {crumb.label}
                </a>
              ) : (
                <span className={i === breadcrumbs.length - 1 ? 'text-neutral-700 font-medium' : ''}>
                  {crumb.label}
                </span>
              )}
            </React.Fragment>
          ))}
        </nav>
      )}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-neutral-900 tracking-tight">{title}</h1>
          {description && (
            <p className="mt-1 text-sm text-neutral-500">{description}</p>
          )}
        </div>
        {actions && (
          <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>
        )}
      </div>
    </div>
  );
}

interface DashboardLayoutProps {
  children: React.ReactNode;
  className?: string;
}

export function DashboardLayout({ children, className }: DashboardLayoutProps) {
  return (
    <div className={cn('p-6 max-w-none', className)}>
      {children}
    </div>
  );
}
