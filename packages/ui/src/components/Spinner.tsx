import { cn } from '../cn';

type SpinnerSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface SpinnerProps {
  size?: SpinnerSize;
  className?: string;
}

const sizeMap: Record<SpinnerSize, string> = {
  xs: 'w-3 h-3 border',
  sm: 'w-4 h-4 border-2',
  md: 'w-6 h-6 border-2',
  lg: 'w-8 h-8 border-2',
  xl: 'w-12 h-12 border-[3px]',
};

export function Spinner({ size = 'md', className }: SpinnerProps) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className={cn(
        'rounded-full border-neutral-200 border-t-primary-600 animate-spin',
        sizeMap[size],
        className,
      )}
    />
  );
}

interface FullPageSpinnerProps {
  message?: string;
}

export function FullPageSpinner({ message = 'Loading...' }: FullPageSpinnerProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-64 gap-3">
      <Spinner size="lg" />
      <p className="text-sm text-neutral-500">{message}</p>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'bg-gradient-to-r from-neutral-100 via-neutral-200 to-neutral-100',
        'bg-[length:200%_100%] animate-shimmer rounded',
        className,
      )}
    />
  );
}

export function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl border border-neutral-200 p-5 space-y-3">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-7 w-16" />
      <Skeleton className="h-3 w-32" />
    </div>
  );
}

export function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 py-3 border-b border-neutral-100">
      <Skeleton className="h-4 w-4 rounded-full" />
      <Skeleton className="h-4 flex-1" />
      <Skeleton className="h-4 w-20" />
      <Skeleton className="h-4 w-16" />
      <Skeleton className="h-6 w-14 rounded-full" />
    </div>
  );
}
