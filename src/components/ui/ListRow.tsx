import { ElementType, KeyboardEvent, ReactNode } from 'react';
import { LucideIcon } from 'lucide-react';
import { cn } from './cn';

export interface IconBadgeProps {
  icon: LucideIcon;
  /** Hex tint (category/account color). Defaults to the brand. */
  color?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const badgeSizes = { sm: 'h-8 w-8 rounded-[10px]', md: 'h-10 w-10 rounded-xl', lg: 'h-12 w-12 rounded-[14px]' };
const badgeIcons = { sm: 'h-4 w-4', md: 'h-5 w-5', lg: 'h-6 w-6' };

/** Icon on a tinted rounded square (iOS `IconBadge`). */
export const IconBadge = ({ icon: Icon, color, size = 'md', className }: IconBadgeProps) => (
  <div
    className={cn('flex shrink-0 items-center justify-center', badgeSizes[size], !color && 'bg-brand-soft text-brand-on-soft', className)}
    style={color ? { backgroundColor: `${color}24`, color } : undefined}
    aria-hidden="true"
  >
    <Icon className={badgeIcons[size]} strokeWidth={2.25} />
  </div>
);

export interface ListRowProps {
  title: ReactNode;
  subtitle?: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
  /** Makes the whole row clickable (keyboard too). */
  onClick?: () => void;
  className?: string;
  as?: ElementType;
}

/** Standard list row (iOS `ListRow`): leading accessory, title/subtitle, trailing value. */
export const ListRow = ({ title, subtitle, leading, trailing, onClick, className, as: Tag = 'div' }: ListRowProps) => {
  const interactive = !!onClick;
  const onKeyDown = (e: KeyboardEvent) => {
    if (interactive && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onClick?.();
    }
  };
  return (
    <Tag
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={interactive ? onKeyDown : undefined}
      className={cn(
        'flex items-center gap-3 px-4 py-3 min-h-[60px]',
        interactive && 'cursor-pointer transition-colors duration-150 hover:bg-surface-sunken/70 active:bg-surface-sunken',
        className,
      )}
    >
      {leading}
      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px] font-medium text-content">{title}</div>
        {subtitle && <div className="truncate text-[13px] text-content-secondary mt-0.5">{subtitle}</div>}
      </div>
      {trailing && <div className="shrink-0 text-end">{trailing}</div>}
    </Tag>
  );
};

/** Grouped list inside a card, with inset separators (iOS inset grouped list). */
export const ListGroup = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div className={cn('bg-surface-elevated rounded-xl shadow-card dark:shadow-none dark:ring-1 dark:ring-line/60 overflow-hidden divide-y divide-line-subtle', className)}>
    {children}
  </div>
);
