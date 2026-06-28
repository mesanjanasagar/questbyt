import React from 'react';
import { cn } from '../cn';

export interface Column<T> {
  key: string;
  header: string | React.ReactNode;
  cell: (row: T, index: number) => React.ReactNode;
  className?: string;
  headerClassName?: string;
  width?: string;
}

interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (row: T, index: number) => string;
  loading?: boolean;
  emptyState?: React.ReactNode;
  rowClassName?: (row: T, index: number) => string;
  onRowClick?: (row: T) => void;
  className?: string;
  loadingRowCount?: number;
}

export function Table<T>({
  columns,
  data,
  keyExtractor,
  loading = false,
  emptyState,
  rowClassName,
  onRowClick,
  className,
  loadingRowCount = 5,
}: TableProps<T>) {
  return (
    <div className={cn('w-full overflow-x-auto', className)}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-neutral-200">
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn(
                  'py-3 px-4 text-left text-xs font-semibold text-neutral-500 uppercase tracking-label',
                  col.headerClassName,
                  col.width,
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            Array.from({ length: loadingRowCount }).map((_, i) => (
              <tr key={i} className="border-b border-neutral-100">
                {columns.map((col) => (
                  <td key={col.key} className="py-3 px-4">
                    <div className="h-4 bg-neutral-100 rounded animate-pulse" />
                  </td>
                ))}
              </tr>
            ))
          ) : data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="py-12">
                {emptyState ?? (
                  <div className="text-center text-neutral-400 text-sm">No data available</div>
                )}
              </td>
            </tr>
          ) : (
            data.map((row, index) => (
              <tr
                key={keyExtractor(row, index)}
                className={cn(
                  'border-b border-neutral-100 last:border-0',
                  'transition-colors duration-100',
                  onRowClick && 'cursor-pointer hover:bg-neutral-50',
                  rowClassName?.(row, index),
                )}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cn('py-3 px-4 text-neutral-700', col.className)}
                  >
                    {col.cell(row, index)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="text-center py-12 px-4">
      {icon && (
        <div className="w-12 h-12 rounded-xl bg-neutral-100 flex items-center justify-center mx-auto mb-4 text-neutral-400">
          {icon}
        </div>
      )}
      <p className="text-sm font-semibold text-neutral-700">{title}</p>
      {description && (
        <p className="text-sm text-neutral-500 mt-1">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
