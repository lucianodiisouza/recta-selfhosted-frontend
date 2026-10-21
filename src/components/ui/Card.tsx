import { HTMLAttributes, ReactNode } from 'react';
import { cn } from './cn';

type Padding = 'none' | 'sm' | 'md' | 'lg';
const paddings: Record<Padding, string> = { none: '', sm: 'p-3', md: 'p-4 sm:p-5', lg: 'p-5 sm:p-6' };

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: Padding;
  /** Adds a hover lift for cards that are clickable as a whole. */
  interactive?: boolean;
}

/** Standard elevated container (iOS `Card`): elevated background, 16px corners, soft shadow. */
export const Card = ({ padding = 'md', interactive, className, children, ...rest }: CardProps) => (
  <div
    className={cn(
      'surface-card',
      paddings[padding],
      interactive && 'transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-floating motion-reduce:transition-none motion-reduce:hover:translate-y-0',
      className,
    )}
    {...rest}
  >
    {children}
  </div>
);

/** Highlight card with the brand gradient (iOS `BrandCard`), e.g. total balance. */
export const BrandCard = ({ padding = 'lg', className, children, ...rest }: CardProps) => (
  <div
    className={cn('relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#6D4CFF] to-[#4A2EE0] text-white shadow-floating', paddings[padding], className)}
    {...rest}
  >
    {children}
  </div>
);

export interface SectionHeaderProps {
  title: ReactNode;
  /** Optional text action on the right ("Ver tudo"). */
  action?: { label: string; onClick: () => void };
  /** Anything else on the right (filters, menus). */
  trailing?: ReactNode;
  className?: string;
  as?: 'h2' | 'h3';
}

export const SectionHeader = ({ title, action, trailing, className, as: Tag = 'h2' }: SectionHeaderProps) => (
  <div className={cn('flex items-center justify-between gap-3 mb-3', className)}>
    <Tag className="font-rounded text-lg font-semibold text-content">{title}</Tag>
    <div className="flex items-center gap-2">
      {trailing}
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="text-sm font-semibold text-brand hover:opacity-75 transition-opacity -my-2 py-2 px-1"
        >
          {action.label}
        </button>
      )}
    </div>
  </div>
);
