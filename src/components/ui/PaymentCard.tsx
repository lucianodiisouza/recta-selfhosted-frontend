import { ReactNode } from 'react';
import { Banknote, ChartLine, CreditCard, Leaf, LucideIcon, Wallet } from 'lucide-react';
import { AccountType } from '../../lib/enums';
import { cn } from './cn';

interface CardStyle {
  from: string;
  to: string;
  accent: string;
  icon: LucideIcon;
}

// Same gradients as iOS CardStyles.swift (forAccountType).
const TYPE_STYLES: Record<AccountType, CardStyle> = {
  [AccountType.CHECKING]: { from: '#6D4CFF', to: '#3A22C7', accent: '#5B3DF5', icon: Banknote },
  [AccountType.SAVINGS]: { from: '#12C48B', to: '#067A63', accent: '#12B76A', icon: Leaf },
  [AccountType.CREDIT]: { from: '#9B37E0', to: '#5B1E9E', accent: '#8B2FD6', icon: CreditCard },
  [AccountType.CASH]: { from: '#4A4A63', to: '#22222F', accent: '#3A3A52', icon: Wallet },
  [AccountType.INVESTMENT]: { from: '#2E7CF6', to: '#123FA8', accent: '#2E90FA', icon: ChartLine },
};

/** Darkens a #RRGGBB color by `amount` (0..1), like iOS `darkened(by:)`. */
const darken = (hex: string, amount: number): string => {
  const n = parseInt(hex.replace('#', ''), 16);
  const channel = (shift: number) => Math.round(((n >> shift) & 255) * (1 - amount));
  return `#${[16, 8, 0].map((s) => channel(s).toString(16).padStart(2, '0')).join('')}`;
};

/** Style of an account: the chosen color paints the card; the type only picks the icon (iOS `forAccount`). */
export const cardStyleFor = (type: AccountType, color?: string | null): CardStyle => {
  const base = TYPE_STYLES[type] ?? TYPE_STYLES[AccountType.CHECKING];
  if (!color || !/^#[0-9a-f]{6}$/i.test(color)) return base;
  return { from: color, to: darken(color, 0.42), accent: color, icon: base.icon };
};

export interface PaymentCardProps {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Usually a <MoneyText> in white. */
  amount: ReactNode;
  type: AccountType;
  color?: string | null;
  /** Physical card chip, for credit cards. */
  showChip?: boolean;
  compact?: boolean;
  className?: string;
  onClick?: () => void;
  /** Marks the card as the selected one (carousels). */
  selected?: boolean;
}

/** The signature account/credit card visual of the apps (iOS `PaymentCardView`). */
export const PaymentCard = ({ title, subtitle, amount, type, color, showChip, compact, className, onClick, selected }: PaymentCardProps) => {
  const style = cardStyleFor(type, color);
  const Icon = style.icon;
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      aria-pressed={onClick && selected !== undefined ? selected : undefined}
      className={cn(
        'relative flex w-full flex-col overflow-hidden text-start text-white',
        compact ? 'h-[120px] rounded-[20px] p-4' : 'h-[200px] rounded-[26px] p-5',
        onClick && 'transition-[transform,opacity] duration-200 hover:-translate-y-0.5 active:scale-[0.98] motion-reduce:transition-none',
        className,
      )}
      style={{
        backgroundImage: `linear-gradient(135deg, rgba(255,255,255,0.22), transparent 45%, rgba(255,255,255,0.06)), linear-gradient(135deg, ${style.from}, ${style.to})`,
        // Colored glow, plus the selection ring (both are box-shadows, so they live together).
        boxShadow: [
          selected ? '0 0 0 2px rgb(var(--bg)), 0 0 0 4px rgb(var(--brand))' : null,
          `0 ${compact ? 8 : 14}px ${compact ? 28 : 44}px -12px ${style.accent}73`,
        ].filter(Boolean).join(', '),
      }}
    >
      {/* Hairline edge (an overlay, so a selection ring on the card stays outside) */}
      <span className="pointer-events-none absolute inset-0 rounded-[inherit] ring-1 ring-inset ring-white/15" aria-hidden="true" />
      {/* Radial shine in the top corner */}
      <span className="pointer-events-none absolute -right-16 -top-24 h-52 w-52 rounded-full bg-white/15 blur-2xl" aria-hidden="true" />
      <div className="relative flex items-start justify-between">
        {showChip && !compact ? (
          <span className="h-8 w-[42px] rounded-md bg-gradient-to-b from-[#F4E7B0] to-[#C9A94E] shadow-inner" aria-hidden="true" />
        ) : (
          <span />
        )}
        <Icon className={cn('text-white/90', compact ? 'h-4 w-4' : 'h-[22px] w-[22px]')} strokeWidth={2.25} aria-hidden="true" />
      </div>
      <div className="relative mt-auto">
        <div className="font-rounded text-sm font-semibold truncate">{title}</div>
        {subtitle && <div className={cn('font-rounded text-[11px] text-white/75 truncate', compact ? 'mb-1' : 'mb-2')}>{subtitle}</div>}
        <div className={compact ? 'text-base' : 'text-2xl'}>{amount}</div>
      </div>
    </Tag>
  );
};
