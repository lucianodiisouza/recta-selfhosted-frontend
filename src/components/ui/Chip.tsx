import { ButtonHTMLAttributes, ReactNode } from 'react';
import { LucideIcon } from 'lucide-react';
import { cn } from './cn';

export type Tone = 'neutral' | 'brand' | 'positive' | 'negative' | 'warning' | 'info';

const badgeTones: Record<Tone, string> = {
  neutral: 'bg-surface-sunken text-content-secondary',
  brand: 'bg-brand-soft text-brand-on-soft',
  positive: 'bg-positive-soft text-positive',
  negative: 'bg-negative-soft text-negative-on-soft',
  warning: 'bg-warning/10 text-warning',
  info: 'bg-info/10 text-info',
};

/** Small status label ("Pendente", "Atrasado"). */
export const Badge = ({ tone = 'neutral', icon: Icon, children, className }: { tone?: Tone; icon?: LucideIcon; children: ReactNode; className?: string }) => (
  <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold leading-5 whitespace-nowrap', badgeTones[tone], className)}>
    {Icon && <Icon className="h-3 w-3" aria-hidden="true" />}
    {children}
  </span>
);

export interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
  icon?: LucideIcon;
  /** Custom tint (category color). Defaults to the brand. */
  color?: string;
}

/** Selectable pill (iOS `CategoryChip`): tinted when idle, filled when selected. */
export const Chip = ({ selected, icon: Icon, color, className, children, style, type = 'button', ...rest }: ChipProps) => (
  <button
    type={type}
    aria-pressed={selected}
    className={cn(
      'inline-flex items-center gap-1.5 rounded-full px-3 h-8 text-sm font-semibold whitespace-nowrap transition-colors duration-150',
      !color && (selected ? 'bg-brand-fill text-white' : 'bg-brand-soft text-brand-on-soft hover:bg-brand/15'),
      className,
    )}
    style={color ? { backgroundColor: selected ? color : `${color}1F`, color: selected ? '#FFFFFF' : color, ...style } : style}
    {...rest}
  >
    {Icon && <Icon className="h-3.5 w-3.5" aria-hidden="true" />}
    {children}
  </button>
);
