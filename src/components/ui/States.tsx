import { ReactNode } from 'react';
import { AlertCircle, LucideIcon, RotateCw } from 'lucide-react';
import { Button } from './Button';
import { cn } from './cn';

/** Shimmering placeholder block. */
export const Skeleton = ({ className }: { className?: string }) => (
  <div className={cn('rounded-lg bg-surface-sunken animate-pulse motion-reduce:animate-none', className)} aria-hidden="true" />
);

/** Placeholder for a ListRow. */
export const SkeletonRow = () => (
  <div className="flex items-center gap-3 px-4 py-3" aria-hidden="true">
    <Skeleton className="h-10 w-10 rounded-xl" />
    <div className="flex-1 space-y-2">
      <Skeleton className="h-3.5 w-2/5" />
      <Skeleton className="h-3 w-1/4" />
    </div>
    <Skeleton className="h-4 w-20" />
  </div>
);

export interface EmptyStateProps {
  icon?: LucideIcon;
  title: ReactNode;
  description?: ReactNode;
  action?: { label: string; onClick: () => void; icon?: LucideIcon };
  className?: string;
}

/** Empty state (iOS `EmptyStateView`): tinted icon, title, message and one action. */
export const EmptyState = ({ icon: Icon, title, description, action, className }: EmptyStateProps) => (
  <div className={cn('flex flex-col items-center text-center px-6 py-12', className)}>
    {Icon && (
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-soft text-brand-on-soft">
        <Icon className="h-8 w-8" strokeWidth={2} aria-hidden="true" />
      </div>
    )}
    <h3 className="font-rounded text-xl font-semibold text-content">{title}</h3>
    {description && <p className="mt-1.5 max-w-sm text-[15px] text-content-secondary">{description}</p>}
    {action && (
      <Button className="mt-5" icon={action.icon} onClick={action.onClick}>
        {action.label}
      </Button>
    )}
  </div>
);

export interface ErrorStateProps {
  title: ReactNode;
  description?: ReactNode;
  retryLabel?: string;
  onRetry?: () => void;
  className?: string;
}

/** Error state (iOS `ErrorStateView`): message plus retry. */
export const ErrorState = ({ title, description, retryLabel, onRetry, className }: ErrorStateProps) => (
  <div className={cn('flex flex-col items-center text-center px-6 py-12', className)} role="alert">
    <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-negative-soft text-negative-on-soft">
      <AlertCircle className="h-7 w-7" aria-hidden="true" />
    </div>
    <h3 className="font-rounded text-lg font-semibold text-content">{title}</h3>
    {description && <p className="mt-1.5 max-w-sm text-sm text-content-secondary">{description}</p>}
    {onRetry && retryLabel && (
      <Button variant="secondary" size="sm" className="mt-4" icon={RotateCw} onClick={onRetry}>
        {retryLabel}
      </Button>
    )}
  </div>
);
